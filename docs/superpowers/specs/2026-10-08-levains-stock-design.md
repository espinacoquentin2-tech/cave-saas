# Révision du parcours levain et raccordement aux stocks

## Statut et objectif

Spécification proposée le 8 octobre 2026, à relire avant le plan d'implémentation. L'utilisateur a approuvé la révision issue de la [revue documentaire](../../levains-document-review.md), les deux modes de liqueur et le DAP à 20 g/hL. Ce document concrétise ces choix ; il ne prétend pas que le logiciel ou le protocole initial sont déjà modifiés.

Le caviste doit pouvoir préparer un levain, enregistrer ses contrôles, le prélever pour une mixtion et nourrir ce qui reste. Chaque opération doit produire des volumes et des stocks réels, cohérents et traçables. Le planning représente les besoins prévisionnels ; seuls les gestes validés entraînent des mouvements.

Les PDF fournis restent les références métier pour la propagation. Leur annexe de préparation initiale est absente. L'application permettra donc d'enregistrer un protocole et une recette renseignés par l'opérateur, sans préremplir une recette de remise en activité prétendument validée par ces PDF.

## Choix d'architecture

Trois approches ont été examinées :

- Raccorder seulement les produits au nourrissage : modification plus courte, mais laisse la préparation initiale et les prélèvements au tirage incomplets.
- Faire évoluer les lots, événements et inventaires existants : couvre les opérations identifiées sans créer un second stock de levain. **Approche retenue dans cette proposition.**
- Créer un système séparé de gestion de ferments : plus de tables, de synchronisation et d'écrans que nécessaire pour ce chantier.

Les lots sont la référence pour les volumes de vin, de levain et de mixtion. Les produits restent la référence pour les stocks d'intrants et de liqueur préparée. Les événements conservent les recettes, les mesures, les mouvements associés et l'opérateur. La liqueur fabriquée à la demande sera entièrement utilisée dans la même opération ; la fabrication de liqueur pour constituer un stock intermédiaire est hors de cette révision.

## Parcours et écrans

Le planificateur expose cinq étapes : **Planning**, **Préparation**, **Contrôles**, **Nourrissage**, **Mixtion et tirage**. Les fonctions seront extraites en composants spécialisés pour limiter l'extension du composant actuel.

### Planning

Les lignes ont une date et un volume de vin prévu. Le pourcentage de levain et la température permettent de calculer les besoins à rebours. Utiliser les coefficients documentés : 0,87 à 13 °C, 0,78 à 16 °C, 0,70 à 20 °C. Pour un intervalle de plusieurs journées, appliquer le coefficient à la puissance du nombre de journées : trois journées entre les alimentations du vendredi et du lundi donnent le cube.

La campagne peut se terminer par épuisement du levain ou inclure la semaine suivante dans le même planning. Les jours sans tirage ne doivent pas être confondus avec une fin de campagne. Les besoins, la durée d'arrêt et le besoin maximal de capacité sont affichés. Les dates et hypothèses sont conservées dans l'événement de constitution du levain ; modifier une simulation ne modifie aucun volume en base. La préparation en trois jours est indiquée comme repère documentaire, sans déclencher automatiquement des étapes ou déclarer le levain prêt.

### Préparation initiale

Choisir le vin source et une cuve disponible, ou créer une cuve avec une capacité explicite. La destination doit être vide et ne pas être une source de la recette. Enregistrer la référence et le texte du protocole retenu, sa première étape et les quantités réellement introduites : vin, eau éventuelle, liqueur ou sucre et produits de préparation.

Les quantités de préparation sont saisies ; elles ne sont pas déduites de la formule de nourrissage d'une mère déjà constituée. Chaque étape validée consomme les volumes/produits correspondants et produit un événement. Les LSA sont sélectionnées dans l'inventaire et leur introduction doit être tracée avant une première qualification. Les étapes suivantes permettent de consigner les apports supplémentaires et les observations. Le protocole et ses étapes réalisées sont conservés avec le levain.

