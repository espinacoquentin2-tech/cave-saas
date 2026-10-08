# Levains, intrants et tirage

## Parcours livré

Dans **Planif. Tirage**, cinq vues couvrent le planning, la préparation, les contrôles, le nourrissage puis la mixtion et la mise en bouteilles. Les lots et les stocks relus depuis le serveur font référence.

1. **Planning** : journées datées, volumes de vin et pourcentage de levain, température de propagation de 13, 16 ou 20 °C. La récurrence utilise le nombre de jours civils entre les tirages, y compris le week-end et le changement d'heure. Inclure la semaine suivante pour conserver une mère. Cette simulation ne débite aucun stock ; son snapshot peut accompagner la création.
2. **Préparation** : saisir le protocole retenu, chaque étape réalisée et sa date, le vin, l'eau, les LSA, le sucre et éventuellement la liqueur réellement introduits. Utiliser une cuve vide existante ou créer une cuve avec sa capacité explicite. Le lot reste `LEVAIN_EN_PREPARATION` ; une étape suivante peut enregistrer les LSA sans introduire de vin supplémentaire.
3. **Contrôles** : relever température, masse volumique corrigée à 20 °C, TAV, sucres résiduels GF, pH et population. Une qualification exige une confirmation de l'opérateur et un motif pour toute mesure indisponible. Les nouvelles préparations doivent avoir une introduction de LSA enregistrée. Le passage à `LEVAIN_PRET` n'est jamais automatique au bout de trois jours. Une observation ou une intervention d'aération/agitation conserve les mesures sans certifier la disponibilité.
4. **Mixtion** : prélever du vin et un levain qualifié, choisir le sucre cristallisé ou une liqueur, puis enregistrer le mélange dans une cuve vide. Le lot `ASSEMBLE` / `MIXTION_TIRAGE` matérialise le volume préparé. Un prélèvement partiel conserve la qualification du levain ; un prélèvement total l'archive et libère sa cuve.
5. **Nourrissage** : alimenter le volume restant avec les mesures et horaires réels et l'horizon du prochain prélèvement. La recette débite vin, liqueur ou sucre/vin de dissolution, et DAP. Le lot devient `LEVAIN_EN_PROPAGATION` et exige une nouvelle qualification avant prélèvement.
6. **Point de tirage et bouteilles** : enregistrer les masses volumiques du vin et de la mixtion corrigées à 20 °C, après homogénéisation, avec la confirmation de l'opérateur. La mise en bouteilles consomme uniquement la mixtion et les emballages. Une modification de composition après ce contrôle exige un nouveau contrôle. Le reliquat reste dans le lot ; il n'est pas arrondi à une bouteille entière.

Les vues affichent les quantités nécessaires, les disponibilités et les restes prévisionnels, en regroupant un vin ou un produit sélectionné plusieurs fois. Le serveur revérifie ces valeurs au moment de l'écriture. Les adjuvants de mixtion sont des quantités réellement introduites, saisies par l'opérateur ; aucune dose automatique ni tolérance de contrôle non documentée n'est ajoutée.

Un ancien levain `ACTIF` avec repère `LEVAIN`, ou identifié par sa cuve, apparaît **À qualifier**. Sa reprise exige un protocole historique et une confirmation explicites, sans consommer une seconde fois les LSA historiques. Les corrections génériques de statut, volume, intrants et tours FA ne remplacent pas le parcours dédié. L'ancien tirage effervescent direct d'un vin ordinaire renvoie vers la préparation d'une mixtion ; la mise en bouteilles des vins tranquilles conserve son parcours.

## Calculs et unités

- DAP : **20 g/hL du volume total après nourrissage**. Pour 4 hL, sortie de 0,080 kg ; pour 23,8 hL, 0,476 kg.
- Le titre de la liqueur est exprimé en **g/L de glucose-fructose**. Il est distinct de la masse de saccharose : 100 L à 530 g/L GF nécessitent 50 kg de sucre et 68,5 L de vin de dissolution. Le facteur GF/saccharose vaut 1,06 ; le sucre dissous apporte 0,63 L/kg. Le TAV de la liqueur fabriquée découle du vin de dissolution ; celui d'une liqueur en stock est renseigné explicitement.
- Le nourrissage prend les sucres résiduels et TAV du levain, la cible alcoolique, le TAV du vin et celui de la liqueur. La consommation mesurée utilise l'écart de masse volumique × 2,5 ; sa projection sur le prochain intervalle suppose une vitesse constante et est présentée comme telle.
- Les recettes impossibles, dont un apport d'eau négatif, sont refusées. Les apports utilisent 0,001 hL ; les conversions d'intrants utilisent les unités effectives kg/g et L/hL. Les stocks sources ne sont jamais arrondis à la hausse avant contrôle. La consommation des bouteilles conserve cinq décimales de hL, nécessaires au format 37,5 cl, et les restes réels sont conservés.
- Le sucre cible de la mixtion est saisi en GF. Le logiciel ne qualifie pas une pression de bouteille à partir de cette seule concentration.

