-- =====================================================================
-- AASC Manager — 0002 : checklists de préparation des tournois
-- À exécuter dans Supabase › SQL Editor, APRÈS 0001_init.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Modèles de checklist (listes types réutilisables)
-- ---------------------------------------------------------------------
create table public.modeles_checklist (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null unique,
  description  text not null default '',
  created_at   timestamptz not null default now()
);

create table public.modeles_checklist_taches (
  id           uuid primary key default gen_random_uuid(),
  modele_id    uuid not null references public.modeles_checklist(id) on delete cascade,
  libelle      text not null check (length(trim(libelle)) > 0),
  categorie    text not null default '',
  jours_avant  int check (jours_avant is null or jours_avant >= 0),   -- « J-x » par rapport à la date du tournoi
  ordre        int not null default 0
);
create index modeles_checklist_taches_modele_idx on public.modeles_checklist_taches(modele_id);

-- ---------------------------------------------------------------------
-- 2. Tâches d'un tournoi
-- ---------------------------------------------------------------------
create table public.tournoi_taches (
  id              uuid primary key default gen_random_uuid(),
  tournoi_id      uuid not null references public.tournois(id) on delete cascade,
  libelle         text not null check (length(trim(libelle)) > 0),
  categorie       text not null default '',
  echeance        date,
  responsable_id  uuid references public.profiles(id) on delete set null,
  fait            boolean not null default false,
  fait_par        uuid references public.profiles(id) on delete set null,
  fait_le         timestamptz,
  ordre           int not null default 0,
  created_at      timestamptz not null default now()
);
create index tournoi_taches_tournoi_idx on public.tournoi_taches(tournoi_id);

-- « Qui a coché et quand » est renseigné par la base, pas par l'appli
create or replace function public.tournoi_tache_fait() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.fait then new.fait_par := auth.uid(); new.fait_le := now();
    else new.fait_par := null; new.fait_le := null; end if;
  elsif new.fait is distinct from old.fait then
    if new.fait then new.fait_par := auth.uid(); new.fait_le := now();
    else new.fait_par := null; new.fait_le := null; end if;
  else
    new.fait_par := old.fait_par; new.fait_le := old.fait_le;
  end if;
  return new;
end $$;
create trigger tournoi_taches_fait before insert or update on public.tournoi_taches
  for each row execute function public.tournoi_tache_fait();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.modeles_checklist enable row level security;
alter table public.modeles_checklist_taches enable row level security;
alter table public.tournoi_taches enable row level security;

create policy "lecture actifs" on public.modeles_checklist for select using (public.is_actif());
create policy "lecture actifs" on public.modeles_checklist_taches for select using (public.is_actif());
create policy "admin écrit" on public.modeles_checklist for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.modeles_checklist_taches for all using (public.is_admin()) with check (public.is_admin());

-- Les tâches d'un tournoi sont gérées par tous les membres actifs
create policy "actifs gèrent" on public.tournoi_taches for all using (public.is_actif()) with check (public.is_actif());

-- ---------------------------------------------------------------------
-- 4. Copier un modèle de checklist dans un tournoi
-- ---------------------------------------------------------------------
create or replace function public.appliquer_modele_checklist(p_tournoi uuid, p_modele uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  t tournois%rowtype;
  v_base int;
  v_nb int;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  select * into t from tournois where id = p_tournoi;
  if not found then raise exception 'Tournoi introuvable'; end if;
  if not exists (select 1 from modeles_checklist where id = p_modele) then raise exception 'Modèle introuvable'; end if;

  select coalesce(max(ordre), 0) into v_base from tournoi_taches where tournoi_id = p_tournoi;

  insert into tournoi_taches (tournoi_id, libelle, categorie, echeance, ordre)
  select p_tournoi, m.libelle, m.categorie,
         case when t.date is not null and m.jours_avant is not null then t.date - m.jours_avant end,
         v_base + row_number() over (order by m.ordre, m.libelle)
  from modeles_checklist_taches m
  where m.modele_id = p_modele;
  get diagnostics v_nb = row_count;
  return v_nb;
end $$;

revoke execute on function public.appliquer_modele_checklist(uuid, uuid) from public, anon;
grant execute on function public.appliquer_modele_checklist(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Checklist d'exemple
-- ---------------------------------------------------------------------
insert into public.modeles_checklist (nom, description) values
  ('Checklist standard', 'Préparation type d''un tournoi d''une journée')
on conflict (nom) do nothing;

insert into public.modeles_checklist_taches (modele_id, libelle, categorie, jours_avant, ordre)
select m.id, v.libelle, v.categorie, v.jours_avant, v.ordre
from modeles_checklist m
cross join (values
  ('Réserver le gymnase',                 'Logistique',     60, 1),
  ('Déclarer le tournoi à la fédération', 'Administratif',  45, 2),
  ('Contacter le juge-arbitre',           'Administratif',  45, 3),
  ('Diffuser les affiches et l''invitation', 'Communication', 30, 4),
  ('Commander les récompenses',           'Logistique',     21, 5),
  ('Réserver la sono',                    'Logistique',     14, 6),
  ('Organiser les bénévoles (planning)',  'Bénévoles',      10, 7),
  ('Faire les courses de la buvette',     'Buvette',         3, 8),
  ('Préparer la caisse (fond de caisse)', 'Buvette',         1, 9),
  ('Installer les terrains et la table de marque', 'Logistique', 0, 10)
) as v(libelle, categorie, jours_avant, ordre)
where m.nom = 'Checklist standard'
  and not exists (select 1 from modeles_checklist_taches x where x.modele_id = m.id);
