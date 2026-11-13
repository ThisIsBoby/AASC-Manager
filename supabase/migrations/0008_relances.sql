-- =====================================================================
-- Relances de paiement : date du dernier e-mail de relance envoyé
-- (renseignée par la fonction Edge « relance-paiements »)
-- =====================================================================
alter table public.ventes   add column if not exists relance_le timestamptz;
alter table public.cordages add column if not exists relance_le timestamptz;
