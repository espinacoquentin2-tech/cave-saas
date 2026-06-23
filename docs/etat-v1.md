# Etat V1

Document de synthese de l'etat stable V1 apres l'audit final de stabilite.

## Etat global V1

La V1 est consideree stable pour gel et livraison fonctionnelle.

- Build production OK.
- `npx prisma migrate status` OK, schema base a jour.
- `npx tsc --noEmit --pretty false` OK.
- Routes principales stables.
- Reset dev securise par environnement, variable d'autorisation et role `ADMIN`.
- Seed legacy neutralise.
- Suppressions physiques neutralisees sur les routes exposees.
- Statuts lot et bouteille encadres par whitelist et transitions metier.
- Ordres de travail persistants et relies aux operations metier.

## Flux metier valides

Les flux metier principaux suivants sont valides pour V1 :

- Parcelle -> maturation -> vendanges -> pressurage -> lot mout -> transfert -> FA.
- Ajout direct de lot negoce.
- Assemblage simple.
- Assemblage BSA.
- Assemblage rose.
- Tirage moderne.
- Stock bouteilles : degorgement, habillage, expedition.
- Expedition vrac multi-lignes.
- Ordres de travail.
- Intrants stockes et non stockes.
- Analyses.
- Degustations.

## Ordres de travail

Les ordres de travail V1 sont persistants en base dans `work_orders`.

- Statuts supportes : `PENDING` et `DONE`.
- `executionEvidence` conserve la trace de l'execution metier.
- Les ordres de type soutirage / transvasement appellent `/api/transfers`.
- Les ordres de type intrant appellent `/api/lots/intrants`.
- Les ordres de type tirage appellent `/api/tirage`.
- Les ordres de type assemblage appellent la route assemblage utilisee par l'application.
- Un ordre ne passe pas `DONE` si l'operation metier echoue.

## Expeditions vrac V1

Le flux expedition vrac V1 est base sur les evenements de lot.

- Une expedition cree un `LotEvent` de type `EXPEDITION_VRAC`.
- Les lignes multi-compartiments sont portees par `metadata.lines[]`.
- Les citernes transporteur ne sont pas representees par des `Container`.
- Le nettoyage citerne n'est pas gere dans l'application V1.
- La livraison est portee par `metadata.status` / `deliveryStatus`.
- L'ancien payload mono-ligne reste compatible.

## Intrants

Les intrants V1 distinguent trace process et consommation de stock.

- Intrant libre : creation de `LotEvent`, `LotEventLot` et `LotEventIntrant`.
- Intrant inventaire : meme trace, plus `StockMovement OUT` et decrement de `Product.currentStock`.
- `productId` absent : trace process sans consommation de stock.
- `productId` present : consommation du stock inventaire.
- Stock insuffisant : rejet metier en `409`.

## Suppressions physiques neutralisees

Les suppressions physiques exposees par API sont neutralisees.

- `DELETE /api/bottles` : `405`.
- `DELETE /api/containers` : `405`.
- `DELETE /api/containers/compartment` : `405`.
- `DELETE /api/pressings` : `405`.
- `POST /api/pressings/cancel` remplace la suppression d'un apport par une annulation controlee.
- Le reset dev est le seul flux destructif assume.
- Le reset dev supprime aussi les ordres de travail persistants dans `work_orders`.
- `prisma/seed.js` est neutralise.

## Statuts encadres

### Lots

`/api/lots/statuts` applique une whitelist stricte et limite les transitions manuelles aux changements suivants :

- `MOUT_DEBOURBE -> FERMENTATION_ALCOOLIQUE`.
- `FERMENTATION_ALCOOLIQUE -> FERMENTATION_MALOLACTIQUE`.
- `FERMENTATION_ALCOOLIQUE -> FA_ET_FML`.
- `FERMENTATION_ALCOOLIQUE -> VIN_DE_BASE`.
- `FERMENTATION_MALOLACTIQUE -> VIN_DE_BASE`.
- `FA_ET_FML -> VIN_DE_BASE`.

Les statuts lies aux flux metier aval, par exemple tirage, mise en bouteille et archive, doivent passer par leurs routes dediees.

### Bouteilles

`/api/bottles/status` est limite aux transitions suivantes :

- `SUR_LATTES -> EN_REMUAGE`.
- `EN_REMUAGE -> SUR_POINTES`.

Les changements comme degorgement, habillage, expedition et archive doivent passer par les flux metier dedies.

## Routes legacy documentees

- `/api/lots/assemblage` : alias temporaire de `/api/assemblages`, avec le meme service moderne `AssemblageModuleService.execute`.
- `/api/mixtion/execute` : route legacy desactivee, repond en `410`.
- `services/assemblage.service.ts` : fichier legacy non importe, a supprimer plus tard.
- `services/tirage.service.ts` : fichier legacy non importe, a supprimer plus tard.
- `services/cuverie.service.ts` : fichier legacy non importe, a supprimer plus tard.
- `services/loss.service.ts` : fichier legacy non importe, a supprimer plus tard.

## Reset dev

`/api/admin/reset-database` reste une route tres puissante, assumee uniquement pour le developpement.

Garde-fous V1 :

- Disponible uniquement si `NODE_ENV === "development"`.
- Necessite `ALLOW_DATABASE_RESET=true`.
- Necessite une authentification valide.
- Necessite le role `ADMIN`.
- Payload valide par schema Zod.

Cette route ne doit pas etre exposee comme outil de production.

Les donnees metier reinitialisees incluent notamment `work_orders`; le reseed demo ne recree pas d'ordres de travail par defaut.

## Risques restants

- Smoke UI complet encore a refaire manuellement sur navigateur.
- Services legacy non importes a retirer plus tard.
- Route reset admin tres puissante, dev-only.
- Eventuelle V2 pour `BulkShipment` / `BulkShipmentLine`.
- Archive controlee des lots et contenants a concevoir plus tard.
- Retour ou correction apres livraison a concevoir plus tard.

## Commandes de validation

Commandes de validation de reference pour confirmer l'etat V1 :

```bash
npx prisma generate
npx prisma migrate status
npx tsc --noEmit --pretty false
npm run build
git diff --check
git status --short
```

Dernier audit V1 :

- `npx prisma generate` : OK.
- `npx prisma migrate status` : OK, database schema is up to date.
- `npx tsc --noEmit --pretty false` : OK.
- `npm run build` : OK.
- `git diff --check` : OK.
- `git status --short` : clean avant creation de cette documentation.