### Contrôles et qualification

Afficher le volume réel et l'historique des apports. Enregistrer la date, la température, les masses volumiques corrigées à 20 °C, le TAV, le sucre résiduel, le pH et, lorsqu'elle est disponible, la population levurienne. Les analyses existantes servent de support aux résultats ; les événements portent les observations, l'aération et l'agitation.

Une action explicite de qualification, avec confirmation du protocole réalisé, rend le levain disponible pour le tirage. La fiche présente les repères documentaires de propagation (50–60 millions de cellules/mL, sucre résiduel voisin de 20 g/L et maîtrise de l'alcool). Ces repères ne deviennent pas une certification automatique. Si une mesure n'est pas disponible, l'opérateur renseigne le motif dans sa validation ; aucune mesure n'est inventée. La qualification référence la dernière étape/apport et les contrôles utilisés.

### Nourrissage

Choisir un levain qualifié ou en propagation, son vin nourricier et le volume final. Le volume restant est relu en base et fourni comme valeur attendue, afin de refuser une recette calculée avant un autre mouvement.

La prévisualisation présente séparément le vin direct, le vin de dissolution éventuel, la liqueur, l'eau, le sucre et le DAP, avec les disponibilités et le reste après opération. Toute quantité positive à consommer nécessite un produit ou un lot sélectionné. Les détails de produits, unités, titres et quantités sont figés dans l'événement. Une validation de nourrissage place le levain en propagation ; un nouveau contrôle et une qualification de l'opérateur permettent le prochain prélèvement.

L'aération et l'agitation sont enregistrées comme interventions manuelles, avec horaires et observations. Le logiciel ne commande pas les équipements et ne déduit pas qu'une intervention a été réalisée du seul calcul de la recette.

### Mixtion puis tirage

Préparer la mixtion en choisissant un lot de vin, un levain qualifié, une cuve de destination vide et les apports de sucre/liqueur/adjuvants. La recette utilise le sucre résiduel du vin et du levain renseignés. Les titres en saccharose et en glucose-fructose sont distingués.

La validation débite les sources et les intrants et constitue un lot `ASSEMBLE`, repéré `MIXTION_TIRAGE`, avec le volume réellement obtenu. Elle conserve ses liens au vin et au levain. Le point de tirage mesuré après homogénéisation est enregistré avant la mise en bouteilles. Le calcul de pression actuel doit être rapproché des unités et du tableau de la partie 1 avant de servir de validation automatique ; la valeur mesurée et la recette restent explicites.

La mise en bouteilles utilise ensuite le lot mixtion comme source du service de tirage existant. Elle consomme son volume réel et le conditionnement. Les intrants et le levain consommés à la préparation ne sont pas débités une deuxième fois. Le reliquat demeure dans le lot mixtion. Cette séparation corrige le risque de double comptage qui apparaîtrait en ajoutant un prélèvement de levain au débit actuel du vin égal au volume embouteillé.

## États et modèle de données

Conserver `qualiteLot: LEVAIN`. Centraliser les états suivants dans les validations et sélecteurs, en utilisant le champ `Lot.status` existant, de type texte :

| État métier | Valeur technique | Actions autorisées |
| --- | --- | --- |
| En préparation | `LEVAIN_EN_PREPARATION` | Étapes de préparation, contrôles, première qualification |
| Prêt | `LEVAIN_PRET` | Prélèvement vers une mixtion, contrôles, nourrissage |
| En propagation | `LEVAIN_EN_PROPAGATION` | Suivi, qualification, nourrissage |
| Épuisé | `ARCHIVE` avec volume nul | Consultation de l'historique |

Un prélèvement partiel conserve la qualification du volume restant ; un nourrissage la rend caduque. Chaque mise à jour du volume ou de l'état compare les valeurs attendues pour empêcher une qualification ou une recette devenues obsolètes. Un levain ne doit jamais apparaître comme vin de base ordinaire dans les sélecteurs.

Les anciens lots `ACTIF` repérés levain sont présentés comme **à qualifier**. Ils gardent leur volume et leur historique ; ils ne sont pas automatiquement marqués prêts. Une reprise explicite permet de renseigner le protocole historique et les contrôles de qualification, sans reconsommer des LSA déjà introduites avant la révision. La reprise est une opération dédiée et auditée, distincte de la préparation d'un nouveau levain.

Les recettes et plans sont des objets JSON structurés et versionnés dans `LotEvent.metadata`. Les consommations utilisent `LotEventLot`, `LotEventIntrant` et `StockMovement`. Les références de produits, d'analyses et de mouvements sont conservées avec des libellés et des unités au moment de l'opération. Aucun nouveau modèle Prisma n'est requis pour cette première révision ; une migration de données automatique des anciens levains n'est pas prévue.

## Calculs et unités

### Nourrissage d'une mère

Tous les calculs sont partagés entre prévisualisation et serveur, mais le serveur recalcule à partir des paramètres et des stocks relus.

Les masses volumiques doivent être déjà corrigées à 20 °C ; les champs le précisent. Conserver les horaires des deux mesures et l'horizon jusqu'au prochain prélèvement. Estimer la consommation sur cet horizon par `écart × 2,5 × heures prévues / heures observées`. Cette projection suppose une consommation constante et doit être affichée comme telle ; elle n'est pas une correction automatique de température.

Avec les volumes en hL et les titres de sucre en glucose-fructose (g/L) :

```text
liqueur = [volumeFinal × (20 + consommationPrévue)
           − volumeRestant × sucreRésiduelMesuré] / titreLiqueur

vinDirect = [volumeFinal × TAVCible
             − volumeRestant × TAVLevain
             − liqueur × TAVLiqueur
             − volumeFinal × consommationPrévue / 16,8] / TAVVin

eau = volumeFinal − volumeRestant − liqueur − vinDirect
DAP_kg = volumeFinal_hL × 20 / 1000
```

Le TAV du levain, le TAV cible, le TAV de la liqueur et le sucre résiduel sont renseignés, au lieu des constantes actuelles non visibles. Une recette non finie, négative, hors capacité ou dépassant les stocks est refusée. Les entrées temporelles exigent des durées positives et des mesures ordonnées.

### Deux modes de liqueur

**Préparée** : sélectionner le produit de liqueur en L ou hL et renseigner son titre GF et son TAV. Seul son stock volumique est débité ; sa fabrication passée n'est pas recomptée.

**Fabriquée pour l'opération** : sélectionner le saccharose en g ou kg et le lot de vin de dissolution. Utiliser le modèle documenté du sucre dissous, avec apport volumique de 0,63 L/kg et conversion approchée saccharose → GF de 1,06, cohérente avec le tableau 1. Pour le volume de liqueur calculé :

```text
sucre_kg = volumeLiqueur_L × titreGF / (1000 × 1,06)
vinDissolution_L = volumeLiqueur_L − 0,63 × sucre_kg
TAVLiqueur = TAVVinDissolution × vinDissolution_L / volumeLiqueur_L
```

Ainsi, 100 L à 530 g/L GF nécessitent 50 kg de sucre et 68,5 L de vin. La fabrication est intégralement consommée dans le nourrissage ou la mixtion validés. Si le même lot fournit le vin direct et celui de dissolution, additionner les prélèvements avant de vérifier et débiter le stock. Ne pas remplacer le vin de dissolution par de l'eau implicitement.

Les calculs gardent leur précision interne ; les quantités persistées utilisent les unités des produits et les volumes la précision applicative de 0,001 hL. Les bilans utilisent les quantités effectivement persistées et rendent les arrondis visibles. Une consommation positive arrondie à zéro est refusée. Les unités incompatibles, les titres manquants et les produits d'une autre organisation sont refusés. Le stock disponible n'est pas arrondi avant le contrôle.

## Services, API et sécurité

Faire évoluer `server/modules/levains` et `lib/levain.ts` pour séparer calculs, préparation, qualification, suivi et consommations. Les helpers de consommation acceptent la transaction appelante, sans ouvrir une transaction imbriquée. La mixtion dispose d'un service dédié au sein du module tirage et réutilise les primitives de lots et d'inventaire.

| API | Responsabilité |
| --- | --- |
| `POST /api/levains` | Constitution du levain en préparation, recette et protocole explicites |
| `POST /api/levains/preparation` | Étape supplémentaire et apports réellement réalisés |
| `POST /api/levains/qualify` | Qualification ou reprise d'un levain ancien, contrôles et état attendu |
| `POST /api/levains/observations` | Mesures et interventions sans changement fictif de volume |
| `POST /api/levains/feed` | Recette mesurée, deux modes de liqueur, DAP et mouvements atomiques |
| `POST /api/tirage/mixtions` | Constitution du lot mixtion et prélèvement réel du levain |
| `POST /api/tirage` | Mise en bouteilles de la mixtion, conditionnement et reliquat |

Les anciennes formes incomplètes des requêtes de création/nourrissage sont refusées avec un message explicite ; les clients du projet sont mis à jour ensemble. La consultation de l'historique reste compatible. La mise en bouteilles de vin tranquille garde son parcours actuel. Le tirage avec levain utilise le nouveau parcours mixtion ; les recettes sans levain ne doivent pas être déduites d'un champ simplement omis.

Conserver l'authentification serveur, les rôles d'écriture existants et le filtrage systématique par organisation. Chaque opération a sa clé UUID d'idempotence. Volumes, produits, liens et audit sont écrits dans une seule transaction sérialisable. Une insuffisance ou un conflit concurrent renvoie `409` et annule tout. Des écritures sur une même ressource sont regroupées ; l'ordre des ressources est déterministe. Une réponse réseau perdue ne doit pas conduire le navigateur à créer une nouvelle clé pour la même opération.

Les détails d'événements et la généalogie doivent inclure les nouvelles préparations et mixtions. Le tirage du lot mixtion doit permettre de retrouver le vin et le levain parents, et les produits réellement utilisés, sans inventer une généalogie à partir des seuls libellés.

## Vérification et limites de livraison

Vérifier les calculs contre les équations et exemples de la revue, dont le DAP de 80 g pour 4 hL, la fabrication de liqueur 100 L/50 kg/68,5 L et la propagation sur 24/72 heures. La conclusion de l'article inversant vraisemblablement les volumes à 13 et 20 °C ne doit pas servir d'oracle de test.

Les tests en base doivent couvrir préparation et qualification, reprise explicite d'un levain ancien, prélèvement partiel et épuisement, les deux modes de liqueur, regroupement des sources, unités, insuffisances, isolation des organisations, concurrence/idempotence et rollback lors d'un échec tardif. Vérifier que la mise en bouteilles ne reconsomme ni le levain ni les intrants de mixtion et que le reliquat/généalogie restent exacts.

Les scénarios navigateur couvrent le parcours complet, les états non qualifiés, les erreurs de stock et la relecture après validation. Exécuter les contrôles de sécurité existants, le lint des fichiers concernés, TypeScript et le build. Les fixtures SQL sont temporaires et annulées, selon le dispositif existant.

L'implémentation sera découpée dans le plan suivant la dépendance des opérations : calculs et états, préparation/qualification, nourrissage/stocks, mixtion/tirage, planning/suivi et recette complète. Chaque morceau est vérifié avant le suivant, mais la livraison annoncée comme complète doit couvrir tout ce périmètre.

Sont exclus : recette initiale automatique sans protocole fourni, pilotage des équipements, fabrication de liqueur destinée à un stock futur, refonte générale de la cuverie et déploiement. Le protocole initial peut être enregistré manuellement ; son absence ne bloque donc pas le développement de la structure, mais interdit d'annoncer une recette initiale automatique validée par les PDF.
