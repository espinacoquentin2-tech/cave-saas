# Vérification du parcours levain à partir des documents fournis

Date : 8 octobre 2026. Cette revue compare les documents au code existant ; elle ne modifie ni les recettes ni les données métier.

## Conclusion

La base technique est réutilisable : lot levain distinct, liens avec les vins sources, transactions, contrôles des volumes et protection contre les doubles écritures. En revanche, le parcours métier ne couvre pas encore la préparation d'un levain de tirage. Le raccordement des seuls intrants au nourrissage serait insuffisant.

L'action actuelle de création transfère du vin dans une nouvelle cuve puis marque immédiatement le lot comme levain actif. Elle n'enregistre pas la préparation initiale à partir de levures sèches actives (LSA), ni les contrôles permettant de déclarer le levain prêt au tirage. Le tirage planifié ne prélève pas non plus le volume calculé dans le lot levain.

## Sources et limites

- [PDM Réussite.pdf — Partie 1](</Users/quentinespinaco/Documents/Comité Champagne/CIVC/PDM Réussite.pdf>) : mixtion, contrôle du point de tirage, état du vin de base et population levurienne apportée.
- [La réussite de la prise de mousse — Partie 2](</Users/quentinespinaco/Documents/Comité Champagne/CIVC/La réussite de la prise de mousse (Partie 2) _ Le vigneron Champenois.pdf>) : préparation initiale et propagation journalière, calculs et tableaux.

Les pages citées sont celles des PDF, pas celles de la revue papier. Les textes des deux PDF et les tableaux/formules intégrés sous forme d'images ont été examinés.

La partie 2, page 2, renvoie au protocole de préparation initiale de 2007 et à un schéma et des conseils en annexe. Cette annexe n'apparaît pas dans les PDF fournis, qui ne contiennent aucune pièce jointe intégrée. Ces documents indiquent une préparation en trois jours, mais ne permettent pas de confirmer ses doses, températures et étapes détaillées. Il faut le protocole de préparation retenu pour paramétrer cette partie sans inventer de recette. Les recommandations ci-dessous sur la structure de l'application sont des conclusions de cette revue, pas des prescriptions logicielles des articles.

## Comparaison avec le code avant révision

| Point | Référence documentaire | État actuel et conséquence |
| --- | --- | --- |
| Préparation initiale | Partie 2, pages 2–3 : départ à partir de LSA, y compris pour un tirage sur plusieurs semaines | `LevainService.create` débite uniquement du vin, crée une cuve et un lot `ACTIF`. La préparation et la qualification du levain manquent. |
| Planning sur une semaine | Partie 2, pages 8–9 : calcul à rebours, dernier jour entièrement prélevé ; dilution 0,70 à 20 °C, 0,78 à 16 °C, 0,87 à 13 °C | La récurrence du planning existant reprend correctement ce principe et ces coefficients. Elle reste une simulation locale. |
| Plusieurs semaines et arrêts | Partie 2, pages 9–10 : pour le week-end classique, dilution sur 72 heures, soit le coefficient journalier au cube | Le planning actuel applique un coefficient journalier entre ses lignes et termine toujours à zéro. Il ne représente pas les dates, la conservation d'une mère pour la semaine suivante ou les durées d'arrêt. |
| Prélèvement pour le tirage | Partie 2, page 4 : retrait le matin, puis alimentation du volume restant | Dans le tirage planifié, l'élément `LEVAIN` est envoyé avec `consumeStock: false`. Le volume reste théorique et n'est pas prélevé dans un lot levain. |
| Sucre consommé | Partie 2, page 12 : différence de masse volumique corrigée à 20 °C, environ 2,5 g/L par unité ; tenir compte de l'intervalle de mesure | Le facteur 2,5 est présent. Les champs ne précisent pas que les mesures doivent être corrigées à 20 °C et ne portent ni températures de mesure ni horaires. |
| Sucre résiduel | Partie 2, pages 6 et 12 : marge de 20 g/L ; le sucre présent dans le levain restant entre dans le bilan | Le calcul fixe implicitement le sucre résiduel du levain restant à 20 g/L, sans analyse ou saisie permettant de l'ajuster. |
| Bilan alcoolique | Partie 2, page 13 : alcool réel du levain restant, cible du lendemain, alcool de la liqueur et du vin, alcool produit par consommation du sucre | L'équation est reconnaissable, mais l'alcool du levain et la cible sont fixés à 12 %. Le TAV de la liqueur est choisi arbitrairement entre 7,5 et 6,8 % selon un seuil de concentration. Ces valeurs ne sont pas universelles. |
| DAP | Partie 2, page 7 : phosphate biammonique, 20 g/hL par jour sur le volume total du levain | Le code calcule encore 20 g/L, soit un débit potentiel 100 fois trop élevé. La dose validée par l'utilisateur correspond bien au document. |
| Liqueur | Partie 2, pages 6–7, tableau 1 : liqueur préparée avec du vin ; concentrations distinctes en saccharose et glucose-fructose | Le calcul de nourrissage utilise des concentrations en glucose-fructose. Un débit direct du même poids en sucre cristallisé serait incorrect ; la préparation exige aussi du vin. |
| Suivi du levain | Partie 2, pages 4–7 et 11 : population levurienne, température, agitation, aération, contrôles d'alcool et de pH | Le parcours levain ne possède pas de suivi dédié de ces opérations/mesures. La température sélectionnée pilote uniquement le planning. Les analyses génériques existantes peuvent être réutilisées. |

