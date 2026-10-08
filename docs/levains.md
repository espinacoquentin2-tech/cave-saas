# Levains : création et nourrissage

## Fonctionnement

Les actions du planificateur enregistrent maintenant les volumes dans les **lots**, qui sont la référence en base. La cuverie relit les données du serveur ; elle ne simule plus une écriture réussie avec une modification du store local.

- `POST /api/levains` crée une cuve et un lot levain puis débite le lot de vin source dans une transaction unique. La capacité proposée est de 120 % du volume, arrondie au hL supérieur ; l'API accepte aussi une capacité explicite.
- `POST /api/levains/feed` recalcule le vin, la liqueur et l'eau à partir des paramètres de recette, débite le vin source et porte le levain au volume final demandé.
- Les volumes demandés utilisent les hL avec une précision de 0,001 hL. Le débit préserve la précision éventuellement supérieure du stock source. Le modèle de nourrissage existant est conservé et partagé entre navigateur et serveur. Les recettes impossibles, notamment avec un apport d'eau négatif, sont refusées.
- Le lot levain utilise le statut existant `ACTIF` et le repère `qualiteLot: LEVAIN`. Une ancienne cuve nommée Levain reste utilisable si elle possède un lot cohérent de volume positif.
- Les deux cuves doivent appartenir à l'organisation connectée et contenir chacune un seul lot utilisable. La source doit être éligible au tirage et ne peut pas être un levain.
- Un prélèvement qui épuise le vin archive le lot source, le détache et passe sa cuve en nettoyage.

La création et le nourrissage sont réservés à `ADMIN`, `CHEF_CAVE` et `CAVISTE`. Un compte lecture seule reçoit `403` ; une requête sans session reçoit `401`.

Chaque opération possède une clé d'idempotence UUID. Une requête déjà enregistrée est refusée sans nouveau débit. Les transactions sont sérialisables ; un conflit concurrent reçoit `409`. Le nourrissage contrôle également que le volume restant saisi correspond toujours à la base.

## Traçabilité

Les événements `CREATION_LEVAIN` et `ALIMENTATION_LEVAIN` relient le vin source et le lot levain avec leurs changements de volume. Les cuves, les paramètres de calcul, les apports et l'opérateur sont conservés ; un journal d'audit est enregistré dans la même transaction.

Les apports sont visibles dans les détails structurés de l'historique. La généalogie retrouve les vins parents et les levains enfants à partir des liens d'événements, y compris les vins ajoutés lors des nourrissages, tout en conservant les anciens liens issus des notes.

L'eau, la liqueur et le DAP sont tracés comme éléments de recette. Ce formulaire ne sélectionne pas de produits d'inventaire : aucun stock de sucre, levures ou DAP n'est débité automatiquement. Les paramètres du planning hebdomadaire restent une simulation locale ; seuls les mouvements validés sont persistants.

## Vérifications

```bash
npm run test:levains
LEVAIN_TEST_DATABASE=true npm run test:levains
npm run test:security
E2E_BASE_URL=http://localhost:3101 npm run test:e2e -- --project=chrome --workers=1
npm run build
```

Sans `LEVAIN_TEST_DATABASE=true`, seuls les calculs sont exécutés et les tests en base sont explicitement ignorés. Avec ce drapeau, les tests utilisent la connexion Prisma locale et des fixtures temporaires : une transaction externe est systématiquement annulée et des savepoints vérifient le tout-ou-rien de chaque opération. Aucune donnée métier existante n'est modifiée. Les séquences PostgreSQL peuvent avancer lors de ces tests.

Les tests navigateur de levain utilisent une API de recette interceptée pour vérifier les appels et la relecture de l'interface, sans mutation distante. Les tests de droits d'accès appellent les routes réelles. Les écritures SQL et leurs bilans sont vérifiés séparément par les tests en base.

Recette du lot : build et TypeScript réussis, 18 tests calcul/persistance réussis avec la base activée, 5 tests de sécurité réussis et 14 scénarios E2E réussis. Le scénario analytics est ignoré dans cette recette car la mesure d'audience est désactivée. Le lint des nouveaux fichiers serveur, calcul et tests passe ; les composants historiques conservent leur dette de lint.
