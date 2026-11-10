-- =====================================================================
-- AASC Manager — Schéma initial (socle + module Stock & Inventaire)
-- À exécuter dans Supabase > SQL Editor (une seule fois, sur un projet vide)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PROFILS, RÔLES, STATUTS
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nom         text not null default '',
  role        text not null default 'utilisateur' check (role in ('admin','utilisateur')),
  statut      text not null default 'en_attente' check (statut in ('en_attente','actif','desactive')),
  created_at  timestamptz not null default now()
);

-- Helpers utilisés dans toutes les policies (security definer => pas de récursion RLS)
create or replace function public.is_actif() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and statut = 'actif');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and statut = 'actif' and role = 'admin');
$$;

-- Création automatique du profil à l'inscription.
-- Le TOUT PREMIER compte devient automatiquement admin actif ; les suivants sont "en_attente".
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  premier boolean;
begin
  select not exists (select 1 from profiles where role = 'admin') into premier;
  insert into profiles (id, email, nom, role, statut)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nom', split_part(coalesce(new.email,''), '@', 1)),
    case when premier then 'admin' else 'utilisateur' end,
    case when premier then 'actif' else 'en_attente' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde-fou : seul un admin peut changer rôle/statut, et on ne peut pas retirer le dernier admin actif.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.statut is distinct from old.statut
      or new.email is distinct from old.email) then
    -- auth.uid() nul = SQL Editor / service : autorisé
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Seul un administrateur peut modifier le rôle ou le statut.';
    end if;
    if old.role = 'admin' and old.statut = 'actif'
       and (new.role <> 'admin' or new.statut <> 'actif')
       and (select count(*) from profiles where role = 'admin' and statut = 'actif') <= 1 then
      raise exception 'Impossible : il doit rester au moins un administrateur actif.';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles enable row level security;

create policy "profil: lecture soi-même" on public.profiles
  for select using (id = auth.uid());
create policy "profil: lecture membres actifs" on public.profiles
  for select using (public.is_actif());
create policy "profil: modif soi-même" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profil: modif admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. CATALOGUE : catégories, caisses, produits
-- ---------------------------------------------------------------------
create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  nom      text not null unique,
  couleur  text not null default '#EE7D1F',
  icone    text not null default 'package',
  ordre    int  not null default 0
);

create sequence public.caisse_code_seq;