## Conséquences pour les deux modes de liqueur

### Liqueur déjà préparée

Débiter le volume réellement utilisé dans son stock, conserver son titre en glucose-fructose et son TAV dans la recette enregistrée. Les consommations de vin et de sucre ayant servi à sa fabrication ne doivent pas être débitées une seconde fois au nourrissage.

### Préparation à partir de sucre cristallisé

La préparation doit enregistrer le sucre **et le vin de dissolution**, puis l'utilisation de la liqueur produite. Elle peut être réalisée pour le besoin immédiat ou produire un stock intermédiaire, mais son bilan doit rester identifiable et éviter tout double débit.

Le tableau 1 donne, pour une liqueur à 530 g/L de glucose-fructose : 500 g/L de saccharose, 137 L de vin pour 100 kg de sucre et un TAV de 7,5 % lorsque le vin utilisé titre 11 %. Ainsi, préparer 100 L de cette liqueur correspond, selon le tableau, à **50 kg de saccharose et 68,5 L de vin**. Ce vin s'ajoute au vin nourricier incorporé directement, ou entre dans un débit regroupé clairement détaillé si le même lot fournit les deux.

La distinction entre les deux expressions du titre doit être visible dans les champs et les calculs. Les autres concentrations doivent être prises en charge à partir d'une recette définie ; un simple changement du débit de sucre ne suffit pas à conserver le bilan volumique et alcoolique.

## Vérifications numériques et réserves sur la source

- DAP pour 4 hL de levain final : `4 × 20 / 1000 = 0,080 kg`, soit 80 g.
- DAP pour 23,8 hL : `23,8 × 20 / 1000 = 0,476 kg`. Le calcul actuel exécuté lors de la revue renvoie 47,6 kg.
- Avec les paramètres de l'exemple (18,6 → 23,8 hL, masses volumiques 1005 et 998, liqueur 530 g/L, vin 11 %), le code renvoie 17,5 g/L consommés et 0,982 hL de liqueur. L'article observe cet écart sur 23 heures et retient environ 18 g/L sur 24 heures, donnant environ 1,00 hL de liqueur. Cette différence doit être explicitée par les horaires et l'horizon de calcul, plutôt que traitée comme une erreur de bilan.
- Pour cinq journées à 10 hL de levain, la récurrence publiée donne 38,583 hL à 13 °C, 32,331 hL à 16 °C et 27,731 hL à 20 °C. La conclusion de l'article, page 14, semble inverser les résultats à 13 et 20 °C. Conserver les coefficients et l'équation, et signaler cette incohérence plutôt que recopier ces deux chiffres.
- Le tableau 1 indique 6,7 % pour la liqueur à 650 g/L de glucose-fructose, tandis que le texte page 13 donne une approximation de 6,8 %. Le TAV renseigné pour la liqueur utilisée doit donc primer sur une règle automatique à deux valeurs.
- La partie 1, page 6, distingue la supplémentation éventuelle du vin de base du nourrissage du levain : la dose quotidienne de DAP de la partie 2 ne doit pas être appliquée automatiquement à tout le volume de vin de tirage.

## Parcours recommandé avant le raccordement des stocks

1. **Planifier la campagne** : journées, volumes, température de propagation, arrêts et éventuel maintien d'une mère ; en déduire le besoin initial et la capacité nécessaire.
2. **Préparer le levain initial** : enregistrer le protocole retenu, les LSA et les autres apports réellement utilisés, leurs lots/produits et les étapes réalisées. Le simple transfert initial reste une opération de constitution du milieu, sans déclarer à lui seul le levain prêt.
3. **Qualifier le levain pour le tirage** : conserver les contrôles et une validation de l'opérateur ; distinguer la préparation en cours, la disponibilité pour le tirage, la propagation et l'épuisement.
4. **Prélever le levain pour la mixtion** : mouvement réel depuis son lot, lié au tirage, avec contrôle de disponibilité. Une quantité calculée ne doit pas rester uniquement une ligne informative.
5. **Nourrir le volume restant** : recette fondée sur les mesures et l'horizon jusqu'au prochain prélèvement ; liqueur préparée ou fabrication avec sucre et vin, vin nourricier, eau et DAP à 20 g/hL du volume total après alimentation.
6. **Tracer les opérations et le suivi** : aération, agitation, température et analyses ; contrôles utiles au maintien du levain, en particulier lors des arrêts et passages de week-end. Le logiciel enregistre ces interventions, sans supposer qu'il commande les équipements.

Chaque opération physique doit conserver son propre événement et ses bilans. Pour une opération validée, les volumes des lots, les sorties d'intrants, les liens de traçabilité et l'audit doivent être enregistrés ensemble, sans écritures partielles ni double consommation. Les LSA de la préparation initiale doivent être distinguées d'un éventuel apport direct de levures au tirage.

Ce parcours a été validé par l'utilisateur puis implémenté dans la révision du 8 octobre 2026. Le tableau ci-dessus conserve le constat avant révision ; le parcours livré et ses vérifications sont décrits dans [Levains, intrants et tirage](levains.md). Le protocole détaillé de préparation initiale reste à renseigner à partir de la référence retenue par la cave.
