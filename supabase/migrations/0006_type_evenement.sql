-- =====================================================================
-- AASC Manager — 0006 : type « événement » (soirée Halloween, repas du club…)
-- À exécuter dans Supabase › SQL Editor, APRÈS 0005_tournoi_type.sql.
-- =====================================================================
alter table public.tournois drop constraint if exists tournois_type_check;
alter table public.tournois add constraint tournois_type_check
  check (type in ('tournoi', 'interclub', 'evenement'));
