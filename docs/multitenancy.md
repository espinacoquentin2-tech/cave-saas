# Multi-tenancy Ma Cuverie

## Décision Produit

Ma Cuverie utilise une base PostgreSQL commune et sépare les données par `organizationId`.

Règle définitive : un utilisateur appartient à une seule organisation. Il n'y a pas de sélecteur multi-organisation, pas de changement d'organisation dans l'UI, et pas de compte rattaché à plusieurs entreprises. Si une personne travaille pour deux entreprises, elle doit utiliser deux comptes distincts.

## Modèle

Les tables `organizations` et `organization_members` sont conservées.

`organization_members` impose :

- unicité `(organization_id, user_id)` ;
- unicité `user_id`, appliquée par la migration `20260706150000_unique_organization_member_user`, pour rendre impossible le multi-membership utilisateur.

Le rôle effectif vient de `OrganizationMember.roleKey`. `User.roleKey` reste présent seulement pour compatibilité temporaire V1.

Les données métier racines portent `organization_id`, notamment `containers`, `lots`, `analyses`, `lot_events`, `bottle_lots`, `bottle_events`, `shipments`, `fa_readings`, `pressings`, `Maturation`, `Parcelle`, `Degustation`, `Pressoir`, `products`, `stock_movements`, `audit_logs` et `work_orders`.

Les tables de liaison restent rattachées via leur parent. `Place`, `Intrant` et `IdempotencyRecord` restent communes ou techniques dans cette phase.

## Contexte Backend

L'organisation active est déduite automatiquement depuis l'utilisateur connecté :

- 1 membership : son `organizationId`, son `roleKey`, `organizationName` et `organizationSlug` sont utilisés ;
- 0 membership : refus clair, sauf fallback de développement déjà existant hors production vers `organisation-demo` ;
- plus de 1 membership : refus avec `Utilisateur rattaché à plusieurs organisations. Configuration non autorisée.`

Le backend refuse les headers `x-organization-id` et `x-organization-slug`. Ils ne permettent jamais de choisir une organisation.

Le client ne doit jamais fournir `organizationId` dans le body pour les opérations métier. Les créations injectent `organizationId` depuis le contexte backend.

## Scoping

Les routes métier suivent les règles suivantes :

- listes : `where: { organizationId }` ;
- détails : vérification par `id + organizationId` ;
- création : `organizationId` injecté depuis l'acteur backend ;
- mutation : recherche ou `updateMany` avec `id + organizationId` ;
- opérations complexes : sources, cibles, produits, lots, cuves et BottleLots doivent appartenir à la même organisation ;
- `AuditLog` et `WorkOrder` sont toujours écrits avec `organizationId`.

Les routes actives auditées incluent notamment `/api/lots`, `/api/lots/statuts`, `/api/lots/volume`, `/api/containers`, `/api/transfers`, `/api/lots/intrants`, `/api/tirage`, `/api/assemblages`, `/api/lots/assemblage`, `/api/workorders`, `/api/bottles`, `/api/expeditions/*`, `/api/analyses`, `/api/degustations`, `/api/fa`, `/api/tracabilite`, `/api/users` et `/api/admin/reset-database`.

## Frontend

Le frontend affiche l'organisation courante comme information : `Espace : Organisation Démo`.

Il ne crée pas de sélecteur d'organisation, ne stocke pas `activeOrganizationId` dans `localStorage`, et n'envoie pas `x-organization-id` ni `x-organization-slug`.

`GET /api/me` renvoie uniquement l'utilisateur courant, son organisation unique et son rôle :

```json
{
  "user": {
    "id": 1,
    "email": "admin@cave.fr"
  },
  "organization": {
    "id": 1,
    "name": "Organisation Démo",
    "slug": "organisation-demo"
  },
  "roleKey": "ADMIN"
}
```

En cas d'erreur de configuration, l'UI affiche un message clair et ne charge pas les données métier comme si l'espace était vide.

## Utilisateurs Et Rôles

`/api/users` liste uniquement les utilisateurs de l'organisation courante. Les administrateurs gèrent les utilisateurs de leur organisation. Il n'y a pas de super admin plateforme dans cette phase.

Pour créer une nouvelle organisation :

1. Créer une ligne dans `organizations`.
2. Créer un utilisateur dans `users` si nécessaire.
3. Créer exactement un membership dans `organization_members` pour cet utilisateur.

Pour une personne qui travaille avec deux entreprises, créer deux comptes utilisateurs distincts, par exemple deux adresses e-mail différentes.

## Reset Développement

Le reset reste réservé au développement et conserve les garde-fous :

- `NODE_ENV === "development"` ;
- `ALLOW_DATABASE_RESET === "true"` ;
- rôle `ADMIN` ;
- confirmation exacte.

Le reset peut rester global en développement. Si les données démo sont recréées, l'organisation démo et les memberships doivent rester cohérents : un utilisateur = une organisation.

## Recette Sécurité

La recette `scripts/multitenancy-security-recipe.mjs` utilise deux organisations :

- `TEST-ORG-A-CODEX` ;
- `TEST-ORG-B-CODEX`.

Elle utilise des comptes distincts :

