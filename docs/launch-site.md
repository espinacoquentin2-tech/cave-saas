# Site de lancement

Ma Cuverie expose une page publique de lancement orientée produit et OAD, tout en conservant l'application connectée sur une route dédiée.

## Routes

- `/` : landing page publique orientée tableau de bord de cave et aide à la décision œnologique.
- `/app` : application connectée, avec écran de login si aucune session n'est active.
- `/legal/[slug]` : pages juridiques publiques.

## Sections publiques

La landing met en avant :

- un hero avec mockup produit CSS ;
- le parcours métier de la maturité à l'expédition ;
- les OAD intégrés au quotidien de la cave ;
- le tableau de bord de cuverie pour visualiser volumes, lots, contenants et priorités ;
- la traçabilité, les rôles et la séparation des données ;
- le positionnement œnologique de Ma Cuverie ;
- un CTA final de demande de démo.

## Démo

Le bouton `Demander une démo` utilise actuellement un lien email :

```text
contact@macuverie.fr
```

Cette adresse est à remplacer si une autre adresse professionnelle est retenue.

Aucun formulaire backend et aucun outil analytics ne sont ajoutés pour cette première version.
Les visuels de la landing sont des mockups HTML/CSS/SVG illustratifs et ne s'appuient sur aucune donnée métier réelle. La landing ne charge aucune donnée client.

## Pages juridiques

Les liens du footer pointent vers :

- `/legal/mentions-legales`
- `/legal/confidentialite`
- `/legal/conditions-utilisation`
- `/legal/securite`
- `/legal/cookies`

Le contenu des pages juridiques reste centralisé dans `lib/legal-content.ts`.

## Prochaines étapes

- Brancher le domaine public.
- Configurer l'environnement de production.
- Compléter les documents juridiques avec les informations réelles.
- Créer ou valider l'email professionnel de contact.
- Déployer la production Vercel / Supabase.
- Prévoir plus tard un formulaire de demande de démo si le volume de demandes le justifie.
- Ajouter des captures produit réelles lorsque l'interface commerciale sera finalisée.
