# Préparation du lancement — 8 octobre 2026

## Fonctionnement livré

- Un seul objectif commercial : **Demander une démo**, par email. La connexion reste dans la navigation et le pied de page.
- Titres, descriptions, URL canoniques, Open Graph et image de partage générée par Next.js.
- Favicon Ma Cuverie, icône SVG et icône Apple issus du même dessin vectoriel.
- Sitemap limité à l'accueil et aux documents juridiques. `/app` et `/api/` exclus des robots, et protégés de l'indexation par en-tête ; `/app` porte aussi une métadonnée `noindex`.
- Page 404 française, contrastes corrigés, focus clavier visible et formulaire de connexion avec labels, validation native et gestion des erreurs réseau.
- Navigation connectée repliable sur mobile, fermeture au choix du module et avec Échap ; les tableaux larges restent consultables par défilement dans la zone de contenu.
- Illustrations publiques vectorielles avec descriptions accessibles ; favicon compact et image de partage générée. Aucune photographie volumineuse à recompresser dans cette version.
- Next.js mis à jour en 16.3.8 et dépendances transitives corrigées sans changement majeur.
- Choix de confidentialité accessible partout ; acceptation et refus mémorisés pendant 180 jours et retrait disponible à tout moment.
- Plausible désactivé par défaut. Après activation et accord : visites des pages publiques et clics de demande de démo, sans paramètres d'URL, fragments, referrer ni données de compte/cave. Aucun envoi depuis `/app`.
- Modules base et authentification marqués `server-only`. La configuration Next.js refuse une variable publique manifestement secrète, y compris une clé Supabase privilégiée. La clé Supabase publishable reste publique pour l'authentification du navigateur.
- Redirection HTTP → HTTPS en production derrière un reverse proxy et HSTS. Le serveur local sans reverse proxy reste utilisable en HTTP.

## Configuration de production

```dotenv
SITE_URL=https://macuverie.fr
ANALYTICS_ENABLED=false
ANALYTICS_DOMAIN=macuverie.fr
ANALYTICS_ENDPOINT=https://plausible.io/api/event
```

Renseigner le domaine effectivement retenu dans `SITE_URL`. Pour la mesure d'audience, configurer ce site dans Plausible (hébergé ou auto-hébergé), ajuster l'endpoint et le domaine, puis activer `ANALYTICS_ENABLED=true`. Créer un objectif personnalisé `DemandeDemo` pour visualiser les conversions. Ces valeurs sont lues lors du build : reconstruire après modification. Aucun compte ni abonnement externe n'est créé par le code.

Les requêtes locales (`localhost`, `127.0.0.1`, `::1`) restent en HTTP pour la recette. Le reverse proxy de production doit valider le domaine Host et remplacer `x-forwarded-proto` avec le protocole d'origine fiable. La redirection utilise l'origine configurée plutôt qu'un header Host fourni par le client. HSTS n'est pas préchargé et n'impose pas HTTPS aux sous-domaines.

## Protection des formulaires et anti-spam

L'accueil ne possède pas de formulaire public : le CTA ouvre le client email, sans endpoint à spammer. La connexion utilise Supabase Auth ; les limites de tentatives et, si nécessaire, le CAPTCHA doivent être configurés dans le projet Supabase. Une temporisation côté interface ne constitue pas une protection serveur. Aucun CAPTCHA n'est annoncé comme actif sans vérification de la configuration distante.

Pour un futur formulaire de démo : validation côté serveur, limites de taille, honeypot, limitation distribuée des requêtes et éventuellement CAPTCHA avant toute mise en service.

## Informations encore nécessaires avant publication

- Identité et coordonnées exactes de l'éditeur et de l'hébergeur.
- Bases légales, durées de conservation, clauses contractuelles, sauvegardes et procédures d'incident adaptées à l'exploitation réelle.
- Validation des adresses de contact et de confidentialité.
- Configuration effective du domaine, du reverse proxy et des limites Supabase Auth.
- Si l'analytics est activé : compte Plausible opérationnel et informations de traitement à compléter.

Les pages RGPD et CGU restent des documents de travail tant que ces informations ne sont pas validées. Leur présence ne constitue pas à elle seule une attestation de conformité.

## Vérification

```bash
npm run test:security
npm run test:e2e:launch
npm run test:e2e:ui-v1
npm run test:e2e
npx tsc --noEmit --pretty false
npm run build
```

Pour tester les événements d'audience, lancer un serveur de recette avec `ANALYTICS_ENABLED=true`, puis les tests avec `E2E_ANALYTICS_ENABLED=true`. Le test intercepte les requêtes Plausible pour éviter l'envoi de statistiques réelles. Les identifiants E2E sont chargés depuis l'environnement local sans être imprimés.

## Suite du développement

La finalisation des levains reste un lot métier distinct : rendre persistants les nourrissages et la consommation du lot source, puis vérifier les bilans de volumes. La dette de lint historique du composant principal reste à traiter. L'audit npm complet signale encore cinq alertes hautes dans la chaîne d'outillage ESLint ; l'audit limité à la production ne signale aucune vulnérabilité connue au 8 octobre 2026.

## État de la liste de lancement

| Point demandé | État de ce lot |
| --- | --- |
| RGPD et CGU | Pages présentes et actualisées ; coordonnées et clauses d'exploitation à compléter. |
| Clés API dans le frontend | Garde-fou au build et contrôle des bundles ; seule la clé Supabase publique reste côté navigateur. |
| HTTPS | Redirection 308 et HSTS vérifiés en production locale ; configuration du domaine et du proxy à appliquer sur l'hébergement. |
| Bannière cookies | Refus, acceptation, expiration, retrait et synchronisation entre onglets testés. |
| Meta title, image réseaux, favicon | Métadonnées, image Open Graph, icônes SVG/ICO/Apple livrées. |
| Sitemap et robots | Pages publiques listées ; espace connecté et API exclus de l'indexation. |
| Textes et compression des images | Illustrations SVG accessibles ; pas de photographies lourdes. Icônes compactes. |
| Vitesse | Accueil pré-rendu. Recette locale : chargement 207–397 ms et 136 Kio de scripts ; ces mesures ne représentent pas un réseau mobile ni l'hébergement de production. |
| Contraste | Corrections ciblées du site et du thème connecté ; audit exhaustif des modules encore à effectuer. |
| Responsive | Accueil vérifié à 375/768/1440 px sans débordement global ; navigation connectée mobile adaptée. Certaines vues métier utilisent un défilement horizontal. |
| 404 et liens | Page 404 dédiée ; tous les liens internes de l'accueil répondent 200. Adresses email à confirmer. |
| Validation des formulaires | Connexion native et erreurs réseau corrigées ; validations métier serveur existantes conservées. Audit formulaire par formulaire à poursuivre. |
| Anti-spam | Aucun formulaire public de démo ; protections Supabase Auth à configurer/vérifier sur le service. |
| Analytics | Intégration Plausible conditionnée au consentement, excluant l'espace connecté ; désactivée par défaut, compte à configurer. |
| Un seul CTA | Un objectif commercial répété : demander une démo. |

Recette finale : 11 scénarios E2E réussis sur Chrome et build de production (y compris l'analytics activé sur la recette, avec requêtes interceptées), 5 tests de protection des variables publiques réussis, build et vérification TypeScript réussis. Le lint des fichiers publics/configuration/tests modifiés passe ; le lint global garde sa dette historique. La redirection HTTP, les en-têtes de sécurité, les liens internes, les trois largeurs et l'absence des secrets locaux dans les bundles navigateur ont également été vérifiés. Aucun déploiement ni modification de données métier n'a été effectué.
