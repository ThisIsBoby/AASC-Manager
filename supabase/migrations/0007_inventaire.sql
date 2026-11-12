-- =====================================================================
-- AASC Manager — 0007 : inventaires (campagnes de comptage des caisses)
-- À exécuter dans Supabase › SQL Editor, APRÈS 0006_type_evenement.sql.
--
-- Principe :
--   1. un admin ouvre un inventaire (toutes les caisses actives, ou une sélection) ;
--   2. les membres scannent chaque caisse et comptent ses éléments (enregistrer_comptage) ;
--   3. un admin valide chaque caisse comptée (valider_comptage) : les écarts sont appliqués
--      au stock sous forme de mouvements « ajustement » (motif « Inventaire : <nom> ») ;
--   4. l'admin clôture l'inventaire. Le rapport des écarts reste consultable.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table public.inventaires (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  statut      text not null default 'en_cours' check (statut in ('en_cours','cloture')),
  note        text not null default '',
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  cloture_le  timestamptz
);

-- Une caisse dans un inventaire
--   a_faire  : pas encore comptée
--   en_cours : comptage enregistré mais incomplet
--   compte   : tous les éléments sont comptés, en attente de validation par un admin
--   valide   : écarts appliqués au stock
create table public.inventaire_caisses (
  id             uuid primary key default gen_random_uuid(),
  inventaire_id  uuid not null references public.inventaires(id) on delete cascade,
  caisse_id      uuid not null references public.caisses(id) on delete cascade,
  statut         text not null default 'a_faire' check (statut in ('a_faire','en_cours','compte','valide')),
  compte_par     uuid references public.profiles(id) on delete set null,
  compte_le      timestamptz,
  valide_par     uuid references public.profiles(id) on delete set null,
  valide_le      timestamptz,
  unique (inventaire_id, caisse_id)
);
create index inventaire_caisses_inv_idx on public.inventaire_caisses(inventaire_id);

-- Une ligne de comptage : un lot attendu, ou un élément trouvé en plus (nouveau = true)
create table public.inventaire_lignes (
  id                    uuid primary key default gen_random_uuid(),
  inventaire_caisse_id  uuid not null references public.inventaire_caisses(id) on delete cascade,
  lot_id                uuid references public.lots(id) on delete set null,
  produit_id            uuid not null references public.produits(id) on delete cascade,
  nouveau               boolean not null default false,
  qte_theorique         numeric(12,2) not null default 0,   -- quantité attendue au moment du comptage
  qte_comptee           numeric(12,2) check (qte_comptee is null or qte_comptee >= 0),  -- null = non compté
  qte_avant             numeric(12,2),                      -- quantité réelle au moment de la validation
  date_peremption       date,
  note                  text not null default ''
);
create index inventaire_lignes_ic_idx on public.inventaire_lignes(inventaire_caisse_id);

