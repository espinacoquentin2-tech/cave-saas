# Donnees demo multi-tenant

Ce jeu de donnees fournit deux espaces realistes et separes pour presenter Ma Cuverie.

Commande de creation ou de verification idempotente:

```bash
ALLOW_DEMO_TENANT_DATA=true node scripts/create-demo-tenant-data.mjs
```

Sans `ALLOW_DEMO_TENANT_DATA=true`, le script s'arrete sans modifier la base.

Le script ne fait aucun reset, aucun reseed, aucune suppression et ne modifie pas `dosage_value`.
Il cree ou reutilise uniquement des donnees prefixees `DEMO-DOMAINE-A` et `DEMO-DOMAINE-B`, avec `organizationId` renseigne pour toutes les tables scopees.

## Organisation A

Nom metier: Domaine des Aulnes.

Prefixe technique: `DEMO-DOMAINE-A`.

Utilisateurs attendus:

- `admin-a@cave.test`
- `chef-a@cave.test`
- `caviste-a@cave.test`
- `lecture-a@cave.test`

Ces utilisateurs applicatifs existent dans `public.users` avec les roles:

- `admin-a@cave.test`: `ADMIN`
- `chef-a@cave.test`: `CHEF_CAVE`
- `caviste-a@cave.test`: `CAVISTE`
- `lecture-a@cave.test`: `LECTURE_SEULE`

Organisation technique: `TEST-ORG-A-CODEX`, slug conserve `test-org-a-codex`.

Chaque utilisateur a exactement un membership vers `TEST-ORG-A-CODEX`.

Parcelles, total metier 15 ha:

- `DEMO-DOMAINE-A-PARCELLE-CRAYERES`: Les Crayeres, Chardonnay, 3.2 ha, Cramant, sol crayeux et maturite precoce.
- `DEMO-DOMAINE-A-PARCELLE-MARNES`: Les Marnes Blanches, Chardonnay, 2.8 ha, Avize.
- `DEMO-DOMAINE-A-PARCELLE-MEUNIER`: Les Pres Meunier, Meunier, 3.5 ha, Venteuil.
- `DEMO-DOMAINE-A-PARCELLE-COTEAU`: Coteau Saint-Vincent, Pinot Noir, 3.0 ha, Ambonnay.
- `DEMO-DOMAINE-A-PARCELLE-VAUX`: Les Vaux Dores, Pinot Noir, 2.5 ha, Bouzy.

Note de schema: le modele `Parcelle` ne contient pas de champs `code`, `cepage`, `surface` ou `notes`. Les lignes sont donc identifiees par un `nom` prefixe et les details metier sont portes par cette documentation et les lots rattaches.

Equipements:

- Pressoir: `DEMO-DOMAINE-A-PRESSOIR-4000 - Pressoir principal`, pneumatique, 4000 kg, disponible.
- Cuves: `DEMO-DOMAINE-A-CUVE-01` a `DEMO-DOMAINE-A-CUVE-10`, inox, capacites 20, 25, 30, 30, 40, 40, 50, 60, 80 et 100 hL.
- Futs: `DEMO-DOMAINE-A-FUT-01` a `DEMO-DOMAINE-A-FUT-03`, chene, 2.28 hL.

Lots:

- `DEMO-DOMAINE-A-CH-CRAYERES-2026`, 18 hL, mout debourbe.
- `DEMO-DOMAINE-A-CH-MARNES-2026`, 22 hL, fermentation alcoolique.
- `DEMO-DOMAINE-A-MEUNIER-PRES-2026`, 27 hL, fermentation alcoolique.
- `DEMO-DOMAINE-A-PN-COTEAU-2026`, 28 hL, vin de base.
- `DEMO-DOMAINE-A-PN-VAUX-2026`, 36 hL, vin de base.
- `DEMO-DOMAINE-A-RESERVE-CH-2025`, 2.1 hL, reserve en fut.
- `DEMO-DOMAINE-A-ASSEMBLAGE-BSA`, 34 hL, assemblage.
- `DEMO-DOMAINE-A-TIRAGE-BASE`, 45 hL, base prete pour tirage.

Produits stock:

- Bouteilles 75 cL, capsules, bidules.
- Sucre de tirage, levures de prise de mousse, bentonite, nutriment FA, SO2, adjuvant de remuage.

Suivi cree:

- 3 analyses.
- 2 degustations.
- 3 releves FA sur le Meunier en fermentation.
- 3 work orders `PENDING`: soutirage, intrant, preparation tirage.
- 1 evenement de lot et 1 audit log si le modele est disponible.

## Organisation B

Nom metier: Clos des Brumes.

Prefixe technique: `DEMO-DOMAINE-B`.

Utilisateurs attendus:

- `admin-b@cave.test`
- `chef-b@cave.test`
- `caviste-b@cave.test`
- `lecture-b@cave.test`

Ces utilisateurs applicatifs existent dans `public.users` avec les roles:

- `admin-b@cave.test`: `ADMIN`
- `chef-b@cave.test`: `CHEF_CAVE`
- `caviste-b@cave.test`: `CAVISTE`
- `lecture-b@cave.test`: `LECTURE_SEULE`

Organisation technique: `TEST-ORG-B-CODEX`, slug conserve `test-org-b-codex`.

Chaque utilisateur a exactement un membership vers `TEST-ORG-B-CODEX`.

Contexte metier: petit domaine de 3 ha, sans pressoir. Les jus arrivent apres pressurage externe.

Parcelles, total metier 3 ha:

