-- =====================================================================
-- AASC Manager — 0005 : type d'événement sur les tournois
-- À exécuter dans Supabase › SQL Editor, APRÈS 0004_produits_unifies.sql.
--
-- Une journée d'interclub reçue au club fonctionne comme un tournoi
-- (date, nombre de personnes, modèle de besoins, checklist, sortie de stock).
-- Le champ « type » permet seulement de les distinguer à l'affichage.
-- =====================================================================
alter table public.tournois
  add column if not exists type text not null default 'tournoi'
  check (type in ('tournoi', 'interclub'));