## API et transactions

| Route | Usage |
| --- | --- |
| `GET /api/levains` | Lecture des levains, vins éligibles, mixtions, produits et cuves vides de l'organisation. |
| `POST /api/levains` | Constitution du milieu et première étape de préparation. |
| `POST /api/levains/preparation` | Étape et apports supplémentaires. |
| `POST /api/levains/qualify` | Qualification ou reprise historique documentée. |
| `POST /api/levains/observations` | Mesures, aération, agitation et commentaires. |
| `POST /api/levains/feed` | Recette de nourrissage recalculée par le serveur. |
| `POST /api/tirage/mixtions` | Création et débit réel du mélange. |
| `POST /api/tirage/mixtions/check` | Confirmation documentée du point de tirage. |
| `POST /api/tirage` | Mise en bouteilles, emballages et reliquat. |

Les écritures sont réservées à `ADMIN`, `CHEF_CAVE` et `CAVISTE` ; une session lecture seule reçoit `403`, une requête sans session `401`. Toutes les lectures et écritures métier sont limitées à l'organisation de la session.

Chaque mutation possède une clé UUID. Les recettes contrôlent état, volume et dernier événement de mutation attendu, ordonné par ID plutôt que par date saisie. Une transaction sérialisable regroupe débits de lots et produits, mouvements OUT, relations de traçabilité, état final et audit. Un échec annule l'ensemble ; un doublon ou un conflit concurrent reçoit `409` sans débit supplémentaire.

Après une réponse inconnue, l'interface bloque les nouveaux apports et réessaie la même opération avec le même UUID. Un `409` n'est reconnu comme succès que si les événements relus contiennent cet UUID. Cette reprise concerne le formulaire ouvert ; fermer ou recharger ce formulaire impose de vérifier son historique avant de ressaisir un apport.

## Traçabilité et limites documentaires

Les événements de création, préparation, qualification, reprise, observation, nourrissage, mixtion et tirage conservent protocole, étapes, mesures, sources, produits, unités et mouvements. Les détails reconnaissent les métadonnées `schemaVersion: 2` et les événements historiques. La généalogie permet de remonter bouteille → mixtion → vin/levain → vins et intrants du levain.

La [revue des deux PDF](levains-document-review.md) fonde cette révision. Leur annexe de préparation initiale manque : les doses et étapes initiales restent un protocole choisi et renseigné par la cave. Les interventions sont enregistrées ; aucun pilotage d'équipement n'est implémenté. Les coefficients de propagation suivent l'équation publiée, en conservant la réserve signalée sur les résultats inversés de la conclusion de l'article.

## Recette technique

```bash
LEVAIN_TEST_DATABASE=true npm run test:levains
npm run test:security
npx tsc --noEmit --pretty false
npm run build
E2E_BASE_URL=http://localhost:3101 npm run test:e2e -- --project=chrome --workers=1
```

Sans `LEVAIN_TEST_DATABASE=true`, les tests SQL sont explicitement ignorés. Avec ce drapeau, les scénarios séquentiels utilisent des transactions externes annulées et des savepoints ; ils ne touchent aucun lot ou produit existant. Le test de concurrence crée une organisation et ses seules données temporaires, commitée pour être visible à deux vraies transactions. Son `finally` supprime ces données dans l'ordre des relations puis vérifie leur absence. Les séquences PostgreSQL peuvent avancer.

Les tests navigateur de recette interceptent les écritures métier ; les tests d'accès utilisent les routes réelles. Les bilans, rollbacks et conflits SQL sont donc vérifiés séparément de l'interface. La recette finale est consignée dans [l'état de lancement](launch-readiness.md). La revue du code a été effectuée dans cette session ; aucune revue indépendante n'a été réalisée. Aucun déploiement ni migration de schéma n'est nécessaire pour ce lot.