- `DEMO-DOMAINE-B-PARCELLE-CLOS`: Le Clos, Chardonnay, 1.2 ha, Hautvillers.
- `DEMO-DOMAINE-B-PARCELLE-ROSERAIE`: La Roseraie, Meunier, 1.0 ha, Damery.
- `DEMO-DOMAINE-B-PARCELLE-NOIRS`: Les Petits Noirs, Pinot Noir, 0.8 ha, Cumieres.

Equipements:

- Aucun pressoir.
- Cuves: `DEMO-DOMAINE-B-CUVE-01` 10 hL et `DEMO-DOMAINE-B-CUVE-02` 15 hL, inox.
- Futs: `DEMO-DOMAINE-B-FUT-01` a `DEMO-DOMAINE-B-FUT-06`, chene, 2.28 hL.

Lots:

- `DEMO-DOMAINE-B-JUS-CH-2026`, 9 hL, mout debourbe, jus recu apres pressurage externe.
- `DEMO-DOMAINE-B-JUS-MEUNIER-2026`, 13 hL, fermentation alcoolique, jus recu apres pressurage externe.
- `DEMO-DOMAINE-B-FUT-PN-2026`, 2 hL, Pinot Noir en fut.
- `DEMO-DOMAINE-B-RESERVE-FUT-2025`, 1.8 hL, reserve en fut.

Produits stock:

- Bouteilles 75 cL, capsules, bidules.
- SO2, nutriment FA, levures, bentonite.

Suivi cree:

- 2 analyses.
- 1 degustation.
- 2 releves FA sur le Meunier.
- 2 work orders `PENDING`: soutirage fut et intrant leger.
- 1 evenement de reception de jus externe et 1 audit log si le modele est disponible.

## Verification

Le script verifie en DB:

- Les organisations A et B sont distinctes.
- Aucun utilisateur trouve en DB n'a plusieurs memberships.
- Aucun pressoir `DEMO-DOMAINE-B` n'existe pour l'organisation B.
- Les donnees A et B ne sont pas melangees.
- Les volumes de lots restent sous les capacites des cuves et futs choisis.
- Les codes globaux sont prefixes et uniques.
- Aucune donnee demo scopee n'est creee sans `organizationId`.

Si `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, les mots de passe E2E admin et un serveur `E2E_BASE_URL` joignable sont disponibles, le script teste aussi:

- `/api/me` pour admin A et admin B.
- Admin A voit `DEMO-DOMAINE-A` sans `DEMO-DOMAINE-B`.
- Admin B voit `DEMO-DOMAINE-B` sans `DEMO-DOMAINE-A`.
- Le header `x-organization-id` force est refuse.

Les mots de passe ne sont jamais affiches.

Les comptes Supabase Auth doivent exister separement de `public.users`; le script Prisma ne cree pas de compte Auth et n'invente aucun mot de passe.

Validation realisee:

- `/api/me` retourne `200` pour les 8 comptes E2E A/B.
- Les comptes A retournent `Domaine des Aulnes` et leur `roleKey` attendu.
- Les comptes B retournent `Clos des Brumes` et leur `roleKey` attendu.
- Les lectures HTTP admin A/B sur lots, contenants, produits et work orders ne melangent pas les prefixes `DEMO-DOMAINE-A` et `DEMO-DOMAINE-B`.
- Un appel avec `x-organization-id` force est refuse en `403`.
- L'UI affiche `Espace : Domaine des Aulnes` pour admin A et `Espace : Clos des Brumes` pour admin B, sans selecteur d'organisation visible.

## Recette A/B Codex du 2026-07-06

Rapport detaille: `docs/codex-tenant-ab-recipe-results.json`.

Run valide: `20260706214807`.

Actions reelles documentees:

- Organisation A: creation API de deux cuves `TEST-A-RUN-CODEX`, d'un produit stock, d'un lot, d'un ordre de travail de soutirage, execution par transfert puis cloture `DONE`.
- Organisation B: meme recette avec le prefixe `TEST-B-RUN-CODEX`.

Runs de mise au point ayant aussi cree des donnees prefixees sans suppression:

- `20260706214149`
- `20260706214243`
- `20260706214444`
- `20260706214527`
- `20260706214651`
- `20260706214807`

Inventaire final des donnees prefixees creees pendant cette recette:

- A: 12 cuves, 12 lots, 6 produits, 6 work orders, tous rattaches a `TEST-ORG-A-CODEX`;
- B: 12 cuves, 12 lots, 6 produits, 6 work orders, tous rattaches a `TEST-ORG-B-CODEX`.

Controles valides:

- les 8 comptes E2E retournent leur organisation unique via `/api/me`;
- `x-organization-id` force est refuse en `403` pour chaque compte;
- les lectures A sur lots, contenants, produits, work orders, analyses, degustations et evenements contiennent A sans B;
- les lectures B contiennent B sans A;
- les mutations `LECTURE_SEULE` sont refusees en `403`;
- 20 tentatives anti-telescopage A vers B et B vers A sont refusees en `403` ou `404`, sans `500` et sans mutation partielle;
- l'UI production affiche l'espace A puis l'espace B, les donnees propres dans Cuverie/Lots, aucun selecteur d'organisation et aucun overlay Next;
- les controles DB finaux ne trouvent aucun objet `TEST-A-RUN-CODEX` dans B, aucun objet `TEST-B-RUN-CODEX` dans A et aucun utilisateur multi-membership.

Le script de recette ne fait aucun reset, aucun reseed, aucune suppression et ne modifie pas `dosage_value`.
