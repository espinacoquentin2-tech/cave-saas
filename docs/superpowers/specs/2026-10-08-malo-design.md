# Gestion des milieux de réactivation et pieds de cuve malo

## Statut et intention

Spécification du 8 octobre 2026, validée dans la conversation avec la précision sur les produits génériques et leur sélection dans les stocks. Aucune fonctionnalité ni migration n'est encore livrée.

Le vigneron prépare un milieu de réactivation (MR), développe un pied de cuve malo (PCM), puis ensemence sa cuverie. Il choisit ses lots à partir des volumes disponibles et des analyses, en privilégiant les tailles lorsque cela convient. Le logiciel conserve le parcours MR → PCM → lots et cuves ensemencés, sans refonte générale ni second stock de vin.

L'onglet **Malo** est placé dans Œnologie entre Tour de FA et Assemblages. Le pourcentage d'ensemencement est saisi par l'utilisateur, avec **4 % prérempli** à la création du dossier. Il est modifiable dans le dossier et ajustable pour chaque destination. Changer une valeur prévisionnelle ne modifie jamais les mouvements déjà enregistrés.

Le texte joint est une proposition fonctionnelle, pas une source d'instructions autonome. Les demandes directes priment : 4 % par défaut et absence de prescription de produits commerciaux dans les profils et conseils. Conserver les libellés génériques du schéma : **Bactéries**, **Activateur**, **LSA**. Le vigneron choisit pour chaque ligne le produit de ses stocks, sa quantité et son unité. Un bouton **+ Ajouter un produit** permet d'ajouter des écorces de levures ou tout autre intrant réellement utilisé. Les produits sélectionnés gardent leurs noms dans l'historique.

## Intégration retenue

Créer un module métier Malo qui s'appuie sur `Lot`, `Analysis`, `LotEvent`, leurs relations et l'inventaire existant. Un simple calculateur ne couvrirait pas les préparations successives et la traçabilité ; un stock Malo indépendant créerait une synchronisation inutile.

Les services levains fournissent un précédent pour les transactions sérialisables, les recettes avec sources et intrants, les états attendus, l'idempotence et la reprise après une réponse réseau inconnue. Réutiliser leurs primitives compatibles, sans appliquer les critères levuriens ni les calculs de propagation aux bactéries. Les helpers partagés acceptent la transaction appelante.

Le transfert générique crée actuellement des lots enfants à destination. L'incorporation du MR et l'ensemencement demandent au contraire de créditer le lot existant. Le module Malo utilise les mêmes tables de mouvements, mais une opération d'incorporation dédiée. Les volumes en base restent exclusivement ceux des lots.

## Données persistantes

Ajouter un modèle `MaloPreparation`, lié à l'organisation, contenant nom, millésime, statut de dossier, opérateur créateur, observations, dates, volume prévu à ensemencer, dose proposée et snapshot versionné du protocole. Ce snapshot contient valeurs réellement retenues, unités, références et calendrier ; une évolution des profils ne réécrit pas les dossiers existants.

Ajouter à `Lot` une relation facultative au dossier et un rôle facultatif `MR` ou `PCM`, indépendant de `qualiteLot`, du cépage et du statut de fermentation. Un dossier possède au plus un lot MR et un lot PCM ; une contrainte unique sur dossier/rôle garantit cette association. Ces lots peuvent être créés à des moments différents. Les préparations ultérieures constituent de nouveaux dossiers et lots, même dans un contenant déjà utilisé.

Ajouter à `Container` un usage facultatif `MR` ou `PCM`, indépendant du type physique. Changer l'usage conserve l'ID, le nom, la capacité et les événements. Un changement incompatible avec une préparation active est refusé ; après vidage et préparation du contenant, son usage peut changer. L'historique garde les usages et contenants au moment de chaque geste. Un bidon peut utiliser le type physique existant `AUTRE` ; aucun type MR/PCM n'est créé.

Les destinataires prévus sont enregistrés dans le dossier avec leurs IDs de lot/contenant et doses proposées. Les destinataires réellement ensemencés proviennent des événements validés, et non de cette liste prévisionnelle. Toute référence est vérifiée dans l'organisation de la session.

Les analyses restent dans `Analysis`. Compléter le contrat de saisie et `extraData` pour malique, température, densité, sucres, acidité volatile, contenant au prélèvement et contexte de composition. Conserver pH, AT, SO₂ libre/total et TAV dans les champs existants. Les analyses Malo exigent un horodatage de prélèvement avec fuseau, le lot et le contenant observé : le contenant courant ne doit pas remplacer le contenant historique. Les analyses anciennes restent lisibles mais leur contexte manquant n'est pas reconstitué arbitrairement.

