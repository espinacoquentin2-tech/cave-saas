export type LegalSlug =
  | "mentions-legales"
  | "confidentialite"
  | "conditions-utilisation"
  | "securite"
  | "cookies";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  slug: LegalSlug;
  shortTitle: string;
  title: string;
  summary: string;
  sections: LegalSection[];
};

export const LEGAL_CONFIG = {
  productName: "Ma Cuverie",
  editor: {
    legalName: "À compléter",
    legalForm: "À compléter",
    capital: "À compléter",
    siret: "À compléter",
    rcs: "À compléter",
    vatNumber: "À compléter",
    address: "À compléter",
    email: "contact@macuverie.fr",
    publicationDirector: "À compléter",
  },
  host: {
    name: "À compléter",
    address: "À compléter",
    website: "À compléter",
  },
  dataProtection: {
    contactEmail: "privacy@macuverie.fr",
    dpo: "Non désigné à ce stade / à compléter",
    subprocessors: ["Supabase", "Vercel"],
  },
  lastUpdated: "À compléter",
} as const;

const workInProgressNotice =
  "Document de travail à compléter avant mise en production publique. Ces informations doivent être adaptées à l'entité éditrice avant publication.";

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: "mentions-legales",
    shortTitle: "Mentions légales",
    title: "Mentions légales",
    summary: "Informations relatives à l'éditeur, à l'hébergement et aux responsabilités liées à Ma Cuverie.",
    sections: [
      {
        title: "Document de travail",
        paragraphs: [workInProgressNotice],
      },
      {
        title: "Éditeur du site / de l'application",
        paragraphs: [
          `${LEGAL_CONFIG.productName} est édité par : ${LEGAL_CONFIG.editor.legalName}.`,
        ],
        bullets: [
          `Forme juridique : ${LEGAL_CONFIG.editor.legalForm}`,
          `Capital social : ${LEGAL_CONFIG.editor.capital}`,
          `SIRET : ${LEGAL_CONFIG.editor.siret}`,
          `RCS : ${LEGAL_CONFIG.editor.rcs}`,
          `Numéro de TVA intracommunautaire : ${LEGAL_CONFIG.editor.vatNumber}`,
          `Adresse : ${LEGAL_CONFIG.editor.address}`,
        ],
      },
      {
        title: "Directeur de la publication",
        paragraphs: [`Directeur de la publication : ${LEGAL_CONFIG.editor.publicationDirector}.`],
      },
      {
        title: "Hébergeur",
        paragraphs: [`Le service est hébergé par : ${LEGAL_CONFIG.host.name}.`],
        bullets: [
          `Adresse : ${LEGAL_CONFIG.host.address}`,
          `Site web : ${LEGAL_CONFIG.host.website}`,
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Pour toute question relative au service : ${LEGAL_CONFIG.editor.email}.`],
      },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          "Les marques, textes, interfaces, éléments graphiques, noms, logos et contenus affichés dans Ma Cuverie appartiennent à leur titulaire respectif.",
          "Toute reproduction ou réutilisation non autorisée des éléments protégés doit faire l'objet d'une autorisation préalable.",
        ],
      },
      {
        title: "Responsabilité",
        paragraphs: [
          "Les informations affichées dans l'application sont fournies pour faciliter le suivi opérationnel de cave et de cuverie.",
          "L'éditeur s'efforce de maintenir un service fiable, sans promettre l'absence totale d'erreur, d'interruption ou d'indisponibilité.",
        ],
      },
      {
        title: "Signalement d'un problème",
        paragraphs: [
          `Un problème de contenu, de sécurité ou de fonctionnement peut être signalé à l'adresse suivante : ${LEGAL_CONFIG.editor.email}.`,
        ],
      },
      {
        title: "Date de dernière mise à jour",
        paragraphs: [LEGAL_CONFIG.lastUpdated],
      },
    ],
  },
  {
    slug: "confidentialite",
    shortTitle: "Confidentialité",
    title: "Politique de confidentialité",
    summary: "Principes de traitement des données de compte, des données métier et des journaux techniques.",
    sections: [
      {
        title: "Document de travail",
        paragraphs: [
          workInProgressNotice,
          "À adapter selon le statut juridique retenu. À compléter avant mise en production publique.",
        ],
      },
      {
        title: "Qui traite les données ?",
        paragraphs: [
          `${LEGAL_CONFIG.productName} est fourni par ${LEGAL_CONFIG.editor.legalName}. Les informations relatives à l'entité éditrice doivent être complétées avant publication.`,
        ],
      },
      {
        title: "Données traitées",
        paragraphs: [
          "Ma Cuverie traite les données de compte utilisateur nécessaires à l'accès au service.",
          "Ma Cuverie peut aussi traiter des données métier confiées par les organisations clientes dans le cadre de l'utilisation de l'application.",
        ],
        bullets: [
          "Identité et coordonnées professionnelles des utilisateurs.",
          "Rôle, droits d'accès et organisation de rattachement.",
          "Données de lots, caves, cuves, opérations, stocks, événements et journaux associés.",
          "Données techniques utiles au fonctionnement, à la sécurité et au diagnostic.",
        ],
      },
      {
        title: "Finalités",
        paragraphs: [
          "Les traitements visent à fournir l'accès au service, gérer les comptes, permettre le suivi métier, assurer la traçabilité, maintenir la sécurité et améliorer la fiabilité de l'application.",
        ],
      },
      {
        title: "Bases légales à compléter",
        paragraphs: [
          "Les bases légales doivent être confirmées selon le statut juridique retenu, la relation contractuelle et le rôle exact de chaque partie.",
          "Cette section doit être relue et adaptée avant toute mise en production publique.",
        ],
      },
      {
        title: "Données des comptes utilisateurs",
        paragraphs: [
          "Les données de compte permettent d'authentifier les utilisateurs, de leur attribuer un rôle et de rattacher chaque accès à une organisation.",
          "Les identifiants sont personnels et ne doivent pas être partagés.",
        ],
      },
      {
        title: "Données métier des domaines / maisons / caves",
        paragraphs: [
          "Les organisations clientes peuvent saisir des données métier relatives à leur activité de cave, de cuverie, de traçabilité, de stocks ou d'expédition.",
          "Certaines données métier peuvent relever du client en qualité de responsable de traitement. Ce point doit être adapté selon le contrat et le statut juridique retenu.",
        ],
      },
      {
        title: "Données techniques et journaux",
        paragraphs: [
          "Des journaux techniques et d'audit peuvent être conservés pour sécuriser l'accès, comprendre les actions effectuées et diagnostiquer les incidents.",
          "Ces journaux doivent être utilisés de manière proportionnée aux besoins de sécurité et de traçabilité.",
        ],
      },
      {
        title: "Destinataires",
        paragraphs: [
          "Les données sont destinées aux utilisateurs habilités de l'organisation concernée, à l'éditeur du service lorsque cela est nécessaire au support ou à la sécurité, et aux prestataires techniques intervenant pour l'hébergement ou le fonctionnement.",
        ],
      },
      {
        title: "Sous-traitants techniques",
        paragraphs: ["Les sous-traitants techniques identifiés à ce stade sont :"],
        bullets: LEGAL_CONFIG.dataProtection.subprocessors,
      },
      {
        title: "Durées de conservation à compléter",
        paragraphs: [
          "Les durées de conservation doivent être définies selon les besoins opérationnels, les obligations légales applicables et les contrats conclus avec les organisations clientes.",
          "À compléter avant mise en production publique.",
        ],
      },
      {
        title: "Droits des personnes",
        paragraphs: [
          "Sous réserve des conditions prévues par la réglementation applicable, les personnes concernées peuvent demander l'accès, la rectification, l'effacement, la limitation ou l'opposition au traitement de leurs données.",
          "Lorsque les données sont traitées pour le compte d'une organisation cliente, certaines demandes peuvent devoir être adressées ou transférées à cette organisation.",
        ],
      },
      {
        title: "Contact confidentialité",
        paragraphs: [
          `Contact confidentialité : ${LEGAL_CONFIG.dataProtection.contactEmail}.`,
          `DPO : ${LEGAL_CONFIG.dataProtection.dpo}.`,
        ],
      },
      {
        title: "Réclamation auprès de la CNIL",
        paragraphs: [
          "Les personnes concernées peuvent introduire une réclamation auprès de la CNIL si elles estiment que leurs droits ne sont pas respectés.",
        ],
      },
      {
        title: "Sécurité",
        paragraphs: [
          "Des mesures techniques et organisationnelles sont mises en place pour protéger les accès, limiter les droits selon les rôles et séparer les données des organisations.",
          "Ces mesures évoluent avec le service et ne constituent pas une garantie d'absence totale de risque.",
        ],
      },
      {
        title: "Date de dernière mise à jour",
        paragraphs: [LEGAL_CONFIG.lastUpdated],
      },
    ],
  },
  {
    slug: "conditions-utilisation",
    shortTitle: "Conditions d'utilisation",
    title: "Conditions d'utilisation",
    summary: "Règles d'accès, d'usage et de responsabilité applicables aux utilisateurs de Ma Cuverie.",
    sections: [
      {
        title: "Document de travail",
        paragraphs: [workInProgressNotice],
      },
      {
        title: "Objet du service",
        paragraphs: [
          "Ma Cuverie est une application SaaS destinée au suivi de cave, de cuverie, de lots, d'opérations, de stocks et de traçabilité.",
        ],
      },
      {
        title: "Accès au service",
        paragraphs: [
          "L'accès au service est réservé aux utilisateurs autorisés par leur organisation ou par l'éditeur du service.",
        ],
      },
      {
        title: "Comptes utilisateurs",
        paragraphs: [
          "Les identifiants sont personnels. Le partage de compte est interdit.",
          "L'utilisateur doit préserver la confidentialité de ses moyens d'accès et signaler toute suspicion d'utilisation non autorisée.",
        ],
      },
      {
        title: "Rôles et permissions",
        paragraphs: [
          "Les fonctionnalités accessibles dépendent du rôle attribué à l'utilisateur.",
          "Les droits peuvent être ajustés par les personnes habilitées de l'organisation.",
        ],
      },
      {
        title: "Un utilisateur = une organisation",
        paragraphs: [
          "Chaque compte utilisateur est rattaché à une seule organisation.",
          "L'utilisateur ne doit pas chercher à accéder aux données d'une autre organisation.",
        ],
      },
      {
        title: "Utilisation acceptable",
        paragraphs: [
          "L'utilisateur s'engage à utiliser le service conformément à sa destination, sans tentative d'accès non autorisé, d'altération, d'extraction abusive ou de perturbation du service.",
        ],
      },
      {
        title: "Données saisies par l'utilisateur",
        paragraphs: [
          "L'utilisateur ne doit saisir que des données qu'il est autorisé à traiter.",
          "L'organisation utilisatrice demeure responsable de la qualité, de la licéité et de la pertinence des données qu'elle renseigne dans le service.",
        ],
      },
      {
        title: "Disponibilité du service",
        paragraphs: [
          "L'éditeur cherche à assurer une disponibilité raisonnable du service, sans garantir une disponibilité permanente ou sans interruption.",
        ],
      },
      {
        title: "Maintenance",
        paragraphs: [
          "Des opérations de maintenance peuvent être réalisées pour corriger, sécuriser ou faire évoluer le service.",
        ],
      },
      {
        title: "Sauvegardes",
        paragraphs: [
          "Des mécanismes de sauvegarde peuvent être mis en place selon l'environnement technique retenu.",
          "Les modalités exactes de sauvegarde, de restauration et de conservation sont à compléter avant publication contractuelle.",
        ],
      },
      {
        title: "Responsabilités",
        paragraphs: [
          "L'utilisateur et son organisation sont responsables de l'exactitude des données saisies et de leur usage métier.",
          "L'éditeur ne remplace pas les contrôles professionnels, réglementaires ou qualité applicables à l'activité de l'organisation.",
        ],
      },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          "Le service, son interface, ses textes, ses éléments graphiques et ses développements appartiennent à leur titulaire respectif.",
        ],
      },
      {
        title: "Suspension d'accès",
        paragraphs: [
          "Un accès peut être suspendu en cas de risque de sécurité, d'utilisation abusive, de demande de l'organisation ou de nécessité opérationnelle.",
        ],
      },
      {
        title: "Évolution du service",
        paragraphs: [
          "Les fonctionnalités peuvent évoluer afin d'améliorer le service, corriger des anomalies ou répondre à de nouveaux besoins.",
        ],
      },
      {
        title: "Droit applicable",
        paragraphs: [
          "Le droit applicable et la juridiction compétente sont à compléter selon l'entité éditrice et les contrats conclus.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Contact : ${LEGAL_CONFIG.editor.email}.`],
      },
    ],
  },
  {
    slug: "securite",
    shortTitle: "Sécurité",
    title: "Sécurité & traitement des données",
    summary: "Mesures et limites relatives à la séparation des données, aux accès et à l'exploitation technique.",
    sections: [
      {
        title: "Document de travail",
        paragraphs: [workInProgressNotice],
      },
      {
        title: "Séparation des données par organisation",
        paragraphs: [
          "Ma Cuverie est conçue comme une application multi-entreprises dans laquelle les données sont séparées applicativement par organisation.",
          "Dans l'interface et les traitements applicatifs, cette séparation repose notamment sur l'organisation de rattachement des données.",
        ],
      },
      {
        title: "Règle un utilisateur = une organisation",
        paragraphs: [
          "Chaque compte utilisateur est rattaché à une seule organisation afin de limiter le périmètre des accès.",
        ],
      },
      {
        title: "Authentification",
        paragraphs: [
          "L'accès au service nécessite une authentification. Les identifiants sont personnels et doivent rester confidentiels.",
        ],
      },
      {
        title: "Rôles et permissions",
        paragraphs: [
          "Les droits fonctionnels sont limités selon le rôle de l'utilisateur. Ces rôles permettent de réduire les actions disponibles au strict besoin opérationnel.",
        ],
      },
      {
        title: "Journal d'audit",
        paragraphs: [
          "Certaines actions peuvent être historisées dans un journal d'audit afin d'améliorer la traçabilité, le diagnostic et la sécurité.",
        ],
      },
      {
        title: "Sauvegardes",
        paragraphs: [
          "Les modalités de sauvegarde et de restauration doivent être précisées selon l'environnement d'hébergement et les engagements retenus.",
        ],
      },
      {
        title: "Hébergement",
        paragraphs: [
          `Hébergeur à ce stade : ${LEGAL_CONFIG.host.name}. Les informations d'hébergement doivent être complétées avant publication.`,
        ],
      },
      {
        title: "Sous-traitants techniques",
        paragraphs: ["Les sous-traitants techniques identifiés à ce stade sont :"],
        bullets: LEGAL_CONFIG.dataProtection.subprocessors,
      },
      {
        title: "Chiffrement en transit",
        paragraphs: [
          "Les échanges avec le service doivent être réalisés via des connexions sécurisées lorsque l'application est déployée en production.",
        ],
      },
      {
        title: "Limites et responsabilités partagées",
        paragraphs: [
          "Aucune mesure de sécurité ne supprime totalement le risque. Ma Cuverie ne promet pas une sécurité absolue ou des données inviolables.",
          "La sécurité dépend aussi des pratiques des utilisateurs, de la gestion des droits, de la confidentialité des accès et de la qualité de configuration de l'environnement.",
        ],
      },
      {
        title: "Gestion des incidents",
        paragraphs: [
          "Les modalités de détection, qualification, notification et correction des incidents doivent être précisées avant une mise en production publique.",
        ],
      },
      {
        title: "Export / restitution des données à prévoir",
        paragraphs: [
          "Les modalités d'export, de restitution et de portabilité des données doivent être définies selon les engagements contractuels retenus.",
        ],
      },
      {
        title: "Suppression / archivage des données à prévoir",
        paragraphs: [
          "Les règles de suppression, d'archivage et de conservation doivent être précisées selon les besoins métier, les obligations légales et les contrats applicables.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    shortTitle: "Cookies / traceurs",
    title: "Cookies / traceurs",
    summary: "État actuel des traceurs nécessaires au fonctionnement, à l'authentification et à la sécurité.",
    sections: [
      {
        title: "Document de travail",
        paragraphs: [workInProgressNotice],
      },
      {
        title: "Utilisation des cookies et du stockage local",
        paragraphs: [
          "Ma Cuverie peut utiliser des cookies, du stockage local ou des mécanismes équivalents nécessaires au fonctionnement de l'application.",
        ],
      },
      {
        title: "Cookies nécessaires au fonctionnement",
        paragraphs: [
          "À ce stade, si aucun outil marketing ou analytics n'est installé, Ma Cuverie utilise uniquement les traceurs nécessaires au fonctionnement du service, à l'authentification et à la sécurité.",
        ],
      },
      {
        title: "Authentification et sécurité",
        paragraphs: [
          "Certains traceurs peuvent être nécessaires pour maintenir une session authentifiée, sécuriser l'accès et prévenir les usages non autorisés.",
        ],
      },
      {
        title: "Préférences d'interface",
        paragraphs: [
          "Des informations de préférence d'interface peuvent être conservées afin d'améliorer l'expérience utilisateur, par exemple l'affichage ou le thème.",
        ],
      },
      {
        title: "Mesure d'audience si ajoutée plus tard",
        paragraphs: [
          "Si un outil de mesure d'audience est ajouté ultérieurement, cette page devra être mise à jour pour décrire l'outil, les données collectées, les finalités et la durée de conservation.",
        ],
      },
      {
        title: "Cookies soumis au consentement si ajoutés plus tard",
        paragraphs: [
          "Si des traceurs non strictement nécessaires sont ajoutés, un mécanisme d'information et, si requis, de consentement devra être prévu selon l'outil et la réglementation applicable.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Pour toute question : ${LEGAL_CONFIG.editor.email}.`],
      },
    ],
  },
];

export const getLegalDocument = (slug: string): LegalDocument | undefined =>
  LEGAL_DOCUMENTS.find((document) => document.slug === slug);
