# AASC Manager 🏸

Application de gestion du club **AASC Cléry St-André Badminton**, 100 % gratuite :
front React hébergé sur **GitHub Pages**, données et comptes sur **Supabase** (offre gratuite).

## Modules

| Module | Contenu |
| --- | --- |
| **Stock & Inventaire** | Caisses identifiées par QR code, éléments (désignation, quantité, date d'achat, péremption), scanner, entrées/sorties/transferts, historique, alertes péremption et stock bas, préparation de tournoi selon le nombre de joueurs, liste d'achats, étiquettes QR imprimables |
| **Boutique & Cordage** | Saisie des ventes aux adhérents (tubes de volants, vêtements par taille…) et des demandes de cordage (offres club / joueur / offert, suivi Déposée → Cordée → Rendue), prix paramétrables, suivi des paiements (moyen, impayés). Les articles sont des produits du stock : une vente sort la quantité du stock |
| **Adhérents** | Liste des licenciés, fiche avec achats / cordages / reste à payer, import CSV à chaque saison |
| **Administration** | Validation des demandes d'accès, rôles admin / utilisateur, désactivation de comptes |

Ajouter un module : créer `src/modules/<nom>/index.tsx` (navigation + routes) et l'ajouter à la liste dans `src/core/modules.tsx`.

## Rôles

- **Utilisateur** : consulter le stock, scanner, sortir/ajouter des quantités, ajouter des éléments, transférer, préparer un tournoi, voir les achats à faire.
- **Administrateur** : tout cela + gérer caisses, produits, seuils, modèles de tournoi, ajustements d'inventaire, suppressions et comptes utilisateurs.

Un nouvel inscrit est **en attente** jusqu'à validation par un admin. **Le tout premier compte créé devient automatiquement administrateur.**
Les droits sont appliqués dans la base (Row Level Security), pas seulement dans l'interface.

---

## Mise en place (une seule fois)

### 1. Supabase
1. Créer un compte sur <https://supabase.com> puis un **nouveau projet** (région Europe).
2. *SQL Editor* → coller et exécuter `supabase/migrations/0001_init.sql`, puis `supabase/migrations/0002_checklist.sql` (checklists de tournoi), puis `supabase/migrations/0003_boutique.sql` (adhérents, boutique, cordage), puis `supabase/migrations/0004_produits_unifies.sql` (une seule base Produits pour le stock et la boutique), puis `supabase/migrations/0005_tournoi_type.sql` (type Tournoi / Interclub), puis `supabase/migrations/0006_type_evenement.sql` (type Événement), puis `supabase/migrations/0007_inventaire.sql` (inventaires : comptage des caisses et écarts), puis `supabase/migrations/0008_relances.sql` (date de relance des impayés).
3. (Optionnel) exécuter `supabase/seed.sql` pour des produits, caisses et un modèle de tournoi d'exemple.
4. *Authentication → URL Configuration* :
   - **Site URL** : `https://<votre-compte>.github.io/<nom-du-depot>/`
   - **Redirect URLs** : ajouter la même URL + `http://localhost:5173/`
5. *Project Settings → API* : noter **Project URL** et la clé **anon public**.

### 2. En local
```bash
npm install
```
Copier `.env.example` en `.env.local` et y mettre l'URL et la clé anon, puis :
```bash
npm run dev
```
Ouvrir <http://localhost:5173>, cliquer « Demander un accès » : ce premier compte sera **admin**.

### 3. GitHub Pages
1. Pousser le dépôt sur GitHub (dépôt **public** pour Pages gratuit).
2. *Settings → Secrets and variables → Actions* : créer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. *Settings → Pages* : Source = **GitHub Actions**.
4. Chaque push sur `main` déploie automatiquement (workflow `deploy.yml`).

> La clé *anon* est publique par conception ; la sécurité repose sur les règles RLS de la base.
> Ne mettez **jamais** la clé `service_role` dans le front ni dans les secrets du workflow.

### 4. Anti-mise en pause Supabase
Le projet gratuit se met en pause après 7 jours sans activité. Le workflow `keep-alive.yml`
appelle chaque jour la fonction `keep_alive()` (elle écrit une ligne dans la table `heartbeat`).
- Lancement manuel : onglet *Actions → Supabase keep-alive → Run workflow*.
- Si le workflow échoue, GitHub vous envoie un e-mail : vérifiez que le projet Supabase n'est pas en pause.
- GitHub désactive les workflows planifiés d'un dépôt public après **60 jours sans commit** :
  réactivez-le d'un clic dans l'onglet *Actions* (ou faites un commit).

### 5. Relances des impayés par e-mail (optionnel)
Dans *Boutique → Ventes*, le filtre « À payer » regroupe les impayés (ventes + cordages) **par adhérent**, avec un bouton
**Relancer** par personne ; « Relancer les impayés » envoie la relance à tous en une fois. Chaque adhérent reçoit **un seul
e-mail** récapitulant tout ce qu'il doit, et la date de relance est enregistrée. L'envoi passe par
la fonction Edge `supabase/functions/relance-paiements` et le service [Resend](https://resend.com) (offre gratuite : 3 000 mails/mois).
1. Créer un compte Resend, **vérifier un domaine** (sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte) et créer une clé API.
2. Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :
   ```bash
   supabase login
   supabase link --project-ref <ref-du-projet>
   supabase functions deploy relance-paiements
   supabase secrets set RESEND_API_KEY=re_xxx RELANCE_FROM="AASC Badminton <relances@mondomaine.fr>" RELANCE_REPLY_TO=tresorier@mondomaine.fr
   ```
   (`RELANCE_REPLY_TO` est facultatif : adresse qui reçoit les réponses des adhérents.)
3. Seuls les comptes **actifs** peuvent déclencher une relance (vérifié dans la fonction). Les adhérents sans e-mail sur leur fiche sont ignorés.

---

## QR codes
Chaque caisse reçoit un code (`C-001`…) et un QR qui contient l'URL de sa fiche
(`…/#/stock/caisse/<id>`). Scanné avec l'appareil photo d'un téléphone, il ouvre directement la caisse
(après connexion). Le scanner intégré et la saisie manuelle du code fonctionnent aussi.
Les étiquettes s'impriment depuis *Étiquettes QR* (A4, 2 par ligne).

## Préparation de tournoi
Un **modèle** liste pour chaque produit une *quantité fixe* et une *quantité par joueur*.
Besoin = fixe + arrondi supérieur(par joueur × nb joueurs). La page du tournoi compare au stock non périmé
et peut **sortir du stock** les quantités (lots les plus proches de la péremption d'abord).
*Achats à faire* = seuil minimum + besoins des tournois en préparation − stock non périmé.

## Boutique, cordage et adhérents
- **Une seule base : Stock › Produits.** Stock, seuil, prix de vente et tailles se gèrent au même endroit.
  Un produit qui a un **prix de vente** est proposé à la vente (vide = pas vendu). Un produit peut exister en **variantes** (tailles, parfums, couleurs…)
  (ex. « Maillot club » XS…XL, « Barres de céréales » Lion, Snickers…) : chaque variante a son propre stock et son seuil, le nom, la catégorie et le prix sont communs.
  Pour un stock « hors caisse » (réserve de tubes), créez une caisse dédiée, ex. *Réserve boutique*.
- **Vente** : adhérent → produit → variante → quantité ; le prix est pré-rempli (modifiable), la quantité sort du stock
  (lots non périmés les plus anciens d'abord). Un admin peut annuler une vente : le stock est remis dans les caisses d'origine.
- **Cordage** : offres paramétrables dans *Cordages › Offres* (par défaut club 15 €, joueur 5 €, offert 0 €). L'offre club peut être liée à un produit
  « garniture » : 1 garniture sort du stock quand la raquette passe à *Cordée*.
- **Paiements** : chaque vente / cordage est *payé* (espèces, chèque ou virement) ou *à payer* ;
  le reste dû apparaît sur la fiche adhérent et le tableau de bord.
- **Import CSV des adhérents** (admin, *Adhérents › Import CSV*) : fichier avec une ligne d'en-tête, séparateur `;` ou `,`,
  UTF-8 ou Windows-1252 (Excel). Colonnes reconnues automatiquement (modifiables) : N° de licence, Nom, Prénom, Sexe,
  Date de naissance (jj/mm/aaaa), E-mail, Téléphone, Catégorie. Les fiches existantes sont mises à jour (par licence,
  sinon nom + prénom + naissance) ; les absents du fichier peuvent passer en « anciens » sans perdre leur historique.
  Ne versionnez jamais ce fichier (données personnelles).

## Commandes
| | |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm test` | tests unitaires (calculs besoins / achats / péremption / QR) |
| `npm run build` | build de production (`dist/`) |

## Structure
```
src/core/            socle : client Supabase, auth, layout, composants UI, registre des modules
src/modules/stock/   module Stock & Inventaire (api, logique, pages)
src/modules/boutique/  module Boutique & Cordage (ventes, cordages, offres)
src/modules/adherents/ liste des adhérents et import CSV
src/modules/admin/   gestion des utilisateurs
supabase/            schéma SQL (tables, RLS, fonctions) et données d'exemple
.github/workflows/   déploiement Pages + keep-alive quotidien
```