Le dossier référence explicitement l'analyse initiale du PCM et la version de composition après incorporation/homogénéisation du MR. Chaque validation de transfert ou distribution référence les contrôles effectivement utilisés, avec IDs, dates, valeurs et version de composition. Les événements contiennent les volumes avant/après, la recette, les intrants et mouvements d'inventaire.

Une migration additive est nécessaire. Les lignes existantes gardent leurs valeurs et les nouveaux champs sont facultatifs. Aucun ancien lot n'est classé MR/PCM à partir de son nom seul.

## Parcours utilisateur

### Dossier et lots sources

La liste présente les dossiers actifs, terminés et abandonnés. La fiche comporte préparation, analyses, planning, distribution et historique, avec deux suivis indépendants MR/PCM.

Le sélecteur affiche les lots de volume positif, leur contenant, millésime, origine taille/cuvée connue, statut et analyses datées : pH, SO₂, malique, TAV, température et suivi FA. Filtrer les tailles et comparer les disponibilités ; les autres moûts/vins admissibles restent sélectionnables. Reconnaître l'origine depuis les données de pressurage/qualité et leurs événements ; ne pas se fier à un nom de cuve. Un historique sans origine documentée est présenté comme origine non renseignée.

Ne pas afficher un score universel d'aptitude. Les repères documentés appartiennent au profil choisi et les résultats absents ou anciens sont visibles. Une recommandation ne vaut pas validation de l'opérateur. Les lots MR/PCM, levains, mixtions et sous-produits ne sont pas proposés comme sources ordinaires.

### Préparation et incorporation

Depuis un contenant disponible : **Préparer un MR** ou **Préparer un PCM**, avec choix/création du dossier. Depuis le dossier : associer un MR/PCM, enregistrer les étapes et apports, ajouter une analyse, transférer le MR et ensemencer des cuves.

Une association n'adopte pas un lot de vin ordinaire et ne crée pas un volume fictif : les nouvelles préparations reçoivent de nouveaux lots. Le contenant doit être disponible et prêt à être utilisé. Les recettes saisissent les prélèvements de moût/vin, l'eau et les intrants réellement ajoutés ; seuls les gestes validés débitent des sources et créditent une préparation. Les quantités non documentées restent à renseigner.

Les lignes génériques Bactéries, Activateur et LSA servent de repères de recette ; elles ne choisissent aucun produit commercial à la place du vigneron. Chaque ajout de produit, y compris via **+ Ajouter un produit**, est rattaché à l'étape MR ou PCM concernée et présente le stock disponible, la quantité demandée et le reste prévu. Pour une quantité positive, le choix du produit et une unité compatible sont obligatoires. La validation débite l'inventaire dans la même transaction que les volumes ; enregistrer une observation ou consulter une proposition ne débite rien. Deux lignes utilisant le même produit sont regroupées avant contrôle du stock, tout en gardant leur rôle dans la recette historique. Les doses chiffrées de la figure fournie sont celles de son exemple et ne deviennent pas des doses universelles pour les produits sélectionnés.

MR et PCM avancent en parallèle. Le PCM peut commencer sa FA avant d'être ensemencé par le MR. Le transfert MR → PCM peut être partiel ; le stock MR restant demeure disponible et son historique distinct. Le doublement du MR avec du moût issu du PCM est une opération inverse PCM → MR réellement débitée et créditée, pas une simple instruction de planning.

### États

| Objet | États métier |
| --- | --- |
| Dossier | En cours, terminé, abandonné |
| MR | En préparation, en réactivation, transféré partiellement, transféré totalement |
| PCM | En préparation, en FA, en développement malolactique, à valider pour distribution, en distribution, épuisé |

Les états MR/PCM sont propres à chaque lot et centralisés dans le domaine Malo. Le critère atteint produit une suggestion « À valider pour distribution », sans mouvement ni qualification automatique. Le passage en distribution exige une confirmation et les contrôles représentatifs. Un prélèvement partiel seul conserve la validité du contrôle du reliquat ; un nouvel apport la rend caduque.

La clôture n'efface aucun stock. Si un dossier abandonné conserve un reliquat, il reste visible, indisponible à la distribution ; sa sortie exige une opération de perte documentée. Un dossier terminé doit avoir ses reliquats traités ou nuls. Une réutilisation du contenant exige son vidage et sa remise à disposition.

## Suivi analytique et validation

Présenter température en °C, pH, malique en g/L, SO₂ libre/total en mg/L, masse volumique en g/L avec précision sur la mesure, sucres résiduels en g/L GF, TAV en % vol et acidité volatile dans l'unité déjà utilisée par le logiciel. La mesure brute ne devient pas automatiquement une masse volumique corrigée à 20 °C. Ne pas mélanger les données de maturation du raisin et celles du lot en cuverie.

