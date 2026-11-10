-- Données d'exemple (optionnel) — à exécuter APRÈS 0001_init.sql dans le SQL Editor
insert into public.produits (designation, categorie_id, unite, seuil_min) values
  ('Volants plume (tube de 12)',     (select id from categories where nom='Matériel'), 'tube', 10),
  ('Volants plastique (tube de 6)',  (select id from categories where nom='Matériel'), 'tube', 5),
  ('Grip',                           (select id from categories where nom='Matériel'), 'unité', 10),
  ('Eau 50 cl',                      (select id from categories where nom='Boissons'), 'bouteille', 24),
  ('Soda canette 33 cl',             (select id from categories where nom='Boissons'), 'canette', 24),
  ('Café dosettes',                  (select id from categories where nom='Boissons'), 'dosette', 50),
  ('Barres de céréales',             (select id from categories where nom='Autre'),    'unité', 20),
  ('Gobelets',                       (select id from categories where nom='Produits'), 'unité', 100),
  ('Gel hydroalcoolique',            (select id from categories where nom='Produits'), 'flacon', 2)
on conflict (designation) do nothing;

insert into public.caisses (nom, categorie_id, emplacement, description) values
  ('Boissons fraîches', (select id from categories where nom='Boissons'), 'Armoire - étagère haute', 'Eau et sodas'),
  ('Volants',           (select id from categories where nom='Matériel'), 'Armoire - étagère milieu', 'Tubes de volants'),
  ('Buvette',           (select id from categories where nom='Autre'),    'Armoire - bas', 'Café, gobelets, barres');

insert into public.modeles_tournoi (nom, description) values
  ('Tournoi standard', 'Besoins types pour un tournoi d''une journée');

insert into public.modeles_tournoi_lignes (modele_id, produit_id, qte_par_joueur, qte_fixe)
select m.id, p.id, v.par_joueur, v.fixe
from modeles_tournoi m
cross join (values
  ('Volants plume (tube de 12)', 0.25, 4),
  ('Eau 50 cl',                  2,    10),
  ('Soda canette 33 cl',         0.5,  0),
  ('Café dosettes',              0.5,  20),
  ('Barres de céréales',         1,    0),
  ('Gobelets',                   1,    30)
) as v(designation, par_joueur, fixe)
join produits p on p.designation = v.designation
where m.nom = 'Tournoi standard';
