# Site de lancement

Ma Cuverie expose maintenant une page publique de lancement et conserve l'application connectée sur une route dédiée.

## Routes

- `/` : landing page publique.
- `/app` : application connectée, avec écran de login si aucune session n'est active.
- `/legal/[slug]` : pages juridiques publiques.

## Démo

Le bouton `Demander une démo` utilise actuellement un lien email :

```text
contact@macuverie.fr
```

Cette adresse est à remplacer si une autre adresse professionnelle est retenue.

Aucun formulaire backend et aucun outil analytics ne sont ajoutés pour cette première version.

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
- Prévoir plus tard un formulaire de demande de démo si le volume de demandes le justifie.
