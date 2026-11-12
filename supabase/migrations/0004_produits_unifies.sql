-- =====================================================================
-- AASC Manager — 0004 : une seule base « Produits » (stock + boutique)
-- À exécuter dans Supabase › SQL Editor, APRÈS 0003_boutique.sql.
--
-- Avant : les « articles » et leurs « variantes » (Boutique) pointaient vers des produits (Stock).
-- Après : tout est un produit. Un produit vendu a un prix de vente ; un produit décliné
-- en tailles = un produit par taille, regroupés par le champ « modele » (ex. Maillot club),
-- chacun avec son propre stock et son seuil. Les articles existants sont convertis.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Nouveaux champs sur les produits
-- ---------------------------------------------------------------------
alter table public.produits
  add column prix_vente numeric(10,2) check (prix_vente is null or prix_vente >= 0),  -- null = pas vendu
  add column modele     text not null default '',   -- regroupe les tailles d'un même produit
  add column taille     text not null default '',
  add column ordre      int  not null default 0;     -- ordre des tailles (XS, S, M…)
create index produits_modele_idx on public.produits (modele) where modele <> '';

-- La vue de stock expose aussi ces champs (ajoutés en fin de vue)
create or replace view public.v_stock_produit with (security_invoker = true) as
select
  p.id, p.designation, p.categorie_id, p.unite, p.seuil_min, p.actif,
  coalesce(sum(l.quantite) filter (where l.date_peremption is null or l.date_peremption >= current_date), 0) as stock_valide,
  coalesce(sum(l.quantite) filter (where l.date_peremption < current_date), 0) as stock_perime,
  min(l.date_peremption) filter (where l.date_peremption >= current_date) as prochaine_peremption,
  count(l.id) as nb_lots,
  p.prix_vente, p.modele, p.taille, p.ordre
from public.produits p
left join public.lots l on l.produit_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- 2. Conversion des articles existants
-- ---------------------------------------------------------------------
-- Variantes « non suivies en stock » : on leur crée leur produit
insert into public.produits (designation, categorie_id, unite, seuil_min)
select distinct a.nom || case when v.libelle <> '' then ' – ' || v.libelle else '' end,
       (select id from public.categories where nom = 'Boutique'), 'unité', 0
from public.article_variantes v
join public.articles a on a.id = v.article_id
where v.produit_id is null
on conflict (designation) do nothing;

update public.article_variantes v set produit_id = p.id
from public.articles a, public.produits p
where v.produit_id is null and a.id = v.article_id
  and p.designation = a.nom || case when v.libelle <> '' then ' – ' || v.libelle else '' end;

-- Prix, modèle et taille reportés sur les produits
update public.produits p set
  prix_vente = case when a.actif and v.actif then coalesce(v.prix, a.prix) end,
  modele     = case when v.libelle <> '' then a.nom else '' end,
  taille     = v.libelle,
  ordre      = v.ordre,
  -- nom de chaque taille aligné sur le modèle : « Maillot club – M »
  designation = case when v.libelle <> '' then a.nom || ' – ' || v.libelle else p.designation end
from public.article_variantes v
join public.articles a on a.id = v.article_id
where p.id = v.produit_id;

-- ---------------------------------------------------------------------
-- 3. Les ventes pointent directement vers un produit
-- ---------------------------------------------------------------------
alter table public.ventes add column produit_id uuid references public.produits(id) on delete set null;
update public.ventes ve set produit_id = v.produit_id
from public.article_variantes v where v.id = ve.variante_id;
create index ventes_produit_idx on public.ventes(produit_id);

create or replace function public.protect_vente() returns trigger
language plpgsql as $$
begin
  if current_setting('aasc.rpc', true) is distinct from 'on' then
    if new.produit_id is distinct from old.produit_id or new.quantite is distinct from old.quantite
       or new.annulee is distinct from old.annulee or new.adherent_id is distinct from old.adherent_id then
      raise exception 'Pour modifier l''article, la quantité ou l''adhérent, annulez la vente et ressaisissez-la.';
    end if;
    if new.prix_unitaire is distinct from old.prix_unitaire and not public.is_admin() then
      raise exception 'Seul un administrateur peut corriger un prix.';
    end if;
  end if;
  return new;
end $$;

drop function public.enregistrer_vente(uuid, uuid, int, numeric, boolean, text, text);
alter table public.ventes drop column variante_id;

-- Enregistrer une vente à un adhérent : sortie de stock du produit vendu
create or replace function public.enregistrer_vente(
  p_adherent uuid, p_produit uuid, p_quantite int, p_prix numeric default null,
  p_paye boolean default false, p_moyen text default '', p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p produits%rowtype;
  v_prix numeric;
  v_dispo numeric;
  v_id uuid;
begin
  if not is_actif() then raise exception 'Accès refusé'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;
  select * into p from produits where id = p_produit;
  if not found then raise exception 'Produit introuvable'; end if;
  v_prix := coalesce(p_prix, p.prix_vente);
  if v_prix is null then raise exception '« % » n''a pas de prix de vente', p.designation; end if;
  if v_prix < 0 then raise exception 'Prix invalide'; end if;

  select coalesce(sum(quantite), 0) into v_dispo from lots
  where produit_id = p_produit and (date_peremption is null or date_peremption >= current_date);
  if v_dispo < p_quantite then
    raise exception 'Stock insuffisant pour % (disponible : %)', p.designation, v_dispo;
  end if;

  insert into ventes (adherent_id, produit_id, libelle, quantite, prix_unitaire, paye, moyen_paiement, note)
  values (p_adherent, p_produit, p.designation, p_quantite, v_prix, coalesce(p_paye, false),
          case when p_paye then coalesce(p_moyen, '') else '' end, coalesce(p_note, ''))
  returning id into v_id;

  perform _sortir_produit(p_produit, p_quantite, 'Vente : ' || _nom_adherent(p_adherent));
  -- Les mouvements créés dans cette transaction portent now() : on les rattache à la vente
  update mouvements set vente_id = v_id
  where produit_id = p_produit and type = 'sortie' and vente_id is null and created_at = now();
  return v_id;
end $$;

revoke execute on function public.enregistrer_vente(uuid, uuid, int, numeric, boolean, text, text) from public, anon;
grant execute on function public.enregistrer_vente(uuid, uuid, int, numeric, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Les anciennes tables disparaissent
-- ---------------------------------------------------------------------
drop table public.article_variantes;
drop table public.articles;

commit;
