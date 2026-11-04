# Deux héritages, une même union

Site mobile-first pour les cérémonies traditionnelles d’Anougbre Frédéric et Dukoua You Vanessa — 12 décembre 2026 à 14 h 00, Cocody Angré Mahou près de Laser Park.

## Lancer la démonstration

- Node.js 20.9 ou plus récent et npm sont requis.
- `npm install`
- `npm run dev`, puis ouvrir http://localhost:3000.
- Visiter `/admin` pour modifier l’annonce, le programme, la FAQ et le numéro de contact Refontiq.

La démo ne nécessite aucun compte ou service externe. Les modifications sont conservées dans le `localStorage` du navigateur et peuvent être exportées en JSON depuis `/admin`. Les données ne sont pas synchronisées entre visiteurs, appareils ou navigateurs. L’administration de démonstration n’est pas sécurisée et ne doit pas être utilisée pour publier des modifications en production.

## État des informations

Les décisions non fournies restent marquées « À confirmer ». L’adresse cartographique précise, les étapes du programme, les réponses de logistique et le numéro WhatsApp de Refontiq ne sont pas inventés. Le lien cartographique public est le lien de partage confirmé par les familles, modifiable depuis l’administration. Les couleurs de marque sont le bleu profond #0B2F73, le turquoise #0F7E9B, le sable #F5E7D2 et l’encre #101C2A, reprises du pagne de la dot.

## Architecture prévue pour une activation réelle

La démonstration sépare les types et les données d’amorçage dans `src/lib/content.ts`. Remplacer l’accès au `localStorage` par un dépôt Supabase typé permet de conserver les composants publics et le formulaire admin. Aucun projet, identifiant, secret, schéma, migration ou compte Supabase n’était présent dans l’espace de travail; aucune ressource n’a été créée et aucune migration n’a été exécutée.

Pour la version réelle, créer les tables `site_content` (clé/JSONB/updated_at), `program_items` (id/title/detail/confirmed/sort_order), `faq_items` (id/question/answer/confirmed/sort_order) et un stockage public `event-media` si des médias sont nécessaires. Activer RLS sur toutes les tables. Accorder `SELECT` public uniquement sur les champs de contenu publiables. Restreindre `INSERT`/`UPDATE`/`DELETE` au rôle authentifié des organisateurs, de préférence via une table `admin_users` dont les droits sont vérifiés dans des politiques RLS. Garder la clé `service_role` uniquement dans des fonctions serveur et jamais dans le navigateur. Valider les entrées côté serveur et appliquer une politique de taille/type MIME aux fichiers Storage. Configurer les secrets par l’environnement de déploiement et vérifier les politiques avant toute mise en ligne.

## Déploiement

Compatible avec le déploiement Vercel standard de Next.js. Le déploiement n’est pas effectué. Avant un lancement réel, il faut fournir le numéro WhatsApp Refontiq, confirmer les informations logistiques et de programme, connecter un projet Supabase choisi par le propriétaire et valider l’authentification des organisateurs et les politiques RLS. Ne pas ouvrir `/admin` comme outil de production avant la mise en place de ces contrôles.
