# Pages juridiques

Ma Cuverie centralise les contenus juridiques dans `lib/legal-content.ts`.

## Emplacement du contenu

- Configuration éditeur, hébergeur et confidentialité : `LEGAL_CONFIG`
- Liste des documents : `LEGAL_DOCUMENTS`
- Recherche d'un document par slug : `getLegalDocument(slug)`

Les pages publiques utilisent la route dynamique `app/legal/[slug]/page.tsx`.
Le module connecté utilise `components/modules/LegalDocuments.tsx`.

## Pages disponibles

- `/legal/mentions-legales` : Mentions légales
- `/legal/confidentialite` : Politique de confidentialité
- `/legal/conditions-utilisation` : Conditions d'utilisation
- `/legal/securite` : Sécurité & traitement des données
- `/legal/cookies` : Cookies / traceurs

Dans l'application connectée, les mêmes contenus sont accessibles depuis le module Système, entrée `Documents juridiques`.

## Modifier les informations éditeur / hébergeur

Mettre à jour `LEGAL_CONFIG` dans `lib/legal-content.ts` :

- `editor.legalName`
- `editor.legalForm`
- `editor.capital`
- `editor.siret`
- `editor.rcs`
- `editor.vatNumber`
- `editor.address`
- `editor.email`
- `editor.publicationDirector`
- `host.name`
- `host.address`
- `host.website`
- `dataProtection.contactEmail`
- `dataProtection.dpo`
- `dataProtection.subprocessors`
- `lastUpdated`

Ne pas inventer de SIRET, d'adresse, de société ou de certification. Laisser `À compléter` tant que l'information réelle n'est pas validée.

## À compléter avant publication

- Informations exactes de l'entité éditrice.
- Informations exactes de l'hébergeur.
- Bases légales de la politique de confidentialité.
- Durées de conservation.
- Modalités de sauvegarde, restitution, export, suppression et archivage.
- Modalités de gestion des incidents.
- Droit applicable et clauses contractuelles associées.
- Éventuels outils de mesure d'audience ou traceurs soumis au consentement.

## Relecture juridique

Ces documents sont une structure de travail. Ils doivent être relus et adaptés par un professionnel du droit avant lancement commercial ou mise en production publique.
