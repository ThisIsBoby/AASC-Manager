-- =====================================================================
-- AASC Manager — 0003 : Adhérents, Boutique (articles vendus) & Cordage
-- À exécuter dans Supabase › SQL Editor, APRÈS 0001_init.sql et 0002_checklist.sql.
--
-- Principe : les articles vendus (tubes, maillots par taille, garniture de cordage…)
-- SONT des produits du module Stock. Une vente fait une sortie de stock classique,
-- visible dans l'historique, et les seuils « stock bas » restent ceux des produits.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ADHÉRENTS (importés chaque saison depuis un CSV)
-- ---------------------------------------------------------------------
create table public.adherents (
  id              uuid primary key default gen_random_uuid(),
  licence         text,
  nom             text not null check (length(trim(nom)) > 0),
  prenom          text not null default '',
  sexe            text not null default '',
  date_naissance  date,
  email           text not null default '',
  telephone       text not null default '',
  categorie       text not null default '',
  saison          text not null default '',
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index adherents_licence_uidx on public.adherents (licence) where licence is not null and licence <> '';
create index adherents_nom_idx on public.adherents (lower(nom), lower(prenom));

-- ---------------------------------------------------------------------
-- 2. CATALOGUE : articles, variantes (taille…) liées à un produit du stock
-- ---------------------------------------------------------------------
create table public.articles (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null unique check (length(trim(nom)) > 0),
  categorie    text not null default '',          -- ex. Volants, Vêtements, Accessoires
  description  text not null default '',
  prix         numeric(10,2) not null default 0 check (prix >= 0),
  actif        boolean not null default true,
  ordre        int not null default 0,
  created_at   timestamptz not null default now()
);

create table public.article_variantes (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.articles(id) on delete cascade,
  libelle     text not null default '',            -- taille / couleur ; vide = article sans variante
  produit_id  uuid references public.produits(id) on delete set null,   -- le stock
  prix        numeric(10,2) check (prix is null or prix >= 0),            -- null = prix de l'article
  actif       boolean not null default true,
  ordre       int not null default 0,
  unique (article_id, libelle)
);
create index article_variantes_article_idx on public.article_variantes(article_id);

create table public.offres_cordage (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null unique check (length(trim(nom)) > 0),
  prix        numeric(10,2) not null default 0 check (prix >= 0),
  produit_id  uuid references public.produits(id) on delete set null,  -- garniture fournie par le club (sortie de 1)
  actif       boolean not null default true,
  ordre       int not null default 0
);

-- ---------------------------------------------------------------------
-- 3. VENTES & CORDAGES
-- ---------------------------------------------------------------------
create table public.ventes (
  id              uuid primary key default gen_random_uuid(),
  adherent_id     uuid references public.adherents(id) on delete set null,
  variante_id     uuid references public.article_variantes(id) on delete set null,
  libelle         text not null default '',        -- « Maillot club – M », figé au moment de la vente
  quantite        int not null check (quantite > 0),
  prix_unitaire   numeric(10,2) not null check (prix_unitaire >= 0),
  total           numeric(12,2) generated always as (quantite * prix_unitaire) stored,
  paye            boolean not null default false,
  moyen_paiement  text not null default '',
  paye_le         timestamptz,
  note            text not null default '',
  annulee         boolean not null default false,
  user_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index ventes_adherent_idx on public.ventes(adherent_id);
create index ventes_date_idx on public.ventes(created_at desc);

create table public.cordages (
  id              uuid primary key default gen_random_uuid(),
  adherent_id     uuid references public.adherents(id) on delete set null,
  offre_id        uuid references public.offres_cordage(id) on delete set null,
  offre_nom       text not null default '',        -- figé à la saisie
  prix            numeric(10,2) not null default 0 check (prix >= 0),
  raquette        text not null default '',
  cordage_ref     text not null default '',
  tension         text not null default '',
  statut          text not null default 'deposee' check (statut in ('deposee','cordee','rendue')),
  depose_le       date not null default current_date,
  corde_le        date,
  rendu_le        date,
  stock_sorti     boolean not null default false,
  paye            boolean not null default false,
  moyen_paiement  text not null default '',
  paye_le         timestamptz,
  note            text not null default '',
  user_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index cordages_adherent_idx on public.cordages(adherent_id);
create index cordages_statut_idx on public.cordages(statut);

-- Traçabilité des sorties de stock
alter table public.mouvements add column vente_id uuid references public.ventes(id) on delete set null;
alter table public.mouvements add column cordage_id uuid references public.cordages(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------
-- « Payé le » renseigné par la base
create or replace function public.set_paye_le() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.paye_le := case when new.paye then now() end;
  elsif new.paye is distinct from old.paye then
    new.paye_le := case when new.paye then now() end;
  else
    new.paye_le := old.paye_le;
  end if;
  return new;
end $$;
create trigger ventes_paye_le before insert or update on public.ventes
  for each row execute function public.set_paye_le();
create trigger cordages_paye_le before insert or update on public.cordages
  for each row execute function public.set_paye_le();

-- Une vente ne change d'article / quantité / état d'annulation que via les fonctions ;
-- le prix ne peut être corrigé que par un admin.
create or replace function public.protect_vente() returns trigger
language plpgsql as $$
begin
  if current_setting('aasc.rpc', true) is distinct from 'on' then
    if new.variante_id is distinct from old.variante_id or new.quantite is distinct from old.quantite
       or new.annulee is distinct from old.annulee or new.adherent_id is distinct from old.adherent_id then
      raise exception 'Pour modifier l''article, la quantité ou l''adhérent, annulez la vente et ressaisissez-la.';
    end if;
    if new.prix_unitaire is distinct from old.prix_unitaire and not public.is_admin() then
      raise exception 'Seul un administrateur peut corriger un prix.';
    end if;
  end if;
  return new;
end $$;
create trigger ventes_protect before update on public.ventes
  for each row execute function public.protect_vente();

-- Le statut d'un cordage avance via avancer_cordage (qui gère la sortie de stock)
create or replace function public.protect_cordage() returns trigger
language plpgsql as $$
begin
  if current_setting('aasc.rpc', true) is distinct from 'on' then
    if new.statut is distinct from old.statut or new.stock_sorti is distinct from old.stock_sorti then
      raise exception 'Le statut d''un cordage se change avec les boutons d''étape.';
    end if;
  end if;
  return new;
end $$;
create trigger cordages_protect before update on public.cordages
  for each row execute function public.protect_cordage();

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.adherents enable row level security;
alter table public.articles enable row level security;
alter table public.article_variantes enable row level security;
alter table public.offres_cordage enable row level security;
alter table public.ventes enable row level security;
alter table public.cordages enable row level security;

create policy "lecture actifs" on public.adherents for select using (public.is_actif());
create policy "lecture actifs" on public.articles for select using (public.is_actif());
create policy "lecture actifs" on public.article_variantes for select using (public.is_actif());
create policy "lecture actifs" on public.offres_cordage for select using (public.is_actif());
create policy "lecture actifs" on public.ventes for select using (public.is_actif());
create policy "lecture actifs" on public.cordages for select using (public.is_actif());

-- Catalogue, prix, offres, liste des adhérents : admin
create policy "admin écrit" on public.adherents for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.articles for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.article_variantes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.offres_cordage for all using (public.is_admin()) with check (public.is_admin());

-- Ventes : création via enregistrer_vente ; paiement / note par les actifs
create policy "actifs modifient" on public.ventes for update using (public.is_actif()) with check (public.is_actif());

-- Cordages : saisie et suivi par les actifs, suppression admin
create policy "actifs créent" on public.cordages for insert with check (public.is_actif());
create policy "actifs modifient" on public.cordages for update using (public.is_actif()) with check (public.is_actif());
create policy "admin supprime" on public.cordages for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. FONCTIONS MÉTIER
-- ---------------------------------------------------------------------

-- Sort p_quantite d'un produit (lots non périmés, péremption la plus proche d'abord).
-- Retourne la quantité réellement sortie. Usage interne.
create or replace function public._sortir_produit(p_produit uuid, p_quantite numeric, p_motif text)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  lt record;
  v_reste numeric := p_quantite;
  v_pris numeric;
begin
  for lt in
    select l.id, l.quantite from lots l
    where l.produit_id = p_produit
      and (l.date_peremption is null or l.date_peremption >= current_date)
    order by l.date_peremption asc nulls last, l.created_at asc
  loop
    exit when v_reste <= 0;
    v_pris := least(v_reste, lt.quantite);
    perform enregistrer_mouvement(lt.id, 'sortie', v_pris, p_motif, null);
    v_reste := v_reste - v_pris;
  end loop;
  return p_quantite - greatest(v_reste, 0);
end $$;

create or replace function public._nom_adherent(p_adherent uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select trim(prenom || ' ' || nom) from adherents where id = p_adherent), 'non renseigné');
$$;

-- Enregistrer une vente à un adhérent (+ sortie de stock si la variante est liée à un produit)
create or replace function public.enregistrer_vente(
  p_adherent uuid, p_variante uuid, p_quantite int, p_prix numeric default null,
  p_paye boolean default false, p_moyen text default '', p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v article_variantes%rowtype;
  a articles%rowtype;
  v_prix numeric;
  v_dispo numeric;
  v_id uuid;
  v_libelle text;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;
  select * into v from article_variantes where id = p_variante;
  if not found then raise exception 'Article introuvable'; end if;
  select * into a from articles where id = v.article_id;
  v_prix := coalesce(p_prix, v.prix, a.prix);
  if v_prix < 0 then raise exception 'Prix invalide'; end if;
  v_libelle := a.nom || case when v.libelle <> '' then ' – ' || v.libelle else '' end;

  if v.produit_id is not null then
    select coalesce(sum(quantite), 0) into v_dispo from lots
    where produit_id = v.produit_id and (date_peremption is null or date_peremption >= current_date);
    if v_dispo < p_quantite then
      raise exception 'Stock insuffisant pour % (disponible : %)', v_libelle, v_dispo;
    end if;
  end if;

  insert into ventes (adherent_id, variante_id, libelle, quantite, prix_unitaire, paye, moyen_paiement, note)
  values (p_adherent, p_variante, v_libelle, p_quantite, v_prix, coalesce(p_paye, false),
          case when p_paye then coalesce(p_moyen, '') else '' end, coalesce(p_note, ''))
  returning id into v_id;

  if v.produit_id is not null then
    perform _sortir_produit(v.produit_id, p_quantite, 'Vente : ' || _nom_adherent(p_adherent));
    -- Les mouvements créés dans cette transaction portent now() : on les rattache à la vente
    update mouvements set vente_id = v_id
    where produit_id = v.produit_id and type = 'sortie' and vente_id is null and created_at = now();
  end if;
  return v_id;
end $$;

-- Annuler une vente (admin) : les quantités reviennent dans leurs caisses d'origine
create or replace function public.annuler_vente(p_vente uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ve ventes%rowtype;
  m record;
  v_lot uuid;
  v_new numeric;
begin
  if not is_admin() then raise exception 'Annulation réservée aux administrateurs'; end if;
  select * into ve from ventes where id = p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if ve.annulee then raise exception 'Vente déjà annulée'; end if;

  perform set_config('aasc.rpc', 'on', true);
  for m in select * from mouvements where vente_id = p_vente and type = 'sortie' loop
    continue when m.caisse_id is null or m.produit_id is null;
    if m.lot_id is not null and exists (select 1 from lots where id = m.lot_id) then
      update lots set quantite = quantite - m.quantite where id = m.lot_id returning id, quantite into v_lot, v_new;
    else
      insert into lots (caisse_id, produit_id, quantite, note)
      values (m.caisse_id, m.produit_id, -m.quantite, 'Retour vente annulée')
      returning id, quantite into v_lot, v_new;
    end if;
    insert into mouvements (lot_id, produit_id, caisse_id, type, quantite, quantite_apres, motif, vente_id)
    values (v_lot, m.produit_id, m.caisse_id, 'entree', -m.quantite, v_new, 'Annulation vente : ' || _nom_adherent(ve.adherent_id), p_vente);
  end loop;

  update ventes set annulee = true where id = p_vente;
end $$;

-- Faire avancer un cordage : deposee → cordee → rendue.
-- Au premier passage après « déposée », si l'offre fournit la garniture, 1 unité sort du stock.
-- Retourne un avertissement (texte) si le stock de garniture était insuffisant, sinon null.
create or replace function public.avancer_cordage(p_cordage uuid, p_statut text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c cordages%rowtype;
  v_produit uuid;
  v_sorti numeric;
  v_warn text;
  rang_old int;
  rang_new int;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if p_statut not in ('deposee','cordee','rendue') then raise exception 'Statut invalide'; end if;
  select * into c from cordages where id = p_cordage for update;
  if not found then raise exception 'Cordage introuvable'; end if;

  rang_old := array_position(array['deposee','cordee','rendue'], c.statut);
  rang_new := array_position(array['deposee','cordee','rendue'], p_statut);
  if rang_new < rang_old and not is_admin() then
    raise exception 'Seul un administrateur peut revenir à une étape précédente';
  end if;

  perform set_config('aasc.rpc', 'on', true);

  if rang_new >= 2 and not c.stock_sorti then
    select produit_id into v_produit from offres_cordage where id = c.offre_id;
    if v_produit is not null then
      v_sorti := _sortir_produit(v_produit, 1, 'Cordage : ' || _nom_adherent(c.adherent_id));
      update mouvements set cordage_id = p_cordage
      where produit_id = v_produit and type = 'sortie' and cordage_id is null and vente_id is null and created_at = now();
      if v_sorti < 1 then v_warn := 'Plus de garniture en stock : pensez à réapprovisionner.'; end if;
    end if;
    update cordages set stock_sorti = true where id = p_cordage;
  end if;

  update cordages set
    statut   = p_statut,
    corde_le = case when rang_new >= 2 then coalesce(corde_le, current_date) else null end,
    rendu_le = case when rang_new >= 3 then coalesce(rendu_le, current_date) else null end
  where id = p_cordage;
  return v_warn;
end $$;

-- Import (upsert) de la liste des adhérents d'une saison.
-- p_lignes : tableau JSON d'objets {licence, nom, prenom, sexe, date_naissance (AAAA-MM-JJ), email, telephone, categorie}
-- Correspondance : par licence, sinon par nom + prénom + date de naissance.
create or replace function public.importer_adherents(p_saison text, p_lignes jsonb, p_desactiver_absents boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_id uuid;
  v_vus uuid[] := '{}';
  v_crees int := 0;
  v_maj int := 0;
  v_desac int := 0;
  v_lic text;
  v_nom text;
  v_prenom text;
  v_naiss date;
begin
  if not is_admin() then raise exception 'Import réservé aux administrateurs'; end if;
  if jsonb_typeof(p_lignes) <> 'array' then raise exception 'Format invalide'; end if;

  for r in select * from jsonb_array_elements(p_lignes) loop
    v_lic := nullif(trim(coalesce(r->>'licence', '')), '');
    v_nom := trim(coalesce(r->>'nom', ''));
    v_prenom := trim(coalesce(r->>'prenom', ''));
    v_naiss := nullif(r->>'date_naissance', '')::date;
    continue when v_nom = '';

    v_id := null;
    if v_lic is not null then
      select id into v_id from adherents where licence = v_lic;
    end if;
    if v_id is null then
      select id into v_id from adherents
      where lower(nom) = lower(v_nom) and lower(prenom) = lower(v_prenom)
        and date_naissance is not distinct from v_naiss
        and (licence is null or licence = '' or v_lic is null)
      limit 1;
    end if;

    if v_id is null then
      insert into adherents (licence, nom, prenom, sexe, date_naissance, email, telephone, categorie, saison, actif)
      values (v_lic, v_nom, v_prenom, coalesce(r->>'sexe', ''), v_naiss, coalesce(r->>'email', ''),
              coalesce(r->>'telephone', ''), coalesce(r->>'categorie', ''), coalesce(p_saison, ''), true)
      returning id into v_id;
      v_crees := v_crees + 1;
    else
      update adherents set
        licence = coalesce(v_lic, licence), nom = v_nom, prenom = v_prenom,
        sexe = coalesce(nullif(r->>'sexe', ''), sexe),
        date_naissance = coalesce(v_naiss, date_naissance),
        email = coalesce(nullif(r->>'email', ''), email),
        telephone = coalesce(nullif(r->>'telephone', ''), telephone),
        categorie = coalesce(nullif(r->>'categorie', ''), categorie),
        saison = coalesce(p_saison, saison), actif = true, updated_at = now()
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
    v_vus := v_vus || v_id;
  end loop;

  if p_desactiver_absents then
    update adherents set actif = false, updated_at = now() where actif and not (id = any(v_vus));
    get diagnostics v_desac = row_count;
  end if;

  return jsonb_build_object('crees', v_crees, 'mis_a_jour', v_maj, 'desactives', v_desac);
end $$;

-- ---------------------------------------------------------------------
-- 7. DROITS D'EXÉCUTION
-- ---------------------------------------------------------------------
revoke execute on function public._sortir_produit(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public._nom_adherent(uuid) from public, anon, authenticated;
revoke execute on function public.enregistrer_vente(uuid, uuid, int, numeric, boolean, text, text) from public, anon;
revoke execute on function public.annuler_vente(uuid) from public, anon;
revoke execute on function public.avancer_cordage(uuid, text) from public, anon;
revoke execute on function public.importer_adherents(text, jsonb, boolean) from public, anon;
grant execute on function public.enregistrer_vente(uuid, uuid, int, numeric, boolean, text, text) to authenticated;
grant execute on function public.annuler_vente(uuid) to authenticated;
grant execute on function public.avancer_cordage(uuid, text) to authenticated;
grant execute on function public.importer_adherents(text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8. OFFRES DE CORDAGE PAR DÉFAUT (prix modifiables dans l'appli)
-- ---------------------------------------------------------------------
insert into public.offres_cordage (nom, prix, ordre) values
  ('Cordage club',   15, 1),
  ('Cordage joueur',  5, 2),
  ('Cordage offert',  0, 3)
on conflict (nom) do nothing;

insert into public.categories (nom, couleur, icone, ordre) values
  ('Boutique', '#A855F7', 'shirt', 5)
on conflict (nom) do nothing;
