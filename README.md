# AASC Manager 🏸

Application de gestion du club **AASC Cléry St-André Badminton**, 100 % gratuite :
front React hébergé sur **GitHub Pages**, données et comptes sur **Supabase** (offre gratuite).

## Modules

| Module | Contenu |
| --- | --- |
| **Stock & Inventaire** | Caisses identifiées par QR code, éléments (désignation, quantité, date d'achat, péremption), scanner, entrées/sorties/transferts, historique, alertes péremption et stock bas, préparation de tournoi selon le nombre de joueurs, liste d'achats, étiquettes QR imprimables |
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
2. *SQL Editor* → coller et exécuter `supabase/migrations/0001_init.sql`.
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
src/modules/admin/   gestion des utilisateurs
supabase/            schéma SQL (tables, RLS, fonctions) et données d'exemple
.github/workflows/   déploiement Pages + keep-alive quotidien
```
