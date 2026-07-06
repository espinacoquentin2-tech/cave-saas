# Multi-tenancy Ma Cuverie

## Architecture

Ma Cuverie évolue vers un modèle multi-tenant à base PostgreSQL commune.

La séparation applicative repose sur `organizationId` :

- une table `organizations` représente une entreprise, maison, domaine ou organisation ;
- une table `organization_members` relie les utilisateurs aux organisations ;
- le rôle effectif vient en priorité de `OrganizationMember.roleKey` ;
- `User.roleKey` reste conservé temporairement pour compatibilité V1 ;
- les données métier racines portent un `organization_id`.

## Tables ajoutées

- `organizations`
- `organization_members`

`organization_members` impose une unicité `(organization_id, user_id)`.

## Tables scopées

Les tables métier suivantes reçoivent `organization_id` :

- `containers`
- `lots`
- `analyses`
- `lot_events`
- `bottle_lots`
- `bottle_events`
- `shipments`
- `fa_readings`
- `pressings`
- `Maturation`
- `Parcelle`
- `Degustation`
- `Pressoir`
- `products`
- `stock_movements`
- `audit_logs`
- `work_orders`

Les tables de liaison comme `lot_event_lots`, `lot_event_containers`, `bottle_event_links` et `shipment_lines` restent rattachées via leur parent.

`Place`, `Intrant` et `IdempotencyRecord` restent des tables communes ou techniques dans cette phase.

## Organisation par défaut

La migration crée :

- nom : `Organisation Démo`
- slug : `organisation-demo`
- id : `1`

Toutes les données existantes sont backfillées vers cette organisation.
Tous les utilisateurs existants reçoivent un membership vers cette organisation avec leur `User.roleKey`.

## Authentification

Le contexte backend résout maintenant :

- `userId`
- `email`
- `roleKey`
- `organizationId`
- `organizationSlug`
- `organizationName`

Si l'utilisateur a une seule organisation, elle devient active.
S'il en a plusieurs, le client doit envoyer `x-organization-id` ou `x-organization-slug`.
Une organisation demandée sans membership renvoie `403`.

Le fallback sans membership est limité au non-production et rattache temporairement à `organisation-demo`.

## Règles de scoping

Les routes adaptées suivent ces règles :

- listes : `where: { organizationId }` ;
- création : `organizationId` injecté depuis le contexte backend ;
- mutation : recherche ou `updateMany` avec `id + organizationId` ;
- audit logs : écriture avec `organizationId`.

Le client ne doit pas fournir `organizationId` dans le body pour créer ou modifier des données métier.

## Routes adaptées dans cette phase

- `/api/lots`
- `/api/lots/volume`
- `/api/lots/statuts`
- `/api/lots/intrants`
- `/api/lots/decuvage`
- `/api/lots/assemblage`
- `/api/containers`
- `/api/containers/compartment`
- `/api/events`
- `/api/users`
- `/api/inventory/products`
- `/api/inventory/movements`
- `/api/workorders`
- `/api/workorders/[id]`
- `/api/workorders/[id]/cancel`
- `/api/analyses`
- `/api/degustations`
- `/api/fa`
- `/api/bottles`
- `/api/bottles/status`
- `/api/bottles/degorger`
- `/api/bottles/habiller`
- `/api/bottles/expedier`
- `/api/bottles/archive`
- `/api/bottles/cancel-event`
- `/api/expeditions/vrac`
- `/api/expeditions/confirm-delivery`
- `/api/parcelles`
- `/api/pressoirs`
- `/api/pressings`
- `/api/pressings/cancel`
- `/api/pressings/load`
- `/api/pressings/ecoulement`
- `/api/vendanges/calculate`
- `/api/transfers`
- `/api/tirage`
- `/api/pertes`
- `/api/maturation`
- `/api/tracabilite`
- `/api/mixtion/execute` reste désactivée en `410`

## Opérations complexes adaptées

Les opérations complexes suivantes vérifient désormais les objets avec `id + organizationId` avant mutation et créent les objets enfants avec `organizationId` :

