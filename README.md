# TripIsland

Vos voyages à deux : un espace partagé, synchronisé en direct entre vos deux téléphones.

## Nouveautés de la version 0.4 — Globe cosy et coups de cœur
- **Nouveau globe** : une vraie carte du monde en 3D, aux couleurs douces (terre crème, mer sauge). On le tourne et on zoome au doigt ; toucher l'étiquette d'un voyage l'ouvre. Carte gratuite, sans clé.
- **Tes coups de cœur** : dans Idées, la liste de tes ♥ avec l'état de l'autre (en attente, oui, non) et un bouton **Ajouter** pour mettre l'idée tout de suite dans son jour.
- Un match ou un ajout arrive **directement dans le bon jour** du programme.
- **Plus d'appels payants en double** : un seul appel à la fois, même si on tape deux fois.

## Nouveautés de la version 0.3 — Globe, souvenirs et filtres
- **Globe 3D sur l'accueil** : vrais continents en points, vos voyages en couleur, arcs depuis la France, rotation au doigt, toucher un voyage pour y aller.
- **Souvenirs** : ajoutez vos photos à un voyage ; leur lieu GPS et leur date s'affichent sur le globe (points jaunes).
- **Idées filtrées** : choisissez le type (restaurant, street food, randonnée, balade, sortie, bar, shopping…), la ville et le jour **avant** de lancer l'IA. Sans filtre, l'IA mélange tous les types. Une idée « matchée » arrive directement dans le bon jour.

## Nouveautés de la version 0.2 — Voyages et programme
- **Voyages modifiables** : ajouter, renommer, changer les dates et la couleur, supprimer, marquer comme souvenir.
- **Japon** : départ corrigé au **22 février 2027**.
- **Écran du voyage** : tous les jours du voyage, et pour chaque jour les **activités** à ajouter, modifier, déplacer, cocher comme faites ou supprimer. Bouton **Y aller** vers Google Maps.
- **Recherche de lieux réels** (Google) dans l'ajout d'activité.
- **Idées · Match** : l'IA propose 8 idées selon vos goûts, chacun swipe ; quand vous dites oui tous les deux, l'idée arrive dans **« À placer »**.
- Tout est **synchronisé en direct** entre vos deux téléphones.

**Sécurité** : les clés Google et Claude restent côté serveur (secrets Supabase), jamais dans l'app.

## Nouveautés de la version 0.1 — Votre île à deux
- **Connexion** avec Google (ou un lien par e-mail).
- **Créer votre île** et **inviter ta copine** avec un lien ou un code `ISLA-XXXX`. L'écran se met à jour tout seul quand elle rejoint.
- **Vos goûts** : chacun coche les siens ; les **goûts en commun** sont marqués en orange. Ses choix apparaissent **en direct**.
- **Vos voyages** : création du voyage **Japon (17 fév → 11 mars 2027)**, visible chez vous deux.
- **App installable** : sur iPhone, Safari → Partager → « Sur l'écran d'accueil ».

**Sécurité** : aucune clé secrète dans ce dépôt. Chaque donnée n'est lisible que par les deux membres de l'île (règles RLS Supabase).

## Développement
`npm ci` · `npm run dev` · `npm test` · `npm run build`
