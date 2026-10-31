# TripIsland

Vos voyages à deux : un espace partagé, synchronisé en direct entre vos deux téléphones.

## Nouveautés de la version 0.1 — Votre île à deux
- **Connexion** avec Google (ou un lien par e-mail).
- **Créer votre île** et **inviter ta copine** avec un lien ou un code `ISLA-XXXX`. L'écran se met à jour tout seul quand elle rejoint.
- **Vos goûts** : chacun coche les siens ; les **goûts en commun** sont marqués en orange. Ses choix apparaissent **en direct**.
- **Vos voyages** : création du voyage **Japon (17 fév → 11 mars 2027)**, visible chez vous deux.
- **App installable** : sur iPhone, Safari → Partager → « Sur l'écran d'accueil ».

**Sécurité** : aucune clé secrète dans ce dépôt. Chaque donnée n'est lisible que par les deux membres de l'île (règles RLS Supabase).

## Développement
`npm ci` · `npm run dev` · `npm test` · `npm run build`
