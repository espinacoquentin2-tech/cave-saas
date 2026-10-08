# Parcours levain et stocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de préparer, qualifier et propager un levain, puis de le prélever dans une mixtion et de tirer celle-ci avec des bilans persistants et des stocks exacts.

**Architecture:** Réutiliser les lots, produits, analyses et événements existants. Les services partagent des helpers de consommation recevant la transaction appelante. Séparer la préparation de la mixtion de sa mise en bouteilles, et garder le planning comme prévision jusqu'à validation d'un geste réel.

**Tech Stack:** Next.js 16.3.8, React 19, TypeScript, Zod 3, Prisma 5/PostgreSQL, authentification Supabase existante, node:test et Playwright.

**Spec:** [Spécification validée par l'utilisateur](../specs/2026-10-08-levains-stock-design.md), complétée par la [revue des PDF](../../levains-document-review.md).

## Global Constraints

- « Aucun nouveau modèle Prisma n'est requis pour cette première révision ; une migration de données automatique des anciens levains n'est pas prévue. »
- « Chaque opération a sa clé UUID d'idempotence. »
- « Une insuffisance ou un conflit concurrent renvoie `409` et annule tout. »
- « Une consommation positive arrondie à zéro est refusée. »
- « Les anciennes formes incomplètes des requêtes de création/nourrissage sont refusées avec un message explicite ; les clients du projet sont mis à jour ensemble. »
- « La mise en bouteilles de vin tranquille garde son parcours actuel. »
- « Le logiciel ne commande pas les équipements et ne déduit pas qu'une intervention a été réalisée du seul calcul de la recette. »
- DAP : `volumeFinal_hL × 20 / 1000` en kg ; dilution : 0,87 à 13 °C, 0,78 à 16 °C, 0,70 à 20 °C ; volume des lots : 0,001 hL.
- Sans annexe initiale, saisir le protocole et les apports réels ; aucun préremplissage des doses/étapes initiales ni qualification automatique après trois jours.
- Travailler sur la branche existante sans supprimer les modifications utilisateur, sans déploiement ni changement des secrets/authentification. Aucun agent de revue indépendant n'est actuellement disponible : le signaler à la recette, sans présenter une revue personnelle comme indépendante.

## Review Focus

1. Vin direct et vin de dissolution issus du même lot : vérifier leur somme avant un seul débit (tâches 2 et 4).
2. Réponse réseau perdue après une écriture réussie : conserver la clé et relire l'état sans reproduire le débit (tâche 6).
3. Levain ancien `ACTIF` ou cuve historiquement nommée Levain : demander une reprise explicite, sans fausse qualification ni redébit des LSA (tâche 3).
4. Dates locales, changement d'heure et week-end : une différence de jours civils doit donner trois journées vendredi→lundi, pas 71/73 heures converties en journées (tâche 1).
5. Route générique de statut ou volume : empêcher de contourner la qualification et son lien à la dernière opération (tâches 1 et 3).

## Carte des fichiers et contrats communs

Les modifications serveur restent dans `server/modules/levains` et `server/modules/tirage`. Les nouveaux fichiers sont introduits avec la fonctionnalité qui les utilise, pas dans une tâche de scaffolding séparée.

- `lib/levain-types.ts` : types partagés des recettes, mesures, états et résultats.
- `lib/levain.ts`, `lib/levain-planning.ts`, `lib/liqueur.ts`, `lib/mixtion.ts` : calculs purs, sans accès au serveur.
- `server/modules/levains/levain-consumption.ts` : débits et liens d'intrants dans une transaction fournie.
- `server/modules/levains/levain-{schemas,repository,service,http}.ts` : validation, lectures/écritures et orchestration ; séparer préparation, qualification et observations dans `levain-preparation.service.ts` et `levain-qualification.service.ts`.
- `server/modules/tirage/mixtion-{schemas,service,http}.ts` : constitution et contrôle de mixtion ; ne pas réactiver l'ancienne API `/api/mixtion/execute` désactivée.
- `components/modules/levains/` : cinq écrans et hook de chargement/opérations, orchestrés par `PlanificateurTirage.tsx`.
- `tests/helpers/levain-fixture.cjs` : fixtures transactionnelles réutilisables pour levain, mixtion et tirage.

Définir les contrats suivants dans `lib/levain-types.ts` en tâche 1 ; les DTO serveur portent ensuite leurs types `z.infer` dans les fichiers de schémas :

- `LevainState = 'LEVAIN_EN_PREPARATION' | 'LEVAIN_PRET' | 'LEVAIN_EN_PROPAGATION' | 'ARCHIVE' | 'A_QUALIFIER'` ; `A_QUALIFIER` est un état de présentation, jamais écrit dans le lot.
- `LiqueurSelection` : union `mode:'PREPARED', productId, sugarGfPerL, alcoholPct` / `mode:'MAKE', sugarProductId, dissolutionLotId, sugarGfPerL, dissolutionWineAlcoholPct`.
- `LevainFeedingParameters` : conserver les six noms actuels, ajouter `previousMeasuredAt`, `currentMeasuredAt`, `nextWithdrawalAt`, `remainingSugarGPerL`, `levainAlcoholPct`, `targetAlcoholPct`, `liqueurAlcoholPct`. Dates ISO avec fuseau ; masse volumique déjà corrigée à 20 °C.
- `LevainFeedingCalculation` : `consumedSugarGPerL`, `projectedConsumedSugarGPerL`, `wineVolumeHl`, `liqueurVolumeHl`, `waterVolumeHl`, `addedVolumeHl`, `dapKg`.
- `LiqueurPreparation` : `volumeHl`, `sugarKg`, `dissolutionWineVolumeHl`, `alcoholPct`.
- `PlannedTirageDay` : `date` au format `YYYY-MM-DD`, `baseWineVolumeHl` ; `LevainPlanningRow` : date, `requiredLevainVolumeHl`, `morningVolumeHl`, `remainingVolumeHl`, `feedingVolumeHl`, `intervalDays`.
- `ExpectedLevainSnapshot` : `lotId`, `volumeHl`, `status`, `lastMutationEventId` ; le dernier événement de mutation est une préparation, qualification, reprise, alimentation ou prélèvement, pas une observation.
- `LevainOperationResult` : conserver `eventId`, `levainLotId`, `levainContainerId`, `levainVolumeHl`, ajouter `state`, `lastMutationEventId` et les bilans structurés. Ne pas supprimer les champs existants encore utilisés avant la mise à jour des clients.

## Tâche 1 : calculs, états et prévisions datées

**Files:** modifier `lib/levain.ts`, `lib/tirage.ts`, `lib/lot-status-transitions.ts`, `services/lots.service.ts`, `tests/levains/calculation.test.cjs` ; créer `lib/levain-types.ts`, `lib/liqueur.ts`, `lib/levain-planning.ts`, `lib/mixtion.ts`, `tests/levains/domain.test.cjs`.

**Interfaces:** produire dans `lib/levain.ts` `calculateLevainFeeding(input:LevainFeedingParameters):LevainFeedingCalculation|null`, `getLevainState(lot:{status:string,qualiteLot:string|null},legacyNamedLevain?:boolean):LevainState|null` et `assertGenericLotMutationAllowed(lot:{status:string,qualiteLot:string|null},operation:'status'|'volume'):void` (erreur métier 409 pour un levain géré). Produire `calculateLiqueurPreparation(volumeHl:number,sugarGfPerL:number,wineAlcoholPct:number):LiqueurPreparation|null` dans `lib/liqueur.ts`, `calculateLevainPlanning(days:PlannedTirageDay[],levainPct:number,temperatureC:13|16|20):LevainPlanningRow[]` dans `lib/levain-planning.ts`, et `calculateMixtionRecipe(input:{baseVolumeHl:number,levainVolumeHl:number,baseSugarGPerL:number,levainSugarGPerL:number,targetSugarGPerL:number,sugarSource:'LIQUEUR'|'SUCRE',liqueurSugarGPerL?:number}):{volumeHl:number,liqueurVolumeHl:number,sugarKg:number}|null` dans `lib/mixtion.ts`.

- [ ] Écrire `DAP_uses_total_final_volume`, `liqueur_tracks_saccharose_and_wine`, `weekend_uses_civil_days`, `legacy_is_not_ready`, `generic_status_cannot_qualify` : assertions 4 hL→0,080 kg ; 1 hL/530 GF/11 %→50 kg et 0,685 hL de vin, TAV 7,535 % ; vendredi→lundi à 16 °C→`0.78 ** 3` ; ancien `ACTIF`→`A_QUALIFIER` ; modification générique vers `LEVAIN_PRET` rejetée.
- [ ] Lancer `node --conditions=react-server --require ./tests/helpers/register-typescript.cjs --test tests/levains/domain.test.cjs` ; constater les échecs correspondant aux contrats non implémentés.
- [ ] Implémenter les signatures et les formules de la spécification. Pour le sucre sec de mixtion, utiliser le bilan GF avec facteur 1,06 et augmentation de 0,63 L/kg. Renseigner la cible GF directement ; le calcul de pression existant reste indicatif tant que sa convention n'est pas confirmée. Faire la différence de dates civiles en UTC à partir des composantes de `YYYY-MM-DD`, indépendamment des changements d'heure.
- [ ] Ajouter les cas consommation sur 23 h projetée sur 24 h, sucre résiduel différent de 20, TAV variables, dates inversées, NaN, eau négative et stock positif sous la précision persistable. Centraliser les états sans permettre leur attribution par la route générique de changement de statut ; protéger aussi la modification générique de volume d'un lot levain.
- [ ] Relancer les tests de calcul ; tous passent. Adapter les six anciens tests aux paramètres désormais explicites, sans conserver les anciennes constantes cachées comme référence.
- [ ] Relire les bilans et proposer un commit limité à ces fichiers après vérification.

## Tâche 2 : consommations atomiques et fixtures réutilisables

**Files:** créer `server/modules/levains/levain-consumption.ts`, `tests/helpers/levain-fixture.cjs`, `tests/levains/consumption.test.cjs` ; modifier `server/modules/levains/levain.repository.ts`, `tests/levains/persistence.test.cjs`.

**Interfaces:** consommer les types tâche 1 et `Prisma.TransactionClient`. Produire `consumeRecipe(tx,actor,eventId,input:{lots:Array<{lotId:number,volumeHl:number,expectedVolumeHl?:number}>,products:Array<{productId:number,quantity:number,unit:string,kind:'LSA'|'SUGAR'|'DAP'|'LIQUEUR'|'OTHER'}>}):Promise<{lotDebits:Array<{lotId:number,volumeHl:number,remainingVolumeHl:number}>,productDebits:Array<{productId:number,quantity:number,unit:string,movementId:number,intrantId:number}>}>`. `actor` est le `RequestActor` existant. Le helper vérifie et débite ; l'appelant crée l'événement et les liens SOURCE/CIBLE, pour éviter de doubler les liens.

- [ ] Extraire la fixture existante sans changer son rollback systématique. Autoriser une liste explicite de repositories à brancher sur les savepoints ; restaurer chacun dans `finally`. Conserver l'exécution séquentielle des tests remplaçant les repositories.
- [ ] Écrire `same_lot_is_debited_once_for_sum`, `units_convert_before_stock_check`, `audit_failure_rolls_back_all`, `foreign_product_is_inaccessible`, `stock_precision_is_not_rounded_up` : vin direct 1 hL + dissolution 0,685 hL débitent 1,685 hL ; 80 g débitent 0,080 kg ; échec tardif laisse volumes, stocks, événements et clés inchangés.
- [ ] Lancer `LEVAIN_TEST_DATABASE=true node --conditions=react-server --require ./tests/helpers/register-typescript.cjs --test tests/levains/consumption.test.cjs` et vérifier les échecs attendus.
- [ ] Implémenter regroupement par identifiant, conversions g/kg et L/hL, accès par organisation, comparaison Decimal exacte et updates gardés. Traiter les ressources dans l'ordre croissant des identifiants. Créer les mouvements OUT et liens intrants dans `tx`, sans réserver une deuxième clé d'idempotence dans le helper.
- [ ] Relancer : PASS, et assertion finale qu'aucune fixture ne reste. Tester aussi une insuffisance portant sur le débit regroupé alors que chaque débit isolé serait disponible.
- [ ] Relire le périmètre transactionnel et préparer le commit de la tâche.

## Tâche 3 : préparation, observations et qualification serveur

**Files:** modifier `server/modules/levains/levain-{schemas,repository,service,http}.ts`, `app/api/levains/route.ts` ; créer `server/modules/levains/levain-preparation.service.ts`, `server/modules/levains/levain-qualification.service.ts`, `app/api/levains/{preparation,qualify,observations}/route.ts`, `tests/levains/lifecycle.test.cjs` ; modifier les anciens tests de persistance.

**Interfaces:** produire `PreparationInput`, `QualifyLevainInput`, `ObservationInput` dans `levain.schemas.ts` ; `LevainService.create`, `prepare`, `qualify`, `observe` prennent le DTO correspondant et l'acteur. Ajouter `LevainRepository.findSnapshot(tx:Prisma.TransactionClient,lotId:number,organizationId:number):Promise<ExpectedLevainSnapshot|null>`, en ordonnant les événements de mutation par ID, pas par date de réalisation saisie. Création : protocole `{reference,text}`, étape `{label,performedAt}`, apports explicites, cuve vide ou nouvelle capacité. Préparation suivante : même étape/apports et `ExpectedLevainSnapshot`. Qualification : snapshot, `protocolCompleted:true`, références d'analyses, mesures et motifs d'absence, `legacyResume` explicite et protocole historique lorsque requis. Observation : lot, date, mesures facultatives ou intervention `AERATION|AGITATION`, commentaires et clé UUID. Retour des mutations : `LevainOperationResult` ; observation : `{eventId:number,analysisId:number|null}`.

- [ ] Écrire `creation_is_not_ready`, `LSA_required_before_first_qualification`, `legacy_resume_does_not_debit_LSA`, `changed_preparation_invalidates_qualification`, `observation_does_not_change_volume` ; contrôler aussi cuve occupée, destination égale à une source et analyses d'une autre organisation.
- [ ] Lancer le fichier `lifecycle.test.cjs` avec le même runner et `LEVAIN_TEST_DATABASE=true` ; FAIL avant implémentation.
- [ ] Implémenter création/étapes avec apports réels : calculer le volume depuis vin, eau, liqueur et augmentation du sucre sec, pas depuis une recette de nourrissage. Créer `LEVAIN_EN_PREPARATION`, conserver protocole/plan en metadata `schemaVersion:2`, puis consommer via la tâche 2. L'introduction LSA peut survenir à une étape ultérieure mais doit exister avant qualification.
- [ ] Implémenter qualification : relire dernier événement de mutation, état et volume ; refuser snapshot périmé ; vérifier LSA/protocole pour une nouvelle préparation ou reprise historique explicitement documentée. Écrire événement et état `LEVAIN_PRET` ensemble. Ne pas reconsommer les stocks historiques.
- [ ] Implémenter observations avec analyses existantes : champs pH/TAV dans `Analysis`, autres mesures dans `extraData`, intervention dans l'événement. Généraliser le handler HTTP avec une table d'opérations, réponses 201/200, validations 400 et conflits 409. Aucune observation ne certifie la disponibilité.
- [ ] Relancer lifecycle et persistance ; conserver les tests de précision 9,9996 hL, rollback et double création, adaptés aux nouveaux DTO. Préparer le commit.

## Tâche 4 : nourrissage avec deux modes de liqueur et stocks

**Files:** modifier `server/modules/levains/levain.schemas.ts`, `server/modules/levains/levain.service.ts`, `app/api/levains/feed/route.ts`, `tests/levains/persistence.test.cjs` ; créer `tests/levains/feeding-stock.test.cjs`.

**Interfaces:** `FeedLevainInput` combine paramètres tâche 1, `ExpectedLevainSnapshot`, vin nourricier, `LiqueurSelection`, `dapProductId`, clé UUID. `LevainService.feed(input,actor):Promise<LevainOperationResult & {calculation:LevainFeedingCalculation}>` utilise le helper tâche 2. Les clients envoient des paramètres et des IDs, jamais des débits à croire sur parole.

- [ ] Écrire `prepared_liqueur_only_debits_liqueur`, `made_liqueur_debits_sugar_and_dissolution_wine`, `DAP_debit_uses_final_volume`, `feed_invalidates_readiness`, `same_source_sum_cannot_overdraw`, `feed_duplicate_key_has_no_second_movement` ; vérifier le bilan vin/liqueur/eau sur les quantités persistées.
- [ ] Lancer `feeding-stock.test.cjs` avec base activée et constater FAIL.
- [ ] Implémenter calcul complet, conversion des stocks et détail des deux vins. Rejeter `LEVAIN_EN_PREPARATION` et les anciens levains non repris. Comparer snapshot, capacité et disponibilités ; persister les apports, les débits et l'état `LEVAIN_EN_PROPAGATION` dans la transaction unique.
- [ ] Adapter le test historique qui attendait zéro mouvement d'inventaire : il doit désormais vérifier les produits réellement débités. Ajouter titres manquants, produit/unités incompatibles, DAP insuffisant, ancien volume et échec de l'audit après les débits.
- [ ] Relancer les tests de calcul et de base : PASS, sans fixtures restantes. Préparer le commit.

## Tâche 5 : mixtion persistante, point de tirage et mise en bouteilles

**Files:** créer `server/modules/tirage/mixtion-{schemas,service,http}.ts`, `app/api/tirage/mixtions/route.ts`, `app/api/tirage/mixtions/check/route.ts`, `tests/levains/mixtion.test.cjs` ; modifier `server/modules/tirage/tirage.{schemas,service,repository}.ts`, `validations/tirage.schema.ts`, `services/tracabilite.service.ts`.

**Interfaces:** `CreateMixtionInput` : vin source et volume, snapshot levain et volume prélevé, destination vide, sucre résiduel de chaque source, concentration cible GF, mode sucre/liqueur, produits/adjuvants explicites et clé UUID. `MixtionService.create(input,actor):Promise<{eventId:number,mixtionLotId:number,mixtionContainerId:number,volumeHl:number}>`. `CheckMixtionInput` : lot, volume/dernier événement attendu, date, masses volumiques vin et mixtion corrigées à 20 °C, `operatorConfirmed:true`, commentaire et clé ; `MixtionService.check(input,actor):Promise<{eventId:number}>`. Le contrôle est une confirmation opérateur documentée, sans seuil de tolérance inventé. Le service de tirage conserve sa signature et consomme le lot mixtion contrôlé.

- [ ] Écrire `mixtion_consumes_ready_levain_and_real_wine`, `unqualified_levain_is_rejected`, `bottling_has_no_second_ingredient_debit`, `bottle_rounding_leaves_remainder`, `unchecked_mixtion_cannot_be_bottled`, `quiet_wine_keeps_existing_flow`, `bottle_genealogy_reaches_wine_and_levain`.
- [ ] Lancer `mixtion.test.cjs` avec la fixture branchant les repositories levain et tirage ; constater FAIL.
- [ ] Implémenter mixtion : calcul partagé tâche 1, consommation tâche 2, liens SOURCE signés négativement et CIBLE positivement, lot `ASSEMBLE`/`MIXTION_TIRAGE`, quantité finale réelle. Un prélèvement partiel conserve `LEVAIN_PRET` ; zéro archive le levain et libère sa cuve. Les adjuvants sont vérifiés par les calculateurs existants.
- [ ] Implémenter contrôle de mixtion et garde avant tirage. Pour un vin effervescent, requérir une mixtion contrôlée ; refuser les recettes de l'ancien parcours qui ne référencent qu'un vin ordinaire. Sur une mixtion, ne prendre que les emballages au tirage et refuser la tentative de retransmettre sucre/levain déjà consommés. `isTranquille:true` conserve le parcours existant.
- [ ] Étendre la généalogie aux événements `PREPARATION_LEVAIN`, `CREATION_MIXTION` et aux liens de tirage, conserver les anciennes notes. Vérifier chaîne bouteille→mixtion→vin/levain, sans doublons ni accès inter-organisations.
- [ ] Relancer les tests : PASS ; contrôle numérique emballages et reliquat avec format 75cl. Préparer le commit.

## Tâche 6 : parcours navigateur, planning et relecture des données

**Files:** créer `components/modules/levains/Levain{Planning,Preparation,Controls,Feeding,Mixtion}Panel.tsx`, `components/modules/levains/useLevainOperations.ts`, `tests/e2e/levain-lifecycle.spec.ts` ; modifier `components/modules/PlanificateurTirage.tsx`, `components/modules/tirage/TirageParametersForm.tsx`, `components/modules/tirage/TirageCreateAction.tsx`, `app/api/levains/route.ts`, `server/modules/levains/levain.repository.ts`, `tests/e2e/levains.spec.ts`, `tests/e2e/access-control.spec.ts`.

**Interfaces:** ajouter `LevainService.list(actor):Promise<{items:Array<{lotId:number,containerId:number|null,state:LevainState,volumeHl:number,lastMutationEventId:number|null,events:unknown[],analyses:unknown[]}>}>` et `GET /api/levains`, accessible en lecture authentifiée et filtré par organisation. Le hook produit `{items,loading,error,refresh,submit}` ; `submit(operation,payload)` utilise les DTO des tâches 3–5 et garde une clé par opération non résolue. Les panneaux prennent les données et callbacks du hook, pas de copie autoritative des volumes.

- [ ] Écrire les scénarios Playwright avec API métier interceptée : préparation→qualification→mixtion→tirage ; nourrissage dans chaque mode→propagation→qualification ; levain ancien→reprise ; stock insuffisant ; perte de réponse après succès avec même UUID à la reprise ; rechargement conservant les données serveur.
- [ ] Lancer les scénarios sur un serveur de recette possédé par l'agent, port 3101 ; constater les échecs dus aux écrans absents. Ne pas effectuer de writes métier distantes depuis les mocks et ne pas arrêter le serveur utilisateur sur 3000.
- [ ] Implémenter GET scoped et cinq panneaux. Champs labelisés, masses volumiques « corrigées à 20 °C », horaires, titres GF/saccharose, TAV, unités, protocole, étapes et motifs d'absence. Afficher les quantités, disponibilités et apports des deux vins ; désactiver une action incomplète et conserver l'erreur serveur visible.
- [ ] Remplacer les anciennes créations et les lignes `LEVAIN consumeStock:false` par le parcours mixtion. Afficher le planning daté en utilisant la tâche 1, les week-ends et le besoin maximal ; enregistrer le snapshot prévisionnel lors de la création, sans modifier les stocks en simulant.
- [ ] Implémenter relecture après succès et conservation de l'UUID si la réponse est inconnue. Sur un 409 « déjà traité » après perte réseau, retrouver dans les événements relus la même `metadata.idempotencyKey` et montrer ce résultat ; ne pas afficher un succès générique pour n'importe quel conflit. Après succès reconnu, réinitialiser la clé pour le prochain geste.
- [ ] Adapter les droits E2E : GET sans session 401, POST des nouvelles routes sans session 401 et lecture seule 403. Ajouter vue mobile pour les champs/CTA principaux et vérifier absence de débordement horizontal empêchant la validation.
- [ ] Relancer les scénarios : PASS. Préparer le commit des clients et routes de lecture.

## Tâche 7 : historique, concurrence réelle et recette complète

**Files:** modifier `components/modules/LotEventMetadataDetails.tsx`, `docs/levains.md`, `docs/launch-readiness.md`, `docs/levains-document-review.md` ; créer `tests/levains/concurrency.test.cjs` ; modifier `tests/helpers/levain-fixture.cjs` pour la fixture dédiée concurrente.

**Interfaces:** les détails reconnaissent `schemaVersion:2`, les anciens événements et tous les nouveaux types. Les résultats de concurrence utilisent les mêmes services et repositories de production, pas les savepoints séquentiels.

- [ ] Écrire une recette concurrente isolée : deux UUID différents nourrissent le même snapshot et les mêmes stocks via deux vraies transactions ; une seule doit réussir, l'autre recevoir 409, et le débit final doit être celui d'une opération. Une fixture temporaire est nécessairement commitée pour être visible aux deux transactions ; nettoyer ses données dans l'ordre des relations dans `finally` et vérifier leur suppression. Ne jamais utiliser des lots/produits existants.
- [ ] Lancer le test concurrent ; constater FAIL si les gardes/conflits ne suffisent pas, puis corriger seulement le chemin responsable. Cette fixture est distincte des tests à rollback et doit être annoncée comme telle dans la documentation.
- [ ] Afficher recettes, produits, mouvements, protocole, contrôles et interventions pour chaque événement, tout en conservant l'affichage des anciennes métadonnées. Mettre à jour les docs : parcours livré, unités, limite du protocole initial, absence de pilotage matériel et garanties/limites des fixtures.
- [ ] Exécuter `LEVAIN_TEST_DATABASE=true npm run test:levains`, `npm run test:security`, le lint ciblé sur les nouveaux fichiers et les modifications serveur, puis `npm run build`. Résultat attendu : aucun échec de test ou build ; les tests de base ne doivent pas être ignorés lors de cette recette.
- [ ] Démarrer le build sur le serveur de recette 3101 et lancer `E2E_BASE_URL=http://localhost:3101 npm run test:e2e -- --project=chrome --workers=1`. Les éventuels skips restent explicitement justifiés ; ne pas confondre scénarios UI mockés et validation SQL.
- [ ] Vérifier `git diff --check`, absence de données de fixture et arrêt du seul serveur de recette. Relire les modifications contre la spécification ; annoncer les résultats observés et la limite de revue indépendante. Préparer le commit final et remettre la livraison complète à l'utilisateur, sans déploiement.

## Auto-relecture du plan

La préparation manuelle, la qualification, la reprise historique et les contrôles sont couverts par la tâche 3 ; les calculs/planning par la tâche 1 ; tous les mouvements par les tâches 2, 4 et 5 ; les cinq écrans et la conservation des UUID par la tâche 6 ; traçabilité, concurrence réelle et recette par les tâches 5 et 7. Les cinq risques du Review Focus ont chacun un test nommé dans la tâche propriétaire.

Les tests avec savepoints prouvent les bilans et rollbacks séquentiels ; ils ne prétendent pas prouver la concurrence. La tâche 7 utilise des transactions réelles pour cette garantie. Les contrats partagés sont définis une seule fois et les DTO exportent leurs types depuis les schémas correspondants.

**Exécution proposée : native dans cette session**, avec les tâches en ordre et les vérifications indiquées. Les interfaces et transactions sont étroitement liées ; aucun outil de sous-agent n'est exposé actuellement. Cette méthode a été validée par l'utilisateur et l'exécution est terminée. Les résultats et limites de vérification sont consignés dans [la recette de lancement](../../launch-readiness.md) et [la documentation levains](../../levains.md). Les modifications restent dans la branche de travail pour relecture et commit.
