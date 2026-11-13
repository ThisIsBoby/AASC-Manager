-- =====================================================================
-- AASC Manager — 0009 : fiche buvette d'un événement
-- Produits proposés à la buvette, avec leur prix pour cet événement,
-- rangés par rubrique. Sert à imprimer l'affiche (A4 ou A3).
-- À exécuter dans Supabase › SQL Editor, APRÈS 0008_relances.sql.
-- =====================================================================

create table public.buvette_lignes (
  id          uuid primary key default gen_random_uuid(),
  tournoi_id  uuid not null references public.tournois(id) on delete cascade,
  -- Produit du stock d'origine (facultatif : un article libre, ex. « Crêpe maison », n'en a pas)
  produit_id  uuid references public.produits(id) on delete set null,
  libelle     text not null check (length(trim(libelle)) > 0),
  rubrique    text not null default 'sucre' check (rubrique in ('fraiche','chaude','sale','sucre')),
  -- Prix pour cet événement : ne modifie pas le prix de vente du produit
  prix        numeric(10,2) not null default 0 check (prix >= 0),
  ordre       int not null default 0,
  -- Masqué = n'apparaît pas sur l'affiche (rupture, produit pas proposé cette fois)
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index buvette_lignes_tournoi_idx on public.buvette_lignes(tournoi_id);

alter table public.buvette_lignes enable row level security;
-- Comme la checklist : gérée par tous les membres actifs
create policy "actifs gèrent" on public.buvette_lignes for all using (public.is_actif()) with check (public.is_actif());
