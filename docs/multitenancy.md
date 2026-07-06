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