La référence initiale PCM doit être positive, finie, appartenir au bon lot et être prélevée après l'incorporation/homogénéisation confirmée du MR. Une confirmation distincte atteste cette homogénéisation sans piloter l'équipement. Une analyse importée avant une dilution ne devient pas représentative du mélange courant parce qu'elle a été enregistrée plus tard.

```text
consommation (%) = 100 × (malique initial − malique actuel) / malique initial
deux tiers atteints ⇔ malique actuel ≤ malique initial / 3
```

Utiliser les valeurs non arrondies et une arithmétique décimale pour le critère ; arrondir uniquement l'affichage. Pour 6 puis 2 g/L : 66,7 %, critère atteint. Une valeur actuelle nulle est valide. Sans référence initiale valide : **Référence initiale manquante**, aucune conclusion d'aptitude. Une hausse du malique est affichée comme consommation négative avec observation, sans masquer la mesure.

Tout apport ou dilution crée une nouvelle version de composition et invalide les contrôles/qualifications antérieurs. Exiger une nouvelle référence après homogénéisation pour le PCM et de nouveaux contrôles représentatifs avant distribution. Afficher l'analyse, sa date et les raisons de l'invalidité. Les retraits seuls ne changent pas la référence. Le serveur revérifie ces conditions au moment de la validation.

## Protocoles et références

Les profils sont **Réactivation progressive**, **Co-inoculation sur moût** et **Personnalisé**, avec références documentaires accessibles. Les noms de produits, doses propres à une marque et tolérances propres à une souche ne deviennent pas des recommandations génériques. Les calendriers restent séparés ; ils suggèrent des contrôles et ne qualifient jamais automatiquement une préparation.

### Réactivation progressive