create table public.caisses (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default ('C-' || lpad(nextval('public.caisse_code_seq')::text, 3, '0')),
  nom           text not null,
  categorie_id  uuid references public.categories(id) on delete set null,
  emplacement   text not null default 'Armoire',
  description   text not null default '',
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.produits (
  id            uuid primary key default gen_random_uuid(),
  designation   text not null unique,
  categorie_id  uuid references public.categories(id) on delete set null,
  unite         text not null default 'unité',
  seuil_min     numeric(12,2) not null default 0 check (seuil_min >= 0),
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. LOTS (éléments présents dans une caisse) & MOUVEMENTS (historique)
-- ---------------------------------------------------------------------
create table public.lots (
  id               uuid primary key default gen_random_uuid(),
  caisse_id        uuid not null references public.caisses(id) on delete restrict,
  produit_id       uuid not null references public.produits(id) on delete restrict,
  quantite         numeric(12,2) not null check (quantite >= 0),
  date_achat       date,
  date_peremption  date,
  note             text not null default '',
  created_at       timestamptz not null default now()
);
create index lots_caisse_idx on public.lots(caisse_id);
create index lots_produit_idx on public.lots(produit_id);

-- ---------------------------------------------------------------------
-- 4. TOURNOIS : modèles (quantités par joueur) et préparations
-- ---------------------------------------------------------------------
create table public.modeles_tournoi (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null unique,
  description  text not null default '',
  created_at   timestamptz not null default now()
);

create table public.modeles_tournoi_lignes (
  id              uuid primary key default gen_random_uuid(),
  modele_id       uuid not null references public.modeles_tournoi(id) on delete cascade,
  produit_id      uuid not null references public.produits(id) on delete cascade,
  qte_par_joueur  numeric(12,3) not null default 0 check (qte_par_joueur >= 0),
  qte_fixe        numeric(12,2) not null default 0 check (qte_fixe >= 0),
  unique (modele_id, produit_id)
);

create table public.tournois (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  date        date,
  nb_joueurs  int not null check (nb_joueurs > 0),
  modele_id   uuid references public.modeles_tournoi(id) on delete set null,
  statut      text not null default 'prepa' check (statut in ('prepa','termine')),
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.mouvements (
  id              uuid primary key default gen_random_uuid(),
  lot_id          uuid references public.lots(id) on delete set null,
  produit_id      uuid references public.produits(id) on delete set null,
  caisse_id       uuid references public.caisses(id) on delete set null,
  caisse_dest_id  uuid references public.caisses(id) on delete set null,
  type            text not null check (type in ('entree','sortie','ajustement','transfert')),
  quantite        numeric(12,2) not null,      -- variation signée (+ entrée, - sortie)
  quantite_apres  numeric(12,2),               -- quantité du lot après l'opération
  motif           text not null default '',
  tournoi_id      uuid references public.tournois(id) on delete set null,
  user_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index mouvements_date_idx on public.mouvements(created_at desc);

-- Besoin d'un produit pour un tournoi : fixe + ceil(par_joueur × nb_joueurs)
create or replace function public.besoin_ligne(p_par_joueur numeric, p_fixe numeric, p_nb int)
returns numeric language sql immutable as $$
  select coalesce(p_fixe,0) + ceil(coalesce(p_par_joueur,0) * p_nb);
$$;

-- ---------------------------------------------------------------------
-- 5. RLS du module stock
-- ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.caisses enable row level security;
alter table public.produits enable row level security;
alter table public.lots enable row level security;
alter table public.mouvements enable row level security;
alter table public.modeles_tournoi enable row level security;
alter table public.modeles_tournoi_lignes enable row level security;
alter table public.tournois enable row level security;

-- Lecture : tous les membres actifs
create policy "lecture actifs" on public.categories for select using (public.is_actif());
create policy "lecture actifs" on public.caisses for select using (public.is_actif());
create policy "lecture actifs" on public.produits for select using (public.is_actif());
create policy "lecture actifs" on public.lots for select using (public.is_actif());
create policy "lecture actifs" on public.mouvements for select using (public.is_actif());
create policy "lecture actifs" on public.modeles_tournoi for select using (public.is_actif());
create policy "lecture actifs" on public.modeles_tournoi_lignes for select using (public.is_actif());
create policy "lecture actifs" on public.tournois for select using (public.is_actif());

-- Catalogue & modèles : admin uniquement
create policy "admin écrit" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.caisses for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.produits for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.modeles_tournoi for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.modeles_tournoi_lignes for all using (public.is_admin()) with check (public.is_admin());

-- Lots : édition des infos (dates, note) par les actifs ; quantités via RPC uniquement ; suppression admin
create policy "actifs modifient" on public.lots for update using (public.is_actif()) with check (public.is_actif());
create policy "admin supprime" on public.lots for delete using (public.is_admin());

-- Tournois : préparation par tous les actifs, suppression admin
create policy "actifs créent" on public.tournois for insert with check (public.is_actif());
create policy "actifs modifient" on public.tournois for update using (public.is_actif()) with check (public.is_actif());
create policy "admin supprime" on public.tournois for delete using (public.is_admin());

-- Mouvements : jamais écrits directement (uniquement via les fonctions ci-dessous)

-- Un utilisateur ne peut pas changer la quantité d'un lot par UPDATE direct
create or replace function public.protect_lot_quantite() returns trigger
language plpgsql as $$
begin
  if new.quantite is distinct from old.quantite and current_setting('aasc.rpc', true) is distinct from 'on' then
    raise exception 'La quantité se modifie uniquement via un mouvement.';
  end if;
  return new;
end $$;
create trigger lots_protect_quantite before update on public.lots
  for each row execute function public.protect_lot_quantite();

-- ---------------------------------------------------------------------
-- 6. FONCTIONS MÉTIER (RPC) — atomiques, avec historique
-- ---------------------------------------------------------------------

-- Ajouter un lot dans une caisse (+ mouvement "entree")
create or replace function public.creer_lot(
  p_caisse uuid, p_produit uuid, p_quantite numeric,
  p_date_achat date default null, p_date_peremption date default null, p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;
  insert into lots (caisse_id, produit_id, quantite, date_achat, date_peremption, note)
  values (p_caisse, p_produit, p_quantite, p_date_achat, p_date_peremption, coalesce(p_note,''))
  returning id into v_id;
  insert into mouvements (lot_id, produit_id, caisse_id, type, quantite, quantite_apres, motif)
  values (v_id, p_produit, p_caisse, 'entree', p_quantite, p_quantite, 'Ajout du lot');
  return v_id;
end $$;

-- Entrée / sortie / ajustement sur un lot.
--   entree     : +p_quantite
--   sortie     : -p_quantite (refus si stock insuffisant)
--   ajustement : fixe la quantité à p_quantite (admin uniquement)
-- Un lot qui tombe à 0 est supprimé (l'historique garde produit + caisse).
create or replace function public.enregistrer_mouvement(
  p_lot uuid, p_type text, p_quantite numeric, p_motif text default '', p_tournoi uuid default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  l lots%rowtype;
  v_new numeric;
  v_delta numeric;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if p_type = 'ajustement' and not is_admin() then raise exception 'Ajustement réservé aux administrateurs'; end if;
  if p_quantite is null or p_quantite < 0 or (p_type <> 'ajustement' and p_quantite = 0) then
    raise exception 'Quantité invalide';
  end if;

  select * into l from lots where id = p_lot for update;
  if not found then raise exception 'Lot introuvable'; end if;

  if p_type = 'entree' then v_new := l.quantite + p_quantite;
  elsif p_type = 'sortie' then v_new := l.quantite - p_quantite;
  elsif p_type = 'ajustement' then v_new := p_quantite;
  else raise exception 'Type de mouvement invalide';
  end if;
  if v_new < 0 then raise exception 'Stock insuffisant (disponible : %)', l.quantite; end if;
  v_delta := v_new - l.quantite;

  perform set_config('aasc.rpc', 'on', true);
  if v_new = 0 then
    delete from lots where id = p_lot;
  else
    update lots set quantite = v_new where id = p_lot;
  end if;

  insert into mouvements (lot_id, produit_id, caisse_id, type, quantite, quantite_apres, motif, tournoi_id)
  values (case when v_new = 0 then null else p_lot end, l.produit_id, l.caisse_id, p_type, v_delta, v_new,
          coalesce(p_motif,''), p_tournoi);
  return v_new;
end $$;

-- Transférer tout ou partie d'un lot vers une autre caisse
create or replace function public.transferer_lot(p_lot uuid, p_caisse_dest uuid, p_quantite numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l lots%rowtype;
  v_dest_lot uuid;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  select * into l from lots where id = p_lot for update;
  if not found then raise exception 'Lot introuvable'; end if;
  if l.caisse_id = p_caisse_dest then raise exception 'Caisse de destination identique'; end if;
  if p_quantite is null or p_quantite <= 0 or p_quantite > l.quantite then raise exception 'Quantité invalide'; end if;

  perform set_config('aasc.rpc', 'on', true);
  if p_quantite = l.quantite then
    update lots set caisse_id = p_caisse_dest where id = p_lot;
    v_dest_lot := p_lot;
  else
    update lots set quantite = quantite - p_quantite where id = p_lot;
    insert into lots (caisse_id, produit_id, quantite, date_achat, date_peremption, note)
    values (p_caisse_dest, l.produit_id, p_quantite, l.date_achat, l.date_peremption, l.note)
    returning id into v_dest_lot;
  end if;

  insert into mouvements (lot_id, produit_id, caisse_id, caisse_dest_id, type, quantite, quantite_apres, motif)
  values (v_dest_lot, l.produit_id, l.caisse_id, p_caisse_dest, 'transfert', p_quantite, null, 'Transfert');
  return v_dest_lot;
end $$;

-- Sortir du stock tout le besoin d'un tournoi (lots non périmés, les plus proches de la péremption d'abord).
-- Si le stock est insuffisant, sort ce qui est disponible. Retourne le récapitulatif.
create or replace function public.sortir_tournoi(p_tournoi uuid)
returns table (produit_id uuid, besoin numeric, sorti numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  t tournois%rowtype;
  li record;
  lt record;
  v_reste numeric;
  v_pris numeric;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  select * into t from tournois where id = p_tournoi for update;
  if not found then raise exception 'Tournoi introuvable'; end if;
  if t.statut <> 'prepa' then raise exception 'Ce tournoi a déjà été sorti du stock'; end if;
  if t.modele_id is null then raise exception 'Aucun modèle associé au tournoi'; end if;

  for li in
    select ml.produit_id, besoin_ligne(ml.qte_par_joueur, ml.qte_fixe, t.nb_joueurs) as besoin
    from modeles_tournoi_lignes ml where ml.modele_id = t.modele_id
  loop
    v_reste := li.besoin;
    for lt in
      select l.id, l.quantite from lots l
      where l.produit_id = li.produit_id
        and (l.date_peremption is null or l.date_peremption >= current_date)
      order by l.date_peremption asc nulls last, l.created_at asc
    loop
      exit when v_reste <= 0;
      v_pris := least(v_reste, lt.quantite);
      perform enregistrer_mouvement(lt.id, 'sortie', v_pris, 'Tournoi : ' || t.nom, t.id);
      v_reste := v_reste - v_pris;
    end loop;
    produit_id := li.produit_id; besoin := li.besoin; sorti := li.besoin - greatest(v_reste, 0);
    return next;
  end loop;

  update tournois set statut = 'termine' where id = p_tournoi;
end $$;

-- ---------------------------------------------------------------------
-- 7. VUES (respectent la RLS de l'appelant)
-- ---------------------------------------------------------------------
create view public.v_stock_produit with (security_invoker = true) as
select
  p.id, p.designation, p.categorie_id, p.unite, p.seuil_min, p.actif,
  coalesce(sum(l.quantite) filter (where l.date_peremption is null or l.date_peremption >= current_date), 0) as stock_valide,
  coalesce(sum(l.quantite) filter (where l.date_peremption < current_date), 0) as stock_perime,
  min(l.date_peremption) filter (where l.date_peremption >= current_date) as prochaine_peremption,
  count(l.id) as nb_lots
from public.produits p
left join public.lots l on l.produit_id = p.id
group by p.id;

create view public.v_peremptions with (security_invoker = true) as
select
  l.id as lot_id, l.quantite, l.date_peremption, l.date_achat,
  p.id as produit_id, p.designation, p.unite,
  c.id as caisse_id, c.code as caisse_code, c.nom as caisse_nom,
  (l.date_peremption - current_date) as jours_restants
from public.lots l
join public.produits p on p.id = l.produit_id
join public.caisses c on c.id = l.caisse_id
where l.date_peremption is not null and l.date_peremption <= current_date + 30;

-- ---------------------------------------------------------------------
-- 8. KEEP-ALIVE (appelé chaque jour par GitHub Actions pour éviter la pause du free tier)
-- ---------------------------------------------------------------------
create table public.heartbeat (
  id  bigint generated always as identity primary key,
  at  timestamptz not null default now()
);
alter table public.heartbeat enable row level security;  -- aucune policy : invisible via l'API

create or replace function public.keep_alive() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  insert into heartbeat default values returning at into v;
  delete from heartbeat where id not in (select id from heartbeat order by id desc limit 30);
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 9. DROITS D'EXÉCUTION
-- ---------------------------------------------------------------------
revoke execute on function public.creer_lot(uuid,uuid,numeric,date,date,text) from public, anon;
revoke execute on function public.enregistrer_mouvement(uuid,text,numeric,text,uuid) from public, anon;
revoke execute on function public.transferer_lot(uuid,uuid,numeric) from public, anon;
revoke execute on function public.sortir_tournoi(uuid) from public, anon;
grant execute on function public.creer_lot(uuid,uuid,numeric,date,date,text) to authenticated;
grant execute on function public.enregistrer_mouvement(uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.transferer_lot(uuid,uuid,numeric) to authenticated;
grant execute on function public.sortir_tournoi(uuid) to authenticated;
revoke execute on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

-- Catégories par défaut
insert into public.categories (nom, couleur, icone, ordre) values
  ('Boissons', '#2E7BC4', 'cup-soda', 1),
  ('Matériel', '#EE7D1F', 'dumbbell', 2),
  ('Produits', '#22C55E', 'spray-can', 3),
  ('Autre',    '#94A3B8', 'package', 4);