- transferts, soutirage et décuvage ;
- assemblages, y compris sources vrac, sources bouteilles, destination et consommables ;
- intrants et mouvements de stock ;
- tirage direct, lots bouteilles, événements et consommables ;
- changements de statut bouteilles, dégorgement, habillage, expédition, archivage et annulation d'expédition ;
- expéditions vrac et confirmations de livraison ;
- maturation ;
- FA ;
- pertes vrac et bouteilles ;
- pressoir load/ecoulement ;
- workorders, sources, cible lot et cible cuve ;
- traçabilité, parents, enfants, shipments et événements.

## Routes restant à auditer

La recette de sécurité à deux organisations reste à exécuter après application de la migration.
Les anciens services legacy non importés par les routes actives (`services/cuverie.service.ts`, `services/assemblage.service.ts`, `services/tirage.service.ts`) ne sont pas supprimés dans cette phase.

## Frontend

Le frontend affiche l'organisation active dans l'interface.
`buildApiHeaders` envoie `x-organization-id` si l'utilisateur courant possède `organizationId`.

Il n'y a pas encore de sélecteur multi-organisation complet faute d'endpoint de liste des memberships côté client.

## Créer une organisation

Créer une ligne dans `organizations`, puis créer les memberships dans `organization_members`.
Les données métier créées par l'API doivent ensuite être créées depuis une session membre de cette organisation.

## Limites V2

- sélecteur UI multi-organisation ;
- sous-domaines ;
- domaines personnalisés ;
- rôle super admin plateforme ;
- PostgreSQL RLS ;
- contraintes uniques métier composées par organisation, par exemple codes de lot ou de contenant.

## Recette sécurité deux organisations

Recette exécutée le 2026-07-06 avec le script `scripts/multitenancy-security-recipe.mjs`.
Dernier run validé : `20260706133915`.
Le rapport détaillé est disponible dans `docs/multitenancy-recipe-results.json`.

Organisations utilisées :

- `TEST-ORG-A-CODEX`, slug `test-org-a-codex`, id `2`
- `TEST-ORG-B-CODEX`, slug `test-org-b-codex`, id `3`

Memberships créés ou confirmés :

- `admin@cave.fr` ADMIN dans A
- `chef@cave.fr` CHEF_CAVE dans A
- `caviste@cave.fr` CAVISTE dans A
- `admin@cave.fr` ADMIN dans B, pour tester le choix explicite par `x-organization-id`

Résultats validés :

- un utilisateur membre de plusieurs organisations sans header `x-organization-id` reçoit `403` avec un message explicite ;
- lectures A/B isolées sur lots, contenants, produits, workorders, analyses, dégustations et événements ;
- 16 tentatives inter-organisation refusées sans `500` et sans mutation observée ;
- opérations valides confirmées dans A : transfert, intrant, tirage, assemblage, analyse, dégustation, FA, expédition vrac ;
- opérations valides confirmées dans B : transfert, analyse, workorder visible seulement par B ;
- `AuditLog` est écrit avec l'organisation active sur les opérations API testées.

Refus inter-organisation validés :

- modification lot B depuis A ;
- modification cuve B depuis A ;
- modification produit B depuis A ;
- annulation workOrder B depuis A ;
- analyse ou dégustation liée à un lot B depuis A ;
- transfert lot A vers cuve B ;
- assemblage source A + source B ;
- intrant produit B sur lot A ;
- tirage lot A avec produits B ;
- statut ou expédition BottleLot B depuis A ;
- expédition vrac lot B depuis A ;
- confirmation livraison expédition B depuis A ;
- exécution workOrder B depuis A ;
- traçabilité lot B depuis A.

Corrections ciblées issues de la recette :

- `/api/tracabilite` renvoie désormais `404` quand un lot est invisible ou introuvable dans l'organisation active, au lieu de transformer ce cas en `500`.
- Le compteur de codes `TIRAGE-YYYY-NNNN` reste global tant que `bottle_lots.business_code` est unique globalement. Cela évite une collision entre organisations avant la V2 des contraintes uniques composées par organisation.

Commande de déploiement recommandée pour appliquer la migration :

```bash
npx prisma migrate deploy
```

Ne pas utiliser `prisma migrate dev` en production.
