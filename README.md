# 🎯 Quiz Live

Une web app de quiz en équipes : les questions s'affichent sur le grand écran, et chaque équipe répond depuis son téléphone après avoir scanné un QR code.

- **3 types de questions** : simple (choix de textes), image (« quelle est la bonne situation ? » : on choisit une image) et musicale (un extrait audio, on choisit le titre).
- **Réponses colorées et numérotées** A / B / C / D… jusqu'à 26 réponses (A à Z), avec la même couleur partout : grand écran, téléphones et console.
- **Réponses sans texte** pour les questions simples : seule la lettre s'affiche, par exemple pour des pastilles A, B, C posées sur une photo d'illustration.
- **Réponse définitive** : une fois validée sur le téléphone, la réponse est verrouillée côté serveur. Pas de retour en arrière possible.
- **Défilement automatique** : une fois le quiz lancé, tout s'enchaîne seul (règles, questions, bonne réponse, compte à rebours, podium final). Les durées se règlent pour chaque quiz : 30 s pour répondre et 15 s entre les questions par défaut.
- **Console admin** : création des quiz, ajout et édition des questions, cases à cocher pour choisir les questions jouées, réordonnancement par glisser-déposer, upload des images et des extraits audio, choix de la bonne réponse, réordonnancement, suppression d'une partie ou de tout l'historique.

## Déroulé d'une partie

1. L'admin ouvre la **console** (`/admin`), choisit un quiz et clique sur **▶ Lancer une partie**.
2. L'**écran de jeu** (`/host/CODE`) affiche un **QR code**. On le projette sur le grand écran.
3. Chaque équipe scanne le QR code, saisit le **nom de son équipe**, puis arrive sur une **page d'attente**.
4. Quand toutes les équipes sont là, l'admin clique sur **🚀 Lancer le quiz**. Ensuite, tout se déroule seul :
   - un **écran des règles** s'affiche (temps de réponse, intervalle, défilement automatique), avec un compte à rebours ;
   - chaque **question** s'affiche sur le grand écran, et les téléphones affichent les boutons A/B/C/D ;
   - à la fin du temps, ou dès que toutes les équipes ont répondu, la **bonne réponse** s'affiche avec un **compte à rebours** jusqu'à la question suivante ;
   - après la dernière question, le **podium** s'affiche sur l'écran, et chaque téléphone affiche le rang de son équipe.

Les durées se règlent dans l'éditeur du quiz, rubrique **Déroulé automatique**. Une question peut aussi avoir son propre temps de réponse (pratique pour un extrait musical).

Pendant la partie, l'admin garde la main : **⏸ Pause** (ou la barre d'espace), **⏭ Passer** (ou la flèche droite) et **Terminer**. Le bouton ⛶ passe en plein écran.

> L'écran de jeu doit rester ouvert pendant la partie : c'est lui qui affiche les questions et fait avancer le déroulé, avec les téléphones.

## Architecture

| Élément | Choix | Pourquoi |
| --- | --- | --- |
| Front + API | **Next.js** (App Router), déployé sur **Vercel** | Gratuit, et un seul projet pour l'écran, les téléphones, la console et l'API |
| Base de données | **Supabase Postgres** | Gratuit, tables relationnelles et contraintes (une seule réponse par équipe et par question) |
| Médias | **Supabase Storage** (bucket public `media`) | Inclus dans le même projet ; l'upload part directement du navigateur, ce qui évite la limite de 4,5 Mo des fonctions Vercel |
| Temps réel | **Supabase Realtime** | Les fonctions Vercel ne peuvent pas garder de WebSocket ouvert : Supabase prévient les écrans à chaque changement, et un rafraîchissement périodique sert de secours |

Sécurité : toutes les lectures et écritures passent par les routes API, avec la clé secrète côté serveur. La bonne réponse n'est jamais envoyée aux téléphones avant la révélation. Le navigateur ne peut lire que la table `games`, qui ne contient aucune donnée sensible et sert uniquement de signal temps réel.

## Installation

### 1. Créer le projet Supabase (gratuit)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Ouvrez **SQL Editor → New query**, collez le contenu de [`supabase/schema.sql`](supabase/schema.sql) et cliquez sur **Run**. Le script crée les tables, la sécurité, la publication temps réel et le bucket `media`.
   **Mise à jour** : après une nouvelle version de l'app, relancez simplement le même script. Il ajoute ce qui manque sans toucher à vos quiz.
3. Dans **Project Settings → API**, récupérez :
   - l'**URL du projet** ;
   - la clé **anon / publishable** (publique) ;
   - la clé **service_role / secret**, à garder secrète.

> Limites du plan gratuit (à vérifier sur supabase.com) : 500 Mo de base de données, 1 Go de stockage, fichiers de 50 Mo maximum. C'est largement suffisant pour des extraits audio de 30 secondes en mp3. Un projet inactif pendant une semaine est mis en pause : il suffit de le relancer depuis le tableau de bord.

### 2. Lancer en local

```bash
cp .env.example .env.local   # puis remplissez les 4 variables
npm install
npm run dev
```

Ouvrez <http://localhost:3000/admin>. Pour tester avec un téléphone sur le même Wi-Fi, ouvrez la console avec l'adresse IP de votre ordinateur (par ex. `http://192.168.1.20:3000/admin`) : le QR code reprend l'adresse utilisée.

### 3. Déployer sur Vercel

1. Poussez le dépôt sur GitHub, puis sur [vercel.com](https://vercel.com) cliquez sur **Add New → Project** et importez le dépôt (Next.js est détecté automatiquement).
2. Dans **Environment Variables**, ajoutez :

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role / secret |
| `ADMIN_PASSWORD` | mot de passe de la console |

3. Cliquez sur **Deploy**. Si vous modifiez une variable `NEXT_PUBLIC_…` plus tard, relancez un déploiement : ces variables sont intégrées au moment du build.

## Structure du code

```
app/
  admin/            console : liste des quiz, éditeur, connexion
  host/[code]/      écran de jeu (grand écran) — réservé à l'admin
  play/[code]/      page téléphone des équipes (cible du QR code)
  api/              routes serveur (admin, inscription, réponses, état de la partie)
components/         HostScreen, PlayerScreen, QuizEditor, MediaUpload…
lib/
  game.ts           calcul de l'état de la partie (scores, classement, réponse masquée)
  useGameState.ts   abonnement temps réel + rafraîchissement de secours + chrono
  validate.ts       validation des questions
supabase/schema.sql schéma de la base, à exécuter une fois
```

## Autres hébergements gratuits possibles

Supabase reste l'option la plus simple, car il regroupe la base, le stockage et le temps réel. Voici les alternatives :

- **Neon** (Postgres) + **Vercel Blob** (médias) : ça fonctionne, mais il n'y a pas de temps réel. Il faudrait ne garder que le rafraîchissement périodique, déjà présent comme secours.
- **Firebase** (Firestore + Storage) : temps réel natif, mais il faudrait réécrire la couche de données.