alter table public.mouvements add column inventaire_id uuid references public.inventaires(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. RLS : lecture pour les actifs, écriture via les fonctions uniquement
-- ---------------------------------------------------------------------
alter table public.inventaires enable row level security;
alter table public.inventaire_caisses enable row level security;
alter table public.inventaire_lignes enable row level security;

create policy "lecture actifs" on public.inventaires for select using (public.is_actif());
create policy "lecture actifs" on public.inventaire_caisses for select using (public.is_actif());
create policy "lecture actifs" on public.inventaire_lignes for select using (public.is_actif());
create policy "admin supprime" on public.inventaires for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Fonctions
-- ---------------------------------------------------------------------

-- Ouvre un inventaire sur les caisses données (null = toutes les caisses actives)
create or replace function public.creer_inventaire(p_nom text, p_caisses uuid[] default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Création d''inventaire réservée aux administrateurs'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Donnez un nom à l''inventaire'; end if;
  insert into inventaires (nom) values (trim(p_nom)) returning id into v_id;
  insert into inventaire_caisses (inventaire_id, caisse_id)
  select v_id, c.id from caisses c
  where (p_caisses is null and c.actif) or c.id = any(p_caisses);
  return v_id;
end $$;

-- Ajoute une caisse (scannée) à un inventaire en cours ; renvoie la ligne existante si déjà présente
create or replace function public.ajouter_caisse_inventaire(p_inventaire uuid, p_caisse uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from inventaires where id = p_inventaire and statut = 'en_cours') then
    raise exception 'Inventaire introuvable ou clôturé';
  end if;
  insert into inventaire_caisses (inventaire_id, caisse_id) values (p_inventaire, p_caisse)
  on conflict (inventaire_id, caisse_id) do nothing;
  select id into v_id from inventaire_caisses where inventaire_id = p_inventaire and caisse_id = p_caisse;
  return v_id;
end $$;

-- Enregistre (ou corrige) le comptage d'une caisse.
-- p_lignes : [{ "lot_id": uuid|null, "produit_id": uuid, "qte_comptee": number|null,
--               "date_peremption": "YYYY-MM-DD"|null, "note": text }]
--   - chaque lot présent dans la caisse donne une ligne (qte_comptee null s'il n'est pas dans p_lignes) ;
--   - une entrée sans lot_id (ou avec un lot d'une autre caisse) est un élément trouvé en plus.
create or replace function public.enregistrer_comptage(p_inv_caisse uuid, p_lignes jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ic inventaire_caisses%rowtype;
  v_statut text;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  select * into ic from inventaire_caisses where id = p_inv_caisse for update;
  if not found then raise exception 'Caisse introuvable dans cet inventaire'; end if;
  if ic.statut = 'valide' then raise exception 'Cette caisse est déjà validée'; end if;
  if not exists (select 1 from inventaires where id = ic.inventaire_id and statut = 'en_cours') then
    raise exception 'Inventaire clôturé';
  end if;

  delete from inventaire_lignes where inventaire_caisse_id = p_inv_caisse;

  -- Lots attendus (quantité théorique = quantité actuelle)
  insert into inventaire_lignes (inventaire_caisse_id, lot_id, produit_id, nouveau, qte_theorique, qte_comptee, date_peremption, note)
  select p_inv_caisse, l.id, l.produit_id, false, l.quantite,
         (j->>'qte_comptee')::numeric, l.date_peremption, coalesce(j->>'note', '')
  from lots l
  left join lateral (
    select e from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) e
    where e->>'lot_id' = l.id::text limit 1
  ) x(j) on true
  where l.caisse_id = ic.caisse_id;

  -- Éléments trouvés en plus
  insert into inventaire_lignes (inventaire_caisse_id, lot_id, produit_id, nouveau, qte_theorique, qte_comptee, date_peremption, note)
  select p_inv_caisse, null, (e->>'produit_id')::uuid, true, 0,
         (e->>'qte_comptee')::numeric, nullif(e->>'date_peremption', '')::date, coalesce(e->>'note', '')
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) e
  where coalesce((e->>'qte_comptee')::numeric, 0) > 0
    and e->>'produit_id' is not null
    and not exists (select 1 from lots l where l.id::text = e->>'lot_id' and l.caisse_id = ic.caisse_id);

  v_statut := case
    when exists (select 1 from inventaire_lignes where inventaire_caisse_id = p_inv_caisse and qte_comptee is null)
      then 'en_cours' else 'compte' end;
  update inventaire_caisses set statut = v_statut, compte_par = auth.uid(), compte_le = now()
  where id = p_inv_caisse;
  return v_statut;
end $$;

-- Valide le comptage d'une caisse : applique les écarts au stock (admin)
create or replace function public.valider_comptage(p_inv_caisse uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  ic inventaire_caisses%rowtype;
  inv inventaires%rowtype;
  li inventaire_lignes%rowtype;
  l lots%rowtype;
  v_motif text;
  v_lot uuid;
  v_nb int := 0;
begin
  if not is_admin() then raise exception 'Validation réservée aux administrateurs'; end if;
  select * into ic from inventaire_caisses where id = p_inv_caisse for update;
  if not found then raise exception 'Caisse introuvable dans cet inventaire'; end if;
  if ic.statut = 'valide' then raise exception 'Cette caisse est déjà validée'; end if;
  if ic.statut = 'a_faire' then raise exception 'Cette caisse n''a pas encore été comptée'; end if;
  select * into inv from inventaires where id = ic.inventaire_id;
  if inv.statut <> 'en_cours' then raise exception 'Inventaire clôturé'; end if;
  if exists (select 1 from inventaire_lignes where inventaire_caisse_id = p_inv_caisse and qte_comptee is null) then
    raise exception 'Tous les éléments doivent être comptés avant la validation';
  end if;

  v_motif := 'Inventaire : ' || inv.nom;
  perform set_config('aasc.rpc', 'on', true);

  for li in select * from inventaire_lignes where inventaire_caisse_id = p_inv_caisse loop
    l := null;
    if li.lot_id is not null then
      select * into l from lots where id = li.lot_id for update;
    end if;

    if l.id is not null then
      -- Lot toujours présent : on aligne sa quantité sur le comptage
      update inventaire_lignes set qte_avant = l.quantite where id = li.id;
      if li.qte_comptee <> l.quantite then
        if li.qte_comptee = 0 then
          delete from lots where id = l.id;
        else
          update lots set quantite = li.qte_comptee where id = l.id;
        end if;
        insert into mouvements (lot_id, produit_id, caisse_id, type, quantite, quantite_apres, motif, inventaire_id)
        values (case when li.qte_comptee = 0 then null else l.id end, l.produit_id, l.caisse_id, 'ajustement',
                li.qte_comptee - l.quantite, li.qte_comptee, v_motif, inv.id);
        v_nb := v_nb + 1;
      end if;
    else
      -- Élément en plus, ou lot disparu entre le comptage et la validation : on (re)crée le lot
      update inventaire_lignes set qte_avant = 0 where id = li.id;
      if li.qte_comptee > 0 then
        insert into lots (caisse_id, produit_id, quantite, date_peremption, note)
        values (ic.caisse_id, li.produit_id, li.qte_comptee, li.date_peremption, li.note)
        returning id into v_lot;
        update inventaire_lignes set lot_id = v_lot where id = li.id;
        insert into mouvements (lot_id, produit_id, caisse_id, type, quantite, quantite_apres, motif, inventaire_id)
        values (v_lot, li.produit_id, ic.caisse_id, 'ajustement', li.qte_comptee, li.qte_comptee, v_motif, inv.id);
        v_nb := v_nb + 1;
      end if;
    end if;
  end loop;

  update inventaire_caisses set statut = 'valide', valide_par = auth.uid(), valide_le = now() where id = p_inv_caisse;
  return v_nb;
end $$;

-- Clôture un inventaire (admin)
create or replace function public.cloturer_inventaire(p_inventaire uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Clôture réservée aux administrateurs'; end if;
  update inventaires set statut = 'cloture', cloture_le = now() where id = p_inventaire and statut = 'en_cours';
  if not found then raise exception 'Inventaire introuvable ou déjà clôturé'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.creer_inventaire(text, uuid[]) from public, anon;
revoke execute on function public.ajouter_caisse_inventaire(uuid, uuid) from public, anon;
revoke execute on function public.enregistrer_comptage(uuid, jsonb) from public, anon;
revoke execute on function public.valider_comptage(uuid) from public, anon;
revoke execute on function public.cloturer_inventaire(uuid) from public, anon;
grant execute on function public.creer_inventaire(text, uuid[]) to authenticated;
grant execute on function public.ajouter_caisse_inventaire(uuid, uuid) to authenticated;
grant execute on function public.enregistrer_comptage(uuid, jsonb) to authenticated;
grant execute on function public.valider_comptage(uuid) to authenticated;
grant execute on function public.cloturer_inventaire(uuid) to authenticated;

commit;
