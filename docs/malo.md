# Préparations malolactiques

L’onglet **Malo**, placé entre **Tour de FA** et **Assemblages**, suit un dossier de préparation : milieu de réactivation (MR), pied de cuve malo (PCM), puis ensemencement des lots destinataires.

## Utilisation

1. Créer un dossier, choisir le millésime, le volume de cuverie prévu et un profil. La dose proposée vaut **4 %**, modifiable ; elle s’applique au volume du lot destinataire **avant ajout**. Chaque destinataire peut recevoir un pourcentage ou un volume réel différent.
2. Préparer séparément le MR et le PCM dans des contenants vides prêts à l’emploi. Les actions de la fiche contenant ouvrent directement le parcours correspondant. Les préparations créent leurs propres lots, avec des identités distinctes des vins prélevés.
3. Comparer les lots disponibles et leurs analyses datées. Le filtre **Afficher les tailles** utilise l’origine documentée ; l’absence d’origine ou de mesure reste visible. Les levains, mixtions, sous-produits et autres préparations Malo sont exclus.
4. Saisir les prélèvements, l’eau et les intrants réellement ajoutés. Les lignes **Bactéries**, **Activateur** et **LSA** demandent un produit des stocks et une quantité. **+ Ajouter un produit** accepte les intrants complémentaires, notamment les écorces de levures. Aucun produit commercial n’est imposé. Les quantités laissées à zéro ne sont pas consommées ; les liquides demandent leur volume réel ajouté.
5. Enregistrer les analyses dans **Contrôles**, avec la date et l’heure du prélèvement. Chaque analyse conserve le lot, son contenant au prélèvement et la composition observée. Les mesures à zéro sont conservées ; une valeur absente reste absente.
6. Valider les transferts dans **Distribution** : PCM → MR pour le doublement, puis MR → PCM pour l’incorporation, éventuellement partielle. Le profil progressif exige le contrôle MR prévu sous son seuil ; les autres profils demandent la validation explicite du vigneron.
7. Après incorporation du MR, confirmer l’homogénéisation du PCM et sélectionner une analyse initiale positive prélevée après celle-ci. Le critère de distribution est atteint lorsque la mesure actuelle est au plus le tiers de cette référence, sans arrondir le calcul du seuil.
8. Sélectionner les destinataires, vérifier les volumes, stocks et capacités, puis confirmer le geste. Plusieurs destinataires sont enregistrés ensemble. Un dossier ne peut être terminé avec des reliquats ; l’abandon conserve ces volumes et l’historique.

Les propositions et le planning ne déplacent aucun vin. Les gestes validés écrivent les débits, crédits, intrants, contrôles utilisés, opérateur et événements dans la même transaction. Un ajout ou une nouvelle incorporation invalide les contrôles de la composition précédente. Un simple prélèvement conserve la composition de la source.

Les badges **MR / PCM**, le filtre d’usage de la cuverie et les fiches lots/contenants donnent accès aux dossiers. Après vidange et nettoyage, un contenant peut recevoir une nouvelle préparation ; **Réaffecter à la cuverie** retire son usage Malo lorsqu’il est vide. Les événements gardent les anciens liens et les noms des produits consommés.

En cas de réponse réseau inconnue, les formulaires se bloquent et proposent **Vérifier ou réessayer la même opération**. La même clé est conservée ; un doublon n’est confirmé qu’après relecture de l’événement enregistré.

## Profils et références

Les profils conservent leurs paramètres dans le dossier lors de sa création. Les jours du planning sont indicatifs, distincts des dates réelles des gestes. Le profil personnalisé laisse les paramètres non documentés à renseigner.

- [Réactivation progressive — fiche technique IOC](https://ioc.eu.com/wp-content/uploads/documents/ioc/ft/FT%20INOBACTER%20(FR).pdf) : repères de température, contrôle MR et suivi des cuves. La table documentaire de préparation n’est pas interpolée automatiquement.
- [Co-inoculation — Oenotechnic](https://www.oenotechnic.com/oenologie-conseil/outils-daide/plan-de-developpement-malo-en-co-inoculation/) : préparation parallèle et calendrier distinct.
- Extrait fourni **Malo CIVC.pdf**, schéma attribué aux Conseils vinification 2021 du Comité Champagne : MR 1,5 hL / PCM 24,75 hL ; doublement avec 1,5 hL du PCM puis incorporation de 3 hL, pour un PCM final de 26,25 hL. Les jours illustrés ne déclenchent aucune opération automatique.

La valeur applicative de 4 % vient du choix utilisateur ; elle ne remplace pas les paramètres documentaires propres à chaque profil. Les libellés des recettes restent génériques.

## Installation et vérification

La migration additive `prisma/migrations/20261008120000_add_malo_preparations/migration.sql` ajoute dossiers, rôles et usages. Les dossiers sont accessibles par les routes authentifiées filtrées par organisation ; l’accès direct public à la nouvelle table est fermé. Appliquer cette migration avant d’utiliser l’onglet sur une base existante, puis générer le client Prisma selon le processus du projet.

La migration a été exécutée sur une base PostgreSQL locale isolée créée depuis le schéma antérieur. Aucune migration n’a été appliquée à la base Supabase partagée pendant le développement.

Vérifications reproductibles :

```sh
npm run test:malo
# Tests SQL : URL PostgreSQL locale explicite obligatoire.
DATABASE_URL='postgresql://…@127.0.0.1:PORT/BASE' MALO_TEST_DATABASE=true npm run test:malo
npm run test:levains
npm run test:security
npx prisma validate
npx tsc --noEmit --pretty false
npx playwright test tests/e2e/malo.spec.ts tests/e2e/malo-lifecycle.spec.ts
npm run build
```

Les tests SQL Malo couvrent préparation, stocks et unités, transferts partiels, critère analytique, invalidation après apport, distribution et rollback, réutilisation des contenants, généalogie et deux transactions réellement concurrentes. Les tests navigateur utilisent des réponses API et d’authentification simulées, sans écrire sur la base partagée.

Résultats du 8 octobre 2026 : **20 tests Malo** avec SQL activé et aucun scénario ignoré ; **38 tests levains** avec SQL activé ; **5 tests de sécurité**. Validation Prisma, TypeScript, lint ciblé et build de production passent. Les **5 tests navigateur** passent et couvrent dose et intrants, reprise réseau, distribution multi-cuves et historique, lecture seule et saisie analytique à zéro avec horodatage précis. Une relecture indépendante a confirmé les corrections des trois problèmes relevés.