- `admin-a@cave.test`, `chef-a@cave.test`, `caviste-a@cave.test`, `lecture-a@cave.test` pour A ;
- `admin-b@cave.test`, `chef-b@cave.test`, `caviste-b@cave.test`, `lecture-b@cave.test` pour B.

Si les comptes Supabase n'existent pas, le script n'invente pas les mots de passe. Il documente les comptes à créer ou les variables E2E à fournir.

La recette vérifie :

- A ne voit que les données A ;
- B ne voit que les données B ;
- les lectures et mutations croisées sont refusées sans `500` ;
- les opérations inter-organisation sont refusées sans mutation partielle ;
- un utilisateur sans membership est refusé clairement ;
- un utilisateur avec deux memberships est refusé clairement ;
- `x-organization-id` ne permet aucun contournement.

Diagnostic local du 2026-07-06 avant application de la contrainte unique :

```sql
select user_id, count(*)
from organization_members
group by user_id
having count(*) > 1;
```

Résultat constaté :

```json
[
  { "user_id": 2, "count": 3 },
  { "user_id": 3, "count": 2 },
  { "user_id": 4, "count": 2 }
]
```

La migration d'unicité ne doit pas être appliquée tant que ces doublons ne sont pas corrigés manuellement.

Nettoyage effectué le 2026-07-06 :

- `admin@cave.fr` conserve son membership `Organisation Démo` avec le rôle `ADMIN` ;
- `chef@cave.fr` conserve son membership `Organisation Démo` avec le rôle `CHEF_CAVE` ;
- `caviste@cave.fr` conserve son membership `Organisation Démo` avec le rôle `CAVISTE` ;
- les memberships historiques vers `TEST-ORG-A-CODEX` et `TEST-ORG-B-CODEX` créés par l'ancienne recette multi-organisation ont été retirés ;
- les organisations de test et leurs données métier n'ont pas été supprimées.

Après nettoyage, aucun utilisateur n'a plusieurs memberships et aucun utilisateur existant ne se retrouve sans membership. La migration `20260706150000_unique_organization_member_user` a ensuite été appliquée avec `npx prisma migrate deploy`.

Les comptes E2E actuels sont mono-organisation. Le fichier `docs/multitenancy-recipe-results.json` est un rapport historique d'une phase antérieure qui testait un multi-org technique via header ; il est remplacé par la règle stricte décrite ici.

### Recette A/B stricte du 2026-07-06

Le script `scripts/codex-tenant-ab-recipe.mjs` a ete ajoute pour tester la regle stricte:

- un utilisateur = une organisation;
- aucune selection d'organisation par UI;
- aucun header `x-organization-id` accepte;
- organisation deduite de `/api/me`.

Run valide: `20260706214807`.

Rapport machine: `docs/codex-tenant-ab-recipe-results.json`.

Comptes testes:

- A: `admin-a@cave.test`, `chef-a@cave.test`, `caviste-a@cave.test`, `lecture-a@cave.test`;
- B: `admin-b@cave.test`, `chef-b@cave.test`, `caviste-b@cave.test`, `lecture-b@cave.test`.

Mutations reelles effectuees via API:

- A: deux cuves `TEST-A-RUN-CODEX`, un produit, un lot, un work order de soutirage, un transfert et une cloture `DONE`;
- B: la meme sequence avec `TEST-B-RUN-CODEX`.

Pendant la mise au point du harnais, les runs `20260706214149`, `20260706214243`, `20260706214444`, `20260706214527`, `20260706214651` et `20260706214807` ont cree des donnees prefixees sans suppression. Inventaire final: pour A, 12 cuves, 12 lots, 6 produits et 6 work orders; pour B, 12 cuves, 12 lots, 6 produits et 6 work orders. Les controles DB finaux confirment que ces donnees restent rattachees a la bonne organisation.

Resultats:

- `/api/me` retourne `TEST-ORG-A-CODEX` pour tous les comptes A et `TEST-ORG-B-CODEX` pour tous les comptes B;
- `x-organization-id` force retourne `403` pour chaque compte teste;
- A ne voit pas les donnees `DEMO-DOMAINE-B` ou `TEST-B-RUN-CODEX`;
- B ne voit pas les donnees `DEMO-DOMAINE-A` ou `TEST-A-RUN-CODEX`;
- les taches, evenements, compteurs UI et activites recentes restent separes par organisation;
- les tentatives de modification de lot, contenant, produit, work order et tracabilite de l'autre organisation retournent `403` ou `404`, jamais `200` ni `500`;
- les snapshots DB avant/apres refus restent inchanges;
- l'UI production valide l'espace A puis B, sans selecteur d'organisation, sans donnees croisees visibles dans Cuverie/Lots et sans overlay Next;
- la requete de doublons `organization_members` est vide en fin de recette.

Risque restant: la recette cree des donnees de test prefixees et ne les supprime pas volontairement. Les contraintes uniques metier composees par organisation restent listees en limite V2.

## Limites V2

- super admin plateforme ;
- sous-domaines ;
- domaines personnalisés ;
- PostgreSQL RLS ;
- contraintes uniques métier composées par organisation, par exemple codes de lot ou de contenant.