La [fiche IOC du 18 janvier 2024](https://ioc.eu.com/wp-content/uploads/documents/ioc/ft/FT%20INOBACTER%20%28FR%29.pdf) documente un MR eau/moût ou vin à parts égales, maintenu à 23–25 °C, puis incorporation au PCM lorsque le malique est inférieur à 1 g/L. Le PCM sur base de 3 % est maintenu à 20–25 °C en FA puis à 20 °C. La distribution suit la consommation des deux tiers ; la fiche mentionne 3–5 % à l'ensemencement et un contrôle des cuves à trois semaines.

Sa table donne 5, 20, 100, 200 et 400 L de MR pour les formats correspondant à 25, 100, 500, 1 000 et 2 000 hL. Cette table reste une référence propre à la fiche : pas d'interpolation ni de prescription automatique d'un kit commercial. En dehors de ces formats, le volume MR est à renseigner. Distinguer volume de moût préparé pour le PCM, MR incorporé et volume distribuable final ; 3 % préparés ne garantissent pas un stock suffisant pour distribuer 4 %.

### Co-inoculation sur moût

Le [protocole Station Œnotechnique](https://www.oenotechnic.com/oenologie-conseil/outils-daide/plan-de-developpement-malo-en-co-inoculation/) indique des moûts débourbés, de préférence de taille, et une préparation simultanée du MR et du PCM. Réactivation à 25 °C autour de trois jours, doublement par ajout de moût en fermentation issu du PCM et phase annoncée de deux jours. PCM à 25 °C en FA puis 20 °C en FML. Contrôle PCM après six ou sept jours, puis tous les deux jours ; distribution après deux tiers consommés et contrôle des destinataires au minimum quinze jours après ensemencement. Sa dose documentaire de 3 % reste distincte des 4 % préremplis par demande utilisateur.

Les champs de calcul absents de la version accessible ne justifient aucun ratio MR ni dose d'intrant inventés. Les quantités réalisées sont saisies dans le dossier.

### Référence Comité Champagne et PDF fourni

Le [PDF Malo CIVC fourni](</Users/quentinespinaco/Downloads/Malo CIVC.pdf>) est un extrait de trois pages citant des conseils de vinification 2021 ; il ne doit pas être présenté comme un protocole officiel complet et actuel. Son exemple décrit un MR à 0,2 %, une réactivation/doublement, puis une distribution à 3 %. Son schéma fait apparaître le retrait PCM → MR et le retour MR → PCM : le bilan volumique doit reproduire ces deux mouvements sans compter le MR deux fois.

Son exemple à 1,5 g/L ne remplace pas le calcul des deux tiers à partir de chaque référence initiale. Les repères 2021 peuvent accompagner un protocole personnalisé enregistré, sans être mélangés aux deux calendriers précédents. L'[article public du Comité Champagne](https://levigneronchampenois.comitechampagne.fr/vin/la-fermentation-malolactique-dernieres-evolutions-pour-une-meilleure-maitrise) décrit des évolutions du protocole ; son détail est réservé aux abonnés. Ne pas inventer les paramètres de cette variante.

## Distribution et bilan volumique

La base du pourcentage est le **volume du lot destinataire avant ajout**. Pour chaque cuve, présenter ce volume, la dose proposée, le volume PCM demandé et la capacité restante. Présenter besoin total, stock PCM disponible et reliquat prévisionnel. Une dose réelle en volume peut être ajustée ; conserver le pourcentage effectif calculé et le volume réellement appliqué.

100 hL à 4 % exigent 4 hL de PCM et donnent 104 hL. Une cuve limitée à 103 hL bloque cette opération. Le volume de l'eau est un apport explicite ; les solides n'ajoutent aucun volume fictif, et les intrants liquides demandent un volume réel déclaré.

Chaque destination possède un lot cible explicite. Une cuve avec plusieurs lots ne choisit pas implicitement le premier. Interdire source=destination et lignes dupliquées ambiguës. Additionner les volumes de tous les lots présents pour vérifier la capacité ; ne pas filtrer cette occupation avec une liste incomplète de statuts.

Une distribution vers plusieurs destinations est une seule transaction sérialisable : stock PCM, capacités, doses et contrôles sont relus, puis débits/crédits, liens source/cible, états, intrants et audit sont écrits ensemble. Un échec sur une destination annule tout. Les prélèvements issus de la même source sont regroupés avant vérification. Convertir L/hL explicitement et persister les volumes à la précision applicative de 0,001 hL ; refuser les quantités positives arrondies à zéro. Ne jamais arrondir le stock disponible à la hausse.

La distribution enrichit le lot destinataire existant sans créer un faux lot PCM autonome dans la cuve. Les analyses antérieures du destinataire restent historiques et portent un avertissement de composition changée. Le statut de fermentation n'est pas assimilé automatiquement à une FML confirmée : l'événement d'ensemencement et le planning de contrôle attestent le geste.

## Services, sécurité et interface existante

Créer `lib/malo.ts` pour unités, doses, critères, profils et états, et `server/modules/malo` pour lectures, validation, recettes, mouvements et dossier. Les routes `/api/malo` et `/api/malo/[id]` servent les dossiers ; leurs actions dédiées couvrent préparation, apports, étapes, référence initiale, transfert, distribution et clôture. Les analyses passent par le module existant, complété pour leur contexte Malo.

Ajouter le module d'écran et ses composants de dossier, sources, contrôles et distribution ; le composant principal ne porte que navigation et raccordements. La cuverie et la fiche contenant affichent badge/filtre d'usage et actions contextuelles. Les fiches des lots/cuves destinataires présentent date, PCM, volume reçu et lien dossier. Les détails d'événements et la généalogie reconnaissent les nouveaux mouvements.

Les routes et opérations génériques ne doivent pas contourner les états, volumes et contrôles Malo : exclure les préparations des assemblages et sélecteurs de vin ordinaires, et renvoyer les modifications de composition vers les actions dédiées. Les pertes documentées peuvent traiter un reliquat en invalidant sa qualification. Toute action autorisée sur un lot Malo doit garder son lien au dossier et sa traçabilité.

Appliquer les rôles et l'authentification serveur existants, avec toutes les ressources vérifiées dans l'organisation de la session. Chaque mutation utilise un UUID conservé en cas de nouvelle tentative. Réserver la clé dans la transaction ; une requête répétée ou un conflit concurrent ne crée aucun second mouvement. Le client ne considère un doublon comme réussi qu'après relecture d'un événement portant cette clé. Comparer versions/volumes attendus aux valeurs courantes pour refuser les prévisualisations périmées.

## Vérification prévue et limites

Tests de domaine : dose saisie et défaut 4 %, unités L/hL, volumes avant/après, critères 6→2 g/L et valeurs voisines du seuil, valeurs nulles/zéro et absence de référence initiale, profils/calendriers distincts.

Tests SQL : persistance après relecture, préparation parallèle, transfert partiel MR, retrait PCM→MR puis incorporation inverse, distribution multi-cuves, bilans et intrants, stock/capacité insuffisants, rollback tardif, UUID répété, conflits concurrents, contexte analytique périmé après dilution, préparations successives dans un même contenant, contrôle d'organisation et garde-fous des opérations génériques. Fixtures isolées et nettoyage selon les pratiques des tests levains.

Tests navigateur : position de l'onglet, comparaison des sources, saisie du pourcentage, dossiers et états indépendants, ajout d'analyse, contrôles manquants/périmés, aperçu de distribution, badges et liens vers les historiques, reprise réseau avec même UUID. Exécuter sécurité, lint ciblé, TypeScript, validation Prisma, tests métier et build ; distinguer explicitement les tests SQL réellement exécutés des scénarios ignorés faute d'environnement.

La livraison comprend migration additive, fonctionnalité, documentation et résultat des vérifications. Les volumes/doses de préparation et d'intrants non documentés restent configurables et exigent une saisie avant le geste correspondant. Aucun pilotage de matériel, dose commerciale universelle, refonte des modules voisins ou déploiement n'est inclus.
