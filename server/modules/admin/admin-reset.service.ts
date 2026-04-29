import { Prisma } from '@prisma/client';

const DEMO_CAVE_NAME = 'Domaine des Trois Coteaux';

type Tx = Prisma.TransactionClient;

const decimal = (value: number, precision: number = 3) =>
  new Prisma.Decimal(value.toFixed(precision));

export interface AdminResetCounts {
  shipmentLines: number;
  shipments: number;
  bottleEventLinks: number;
  bottleEvents: number;
  bottleLots: number;
  analyses: number;
  faReadings: number;
  lotEventIntrants: number;
  lotEventContainers: number;
  lotEventLots: number;
  lotEvents: number;
  lotComponents: number;
  lots: number;
  maturations: number;
  degustations: number;
  pressings: number;
  pressoirs: number;
  stockMovements: number;
  products: number;
  containers: number;
  parcelles: number;
  operations: number;
}

export interface AdminSeedCounts {
  parcelles: number;
  maturations: number;
  containers: number;
  lots: number;
  lotComponents: number;
  analyses: number;
  products: number;
  stockMovements: number;
  lotEvents: number;
  lotEventLots: number;
  lotEventContainers: number;
  bottleLots: number;
  bottleEvents: number;
  bottleEventLinks: number;
  pressings: number;
  pressoirs: number;
  degustations: number;
  operations: number;
}

type SeedContext = {
  operatorEmail: string;
};

type ParcelleSeed = {
  commune: string;
  nom: string;
  grapeCode: 'CH' | 'PN' | 'PM';
  areaHa: number;
  sucreBase: number;
  tavpBase: number;
  atBase: number;
  phBase: number;
  maladie: 'Aucune' | 'Pourriture Grise';
  intensiteBase: number;
};

const createEmptyResetCounts = (): Omit<AdminResetCounts, 'operations'> => ({
  shipmentLines: 0,
  shipments: 0,
  bottleEventLinks: 0,
  bottleEvents: 0,
  bottleLots: 0,
  analyses: 0,
  faReadings: 0,
  lotEventIntrants: 0,
  lotEventContainers: 0,
  lotEventLots: 0,
  lotEvents: 0,
  lotComponents: 0,
  lots: 0,
  maturations: 0,
  degustations: 0,
  pressings: 0,
  pressoirs: 0,
  stockMovements: 0,
  products: 0,
  containers: 0,
  parcelles: 0,
});

const createEmptySeedCounts = (): Omit<AdminSeedCounts, 'operations'> => ({
  parcelles: 0,
  maturations: 0,
  containers: 0,
  lots: 0,
  lotComponents: 0,
  analyses: 0,
  products: 0,
  stockMovements: 0,
  lotEvents: 0,
  lotEventLots: 0,
  lotEventContainers: 0,
  bottleLots: 0,
  bottleEvents: 0,
  bottleEventLinks: 0,
  pressings: 0,
  pressoirs: 0,
  degustations: 0,
});

const withOperationCount = <T extends { lotEvents: number; bottleEvents: number }>(counts: T) => ({
  ...counts,
  operations: counts.lotEvents + counts.bottleEvents,
});

export class AdminResetService {
  static async resetBusinessData(tx: Tx): Promise<AdminResetCounts> {
    const counts = createEmptyResetCounts();

    counts.shipmentLines = (await tx.shipmentLine.deleteMany()).count;
    counts.shipments = (await tx.shipment.deleteMany()).count;

    counts.bottleEventLinks = (await tx.bottleEventLink.deleteMany()).count;
    counts.bottleEvents = (await tx.bottleEvent.deleteMany()).count;
    counts.bottleLots = (await tx.bottleLot.deleteMany()).count;

    counts.analyses = (await tx.analysis.deleteMany()).count;
    counts.faReadings = (await tx.faReading.deleteMany()).count;

    counts.lotEventIntrants = (await tx.lotEventIntrant.deleteMany()).count;
    counts.lotEventContainers = (await tx.lotEventContainer.deleteMany()).count;
    counts.lotEventLots = (await tx.lotEventLot.deleteMany()).count;
    counts.lotEvents = (await tx.lotEvent.deleteMany()).count;

    counts.lotComponents = (await tx.lotComponent.deleteMany()).count;
    counts.lots = (await tx.lot.deleteMany()).count;

    counts.maturations = (await tx.maturation.deleteMany()).count;
    counts.degustations = (await tx.degustation.deleteMany()).count;
    counts.pressings = (await tx.pressing.deleteMany()).count;
    counts.pressoirs = (await tx.pressoir.deleteMany()).count;

    counts.stockMovements = (await tx.stockMovement.deleteMany()).count;
    counts.products = (await tx.product.deleteMany()).count;

    const childContainers = await tx.container.deleteMany({
      where: { parentId: { not: null } },
    });
    const rootContainers = await tx.container.deleteMany({
      where: { parentId: null },
    });
    counts.containers = childContainers.count + rootContainers.count;

    counts.parcelles = (await tx.parcelle.deleteMany()).count;

    return withOperationCount(counts);
  }

  static async seedDemoData(tx: Tx, context: SeedContext): Promise<AdminSeedCounts> {
    const counts = createEmptySeedCounts();
    const operator = await tx.user.findFirst({
      where: { email: { equals: context.operatorEmail, mode: 'insensitive' } },
      select: { id: true, email: true },
    });

    if (!operator) {
      throw new Error('Utilisateur administrateur introuvable pour générer les données de démonstration.');
    }

    const parcellesSeed: ParcelleSeed[] = [
      { commune: 'Avize', nom: 'Les Grands Près', grapeCode: 'CH', areaHa: 1.2, sucreBase: 156, tavpBase: 9.1, atBase: 8.8, phBase: 2.94, maladie: 'Aucune', intensiteBase: 0 },
      { commune: 'Cramant', nom: 'Les Hautes Vignes', grapeCode: 'CH', areaHa: 0.85, sucreBase: 160, tavpBase: 9.4, atBase: 8.2, phBase: 2.97, maladie: 'Aucune', intensiteBase: 0 },
      { commune: 'Aÿ', nom: 'Les Longues Raies', grapeCode: 'PN', areaHa: 1.1, sucreBase: 164, tavpBase: 9.7, atBase: 7.4, phBase: 3.01, maladie: 'Aucune', intensiteBase: 1 },
      { commune: 'Bouzy', nom: 'Les Terres Rouges', grapeCode: 'PN', areaHa: 0.95, sucreBase: 167, tavpBase: 9.9, atBase: 7.1, phBase: 3.04, maladie: 'Aucune', intensiteBase: 0 },
      { commune: 'Damery', nom: 'Les Prés Bas', grapeCode: 'PM', areaHa: 1.4, sucreBase: 158, tavpBase: 9.2, atBase: 8.1, phBase: 2.98, maladie: 'Pourriture Grise', intensiteBase: 4 },
      { commune: 'Festigny', nom: 'Le Clos Martin', grapeCode: 'PM', areaHa: 0.75, sucreBase: 154, tavpBase: 8.9, atBase: 8.9, phBase: 2.92, maladie: 'Pourriture Grise', intensiteBase: 6 },
      { commune: 'Verzenay', nom: 'Les Montants', grapeCode: 'PN', areaHa: 1.3, sucreBase: 170, tavpBase: 10.1, atBase: 6.8, phBase: 3.08, maladie: 'Aucune', intensiteBase: 0 },
      { commune: 'Passy-Grigny', nom: 'Les Sablons', grapeCode: 'PM', areaHa: 0.9, sucreBase: 152, tavpBase: 8.8, atBase: 9.2, phBase: 2.9, maladie: 'Pourriture Grise', intensiteBase: 8 },
    ];

    const createdParcelles = new Map<string, { id: number; commune: string; nom: string; grapeCode: string; areaHa: number }>();
    for (const parcelle of parcellesSeed) {
      const created = await tx.parcelle.create({
        data: {
          nom: parcelle.nom,
          commune: parcelle.commune,
          region: 'Champagne',
          departement: 'Marne',
        },
      });

      createdParcelles.set(parcelle.nom, {
        id: created.id,
        commune: parcelle.commune,
        nom: parcelle.nom,
        grapeCode: parcelle.grapeCode,
        areaHa: parcelle.areaHa,
      });
      counts.parcelles += 1;

      const maturationDates = ['2026-08-05', '2026-08-12', '2026-08-19'];
      for (const [index, date] of maturationDates.entries()) {
        await tx.maturation.create({
          data: {
            date: new Date(`${date}T08:00:00.000Z`),
            parcelle: `${parcelle.commune} - ${parcelle.nom}`,
            parcelleId: created.id,
            cepage: parcelle.grapeCode,
            sucre: parcelle.sucreBase + index * 10,
            tavp: Number((parcelle.tavpBase + index * 0.55).toFixed(1)),
            at: Number((parcelle.atBase - index * 0.35).toFixed(1)),
            ph: Number((parcelle.phBase + index * 0.07).toFixed(2)),
            malique: Number((5.4 - index * 0.5 + (parcelle.grapeCode === 'PM' ? 0.5 : 0)).toFixed(1)),
            tartrique: Number((6.5 - index * 0.25 + (parcelle.grapeCode === 'CH' ? 0.4 : 0)).toFixed(1)),
            maladie: parcelle.maladie,
            intensite: Math.max(0, parcelle.intensiteBase - 1 + index),
            operator: operator.email,
            notes: `${DEMO_CAVE_NAME} · ${parcelle.areaHa.toFixed(2)} ha · suivi maturité`,
          },
        });
        counts.maturations += 1;
      }
    }

    await tx.pressoir.create({
      data: {
        nom: 'Pressoir Coquard 4000',
        type: 'Traditionnel',
        marque: 'Coquard',
        capacite: 4000,
        status: 'VIDE',
      },
    });
    await tx.pressoir.create({
      data: {
        nom: 'Pressoir Bucher XPlus',
        type: 'Pneumatique',
        marque: 'Bucher',
        capacite: 8000,
        status: 'PRET_ECOULAGE',
        loadKg: 6200,
        parcelle: 'Les Grands Près',
        cepage: 'CH',
      },
    });
    counts.pressoirs += 2;

    await tx.pressing.createMany({
      data: [
        { date: '2026-09-07', cru: 'Avize', cepage: 'CH', weight: decimal(6200), status: 'PRESSE' },
        { date: '2026-09-08', cru: 'Bouzy', cepage: 'PN', weight: decimal(5800), status: 'PRESSE' },
        { date: '2026-09-09', cru: 'Damery', cepage: 'PM', weight: decimal(7100), status: 'EN_ATTENTE' },
      ],
    });
    counts.pressings += 3;

    const inox25 = await tx.container.create({
      data: {
        code: 'CUV-INX-025-A',
        displayName: 'Cuve inox 25 hL A',
        type: 'CUVE_INOX',
        capacityValue: decimal(25),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Nord',
        status: 'EN_FERMENTATION',
      },
    });
    const inox50 = await tx.container.create({
      data: {
        code: 'CUV-INX-050-A',
        displayName: 'Cuve inox 50 hL A',
        type: 'CUVE_INOX',
        capacityValue: decimal(50),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Nord',
        status: 'EN_FERMENTATION',
      },
    });
    const inox100 = await tx.container.create({
      data: {
        code: 'CUV-INX-100-A',
        displayName: 'Cuve inox 100 hL A',
        type: 'CUVE_INOX',
        capacityValue: decimal(100),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Centrale',
        status: 'EN_ELEVAGE',
      },
    });
    const inox200 = await tx.container.create({
      data: {
        code: 'CUV-INX-200-A',
        displayName: 'Cuve inox 200 hL A',
        type: 'CUVE_INOX',
        capacityValue: decimal(200),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Centrale',
        status: 'RESERVE_TIRAGE',
      },
    });
    const compartimentee = await tx.container.create({
      data: {
        code: 'CUV-COMP-100-A',
        displayName: 'Cuve compartimentée 2 x 50 hL',
        type: 'CUVE_INOX',
        capacityValue: decimal(100),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Est',
        status: 'EN_SERVICE',
      },
    });
    const compartimentA = await tx.container.create({
      data: {
        code: 'CUV-COMP-050-A',
        displayName: 'Compartiment A 50 hL',
        type: 'COMPARTIMENT',
        capacityValue: decimal(50),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Est',
        status: 'EN_ELEVAGE',
        parentId: compartimentee.id,
      },
    });
    const compartimentB = await tx.container.create({
      data: {
        code: 'CUV-COMP-050-B',
        displayName: 'Compartiment B 50 hL',
        type: 'COMPARTIMENT',
        capacityValue: decimal(50),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Cuverie Est',
        status: 'EN_ELEVAGE',
        parentId: compartimentee.id,
      },
    });
    const foudre = await tx.container.create({
      data: {
        code: 'FOUDRE-030-A',
        displayName: 'Foudre 30 hL',
        type: 'FOUDRE',
        capacityValue: decimal(30),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Elevage Bois',
        status: 'EN_ELEVAGE',
      },
    });
    await tx.container.create({
      data: {
        code: 'BARRIQUE-228-A',
        displayName: 'Barrique 228 L A',
        type: 'BARRIQUE',
        capacityValue: decimal(2.28),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Elevage Bois',
        status: 'RESERVE_TIRAGE',
      },
    });
    await tx.container.create({
      data: {
        code: 'BARRIQUE-228-B',
        displayName: 'Barrique 228 L B',
        type: 'BARRIQUE',
        capacityValue: decimal(2.28),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Elevage Bois',
        status: 'A_NETTOYER',
      },
    });
    const demiMuidA = await tx.container.create({
      data: {
        code: 'DEMI-MUID-600-A',
        displayName: 'Demi-muid 600 L A',
        type: 'DEMI_MUID',
        capacityValue: decimal(6),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Elevage Bois',
        status: 'EN_ELEVAGE',
      },
    });
    const demiMuidB = await tx.container.create({
      data: {
        code: 'DEMI-MUID-600-B',
        displayName: 'Demi-muid 600 L B',
        type: 'DEMI_MUID',
        capacityValue: decimal(6),
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: 'Elevage Bois',
        status: 'VIDE',
      },
    });
    counts.containers += 12;

    const lotDefinitions = [
      {
        technicalCode: 'LOT-CH-AVIZE-2026',
        businessCode: 'CH-AVIZE-2026',
        year: 2026,
        mainGrapeCode: 'CH',
        placeCode: 'AVIZE-LES-GRANDS-PRES',
        sequenceNumber: 1,
        status: 'FERMENTATION_ALCOOLIQUE',
        currentVolume: 46.8,
        currentContainerId: inox50.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · sélection parcellaire Avize`,
        components: [{ grapeCode: 'CH', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-CH-CRAMANT-2026',
        businessCode: 'CH-CRAMANT-2026',
        year: 2026,
        mainGrapeCode: 'CH',
        placeCode: 'CRAMANT-LES-HAUTES-VIGNES',
        sequenceNumber: 2,
        status: 'MOUT_DEBOURBE',
        currentVolume: 23.6,
        currentContainerId: inox25.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · moût débourbé en froid`,
        components: [{ grapeCode: 'CH', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-PN-AY-2026',
        businessCode: 'PN-AY-2026',
        year: 2026,
        mainGrapeCode: 'PN',
        placeCode: 'AY-LES-LONGUES-RAIES',
        sequenceNumber: 3,
        status: 'VIN_DE_BASE',
        currentVolume: 98.2,
        currentContainerId: inox100.id,
        qualiteLot: 'TAILLE',
        notes: `${DEMO_CAVE_NAME} · base structurante`,
        components: [{ grapeCode: 'PN', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-PN-BOUZY-2026',
        businessCode: 'PN-BOUZY-2026',
        year: 2026,
        mainGrapeCode: 'PN',
        placeCode: 'BOUZY-LES-TERRES-ROUGES',
        sequenceNumber: 4,
        status: 'FERMENTATION_MALOLACTIQUE',
        currentVolume: 47.1,
        currentContainerId: compartimentA.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · lot parcellaire Bouzy`,
        components: [{ grapeCode: 'PN', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-ME-DAMERY-2026',
        businessCode: 'ME-DAMERY-2026',
        year: 2026,
        mainGrapeCode: 'PM',
        placeCode: 'DAMERY-LES-PRES-BAS',
        sequenceNumber: 5,
        status: 'VIN_DE_BASE',
        currentVolume: 43.9,
        currentContainerId: compartimentB.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · Meunier frais et souple`,
        components: [{ grapeCode: 'PM', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-ME-FESTIGNY-2026',
        businessCode: 'ME-FESTIGNY-2026',
        year: 2026,
        mainGrapeCode: 'PM',
        placeCode: 'FESTIGNY-LE-CLOS-MARTIN',
        sequenceNumber: 6,
        status: 'VIN_DE_BASE',
        currentVolume: 5.4,
        currentContainerId: demiMuidB.id,
        qualiteLot: 'TAILLE',
        notes: `${DEMO_CAVE_NAME} · lot test sur petit contenant`,
        components: [{ grapeCode: 'PM', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-BSA-BRUT-2026',
        businessCode: 'Assemblage BSA Brut',
        year: 2026,
        mainGrapeCode: 'MULTI',
        placeCode: 'DOMAINE-DES-TROIS-COTEAUX',
        sequenceNumber: 7,
        status: 'ASSEMBLAGE',
        currentVolume: 186.4,
        currentContainerId: inox200.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · base non millésimée`,
        components: [
          { grapeCode: 'CH', percentage: 52 },
          { grapeCode: 'PN', percentage: 28 },
          { grapeCode: 'PM', percentage: 20 },
        ],
      },
      {
        technicalCode: 'LOT-BASE-ROSE-2026',
        businessCode: 'Base Rosé',
        year: 2026,
        mainGrapeCode: 'PN',
        placeCode: 'DOMAINE-DES-TROIS-COTEAUX',
        sequenceNumber: 8,
        status: 'ASSEMBLAGE',
        currentVolume: 5.65,
        currentContainerId: demiMuidA.id,
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · base rosé de macération courte`,
        components: [
          { grapeCode: 'PN', percentage: 72 },
          { grapeCode: 'CH', percentage: 18 },
          { grapeCode: 'PM', percentage: 10 },
        ],
      },
      {
        technicalCode: 'LOT-RESERVE-2025',
        businessCode: 'Vin de réserve 2025',
        year: 2025,
        mainGrapeCode: 'MULTI',
        placeCode: 'DOMAINE-DES-TROIS-COTEAUX',
        sequenceNumber: 9,
        status: 'RESERVE',
        currentVolume: 28.7,
        currentContainerId: foudre.id,
        qualiteLot: 'RESERVE',
        notes: `${DEMO_CAVE_NAME} · réserve élevée sous bois`,
        components: [
          { grapeCode: 'CH', percentage: 45 },
          { grapeCode: 'PN', percentage: 35 },
          { grapeCode: 'PM', percentage: 20 },
        ],
      },
    ] as const;

    const createdLots = new Map<string, { id: number; currentContainerId: number | null }>();
    for (const definition of lotDefinitions) {
      const lot = await tx.lot.create({
        data: {
          technicalCode: definition.technicalCode,
          businessCode: definition.businessCode,
          year: definition.year,
          mainGrapeCode: definition.mainGrapeCode,
          placeCode: definition.placeCode,
          sequenceNumber: definition.sequenceNumber,
          status: definition.status,
          currentVolume: decimal(definition.currentVolume),
          currentContainerId: definition.currentContainerId,
          qualiteLot: definition.qualiteLot,
          notes: definition.notes,
        },
      });
      createdLots.set(definition.businessCode, {
        id: lot.id,
        currentContainerId: definition.currentContainerId ?? null,
      });
      counts.lots += 1;

      for (const component of definition.components) {
        await tx.lotComponent.create({
          data: {
            lotId: lot.id,
            grapeCode: component.grapeCode,
            percentage: decimal(component.percentage, 2),
          },
        });
        counts.lotComponents += 1;
      }
    }

    const analysisDefinitions = [
      { lotCode: 'CH-AVIZE-2026', analysisDate: '2026-09-11', alcohol: 10.4, ph: 3.04, at: 7.8, so2Free: 18, so2Total: 64, sucresResiduel: 1.8, aciditeVolatile: 0.18, turbiditeNtu: 140 },
      { lotCode: 'CH-CRAMANT-2026', analysisDate: '2026-09-11', alcohol: 10.1, ph: 3.01, at: 8.0, so2Free: 16, so2Total: 58, sucresResiduel: 2.2, aciditeVolatile: 0.16, turbiditeNtu: 165 },
      { lotCode: 'PN-AY-2026', analysisDate: '2026-09-12', alcohol: 10.8, ph: 3.09, at: 7.0, so2Free: 14, so2Total: 55, sucresResiduel: 1.5, aciditeVolatile: 0.22, turbiditeNtu: 95 },
      { lotCode: 'PN-BOUZY-2026', analysisDate: '2026-09-12', alcohol: 10.7, ph: 3.11, at: 6.8, so2Free: 15, so2Total: 57, sucresResiduel: 1.4, aciditeVolatile: 0.24, turbiditeNtu: 90 },
      { lotCode: 'ME-DAMERY-2026', analysisDate: '2026-09-13', alcohol: 10.0, ph: 3.03, at: 7.6, so2Free: 20, so2Total: 68, sucresResiduel: 2.1, aciditeVolatile: 0.17, turbiditeNtu: 120 },
      { lotCode: 'ME-FESTIGNY-2026', analysisDate: '2026-09-13', alcohol: 9.8, ph: 2.99, at: 8.2, so2Free: 19, so2Total: 70, sucresResiduel: 2.5, aciditeVolatile: 0.18, turbiditeNtu: 132 },
      { lotCode: 'Assemblage BSA Brut', analysisDate: '2026-10-03', alcohol: 10.6, ph: 3.08, at: 7.2, so2Free: 22, so2Total: 82, sucresResiduel: 1.6, aciditeVolatile: 0.21, turbiditeNtu: 60 },
      { lotCode: 'Base Rosé', analysisDate: '2026-10-04', alcohol: 10.5, ph: 3.1, at: 7.1, so2Free: 23, so2Total: 79, sucresResiduel: 1.9, aciditeVolatile: 0.23, turbiditeNtu: 70 },
      { lotCode: 'Vin de réserve 2025', analysisDate: '2026-10-05', alcohol: 10.9, ph: 3.14, at: 6.7, so2Free: 24, so2Total: 90, sucresResiduel: 1.2, aciditeVolatile: 0.26, turbiditeNtu: 45 },
    ] as const;

    for (const analysis of analysisDefinitions) {
      const lot = createdLots.get(analysis.lotCode);
      if (!lot) {
        continue;
      }

      await tx.analysis.create({
        data: {
          lotId: lot.id,
          analysisDate: new Date(`${analysis.analysisDate}T09:00:00.000Z`),
          alcohol: analysis.alcohol,
          ph: analysis.ph,
          at: analysis.at,
          so2Free: analysis.so2Free,
          so2Total: analysis.so2Total,
          notes: `${DEMO_CAVE_NAME} · analyse lot ${analysis.lotCode}`,
          extraData: {
            sucresResiduel: analysis.sucresResiduel,
            aciditeVolatile: analysis.aciditeVolatile,
            turbiditeNtu: analysis.turbiditeNtu,
          },
        },
      });
      counts.analyses += 1;
    }

    const productDefinitions = [
      { name: 'SO2 solution 6 %', category: 'Intrants', subCategory: 'Sulfites', unit: 'L', minStock: 20, currentStock: 48 },
      { name: 'Levure prise de mousse', category: 'Intrants', subCategory: 'Levures', unit: 'kg', minStock: 5, currentStock: 15 },
      { name: 'Levure fermentation alcoolique', category: 'Intrants', subCategory: 'Levures', unit: 'kg', minStock: 6, currentStock: 18 },
      { name: 'Nutriment levurien', category: 'Intrants', subCategory: 'Nutrition', unit: 'kg', minStock: 10, currentStock: 25 },
      { name: 'Bentonite', category: 'Intrants', subCategory: 'Collage', unit: 'kg', minStock: 30, currentStock: 120 },
      { name: 'Colle végétale', category: 'Intrants', subCategory: 'Collage', unit: 'L', minStock: 8, currentStock: 24 },
      { name: 'Tanin œnologique', category: 'Intrants', subCategory: 'Tannins', unit: 'kg', minStock: 3, currentStock: 8 },
      { name: 'Enzyme de débourbage', category: 'Intrants', subCategory: 'Enzymes', unit: 'kg', minStock: 4, currentStock: 12 },
      { name: 'Sucre de tirage', category: 'Intrants', subCategory: 'Sucres', unit: 'kg', minStock: 150, currentStock: 650 },
      { name: 'Adjuvant de remuage', category: 'Intrants', subCategory: 'Adjuvants', unit: 'L', minStock: 4, currentStock: 10 },
    ] as const;

    for (const productDefinition of productDefinitions) {
      const product = await tx.product.create({
        data: {
          name: productDefinition.name,
          category: productDefinition.category,
          subCategory: productDefinition.subCategory,
          unit: productDefinition.unit,
          minStock: decimal(productDefinition.minStock),
          currentStock: decimal(productDefinition.currentStock),
        },
      });
      counts.products += 1;

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: 'IN',
          quantity: decimal(productDefinition.currentStock),
          note: `${DEMO_CAVE_NAME} · stock initial démo`,
          operator: operator.email,
        },
      });
      counts.stockMovements += 1;
    }

    const bsaBrut = createdLots.get('Assemblage BSA Brut');
    const chAvize = createdLots.get('CH-AVIZE-2026');
    const chCramant = createdLots.get('CH-CRAMANT-2026');
    const pnAy = createdLots.get('PN-AY-2026');
    const pnBouzy = createdLots.get('PN-BOUZY-2026');
    const meDamery = createdLots.get('ME-DAMERY-2026');
    const reserve = createdLots.get('Vin de réserve 2025');
    const baseRose = createdLots.get('Base Rosé');

    if (!bsaBrut || !chAvize || !chCramant || !pnAy || !pnBouzy || !meDamery || !reserve || !baseRose) {
      throw new Error('Lots de démonstration incomplets après création.');
    }

    const lotEvent1 = await tx.lotEvent.create({
      data: {
        eventType: 'DEBOURBAGE',
        eventDatetime: new Date('2026-09-01T09:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · débourbage statique Chardonnay Avize`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent1.id,
        lotId: chAvize.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(46.8),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent1.id,
        containerId: inox50.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent2 = await tx.lotEvent.create({
      data: {
        eventType: 'LEVURAGE',
        eventDatetime: new Date('2026-09-01T14:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · levurage Chardonnay Cramant`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent2.id,
        lotId: chCramant.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(23.6),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent2.id,
        containerId: inox25.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent3 = await tx.lotEvent.create({
      data: {
        eventType: 'FERMENTATION_ALCOOLIQUE',
        eventDatetime: new Date('2026-09-03T08:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · départ FA Pinot Noir Aÿ`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent3.id,
        lotId: pnAy.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(98.2),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent3.id,
        containerId: inox100.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent4 = await tx.lotEvent.create({
      data: {
        eventType: 'SOUTIRAGE',
        eventDatetime: new Date('2026-09-09T10:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · soutirage Pinot Noir Bouzy`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent4.id,
        lotId: pnBouzy.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(47.1),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent4.id,
        containerId: compartimentA.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent5 = await tx.lotEvent.create({
      data: {
        eventType: 'SULFITAGE',
        eventDatetime: new Date('2026-09-10T11:30:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · sulfitage Meunier Damery`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent5.id,
        lotId: meDamery.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(43.9),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent5.id,
        containerId: compartimentB.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent6 = await tx.lotEvent.create({
      data: {
        eventType: 'ASSEMBLAGE',
        eventDatetime: new Date('2026-10-01T08:30:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · assemblage BSA Brut`,
      },
    });
    counts.lotEvents += 1;
    for (const link of [
      { lotId: chAvize.id, roleInEvent: 'SOURCE', volumeChange: 55 },
      { lotId: pnAy.id, roleInEvent: 'SOURCE', volumeChange: 75 },
      { lotId: meDamery.id, roleInEvent: 'SOURCE', volumeChange: 38 },
      { lotId: reserve.id, roleInEvent: 'SOURCE', volumeChange: 18.4 },
      { lotId: bsaBrut.id, roleInEvent: 'CIBLE', volumeChange: 186.4 },
    ]) {
      await tx.lotEventLot.create({
        data: {
          eventId: lotEvent6.id,
          lotId: link.lotId,
          roleInEvent: link.roleInEvent,
          volumeChange: decimal(link.volumeChange),
        },
      });
      counts.lotEventLots += 1;
    }
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent6.id,
        containerId: inox200.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent7 = await tx.lotEvent.create({
      data: {
        eventType: 'ASSEMBLAGE',
        eventDatetime: new Date('2026-10-02T09:30:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · préparation Base Rosé`,
      },
    });
    counts.lotEvents += 1;
    for (const link of [
      { lotId: pnBouzy.id, roleInEvent: 'SOURCE', volumeChange: 3.2 },
      { lotId: chAvize.id, roleInEvent: 'SOURCE', volumeChange: 1.45 },
      { lotId: meDamery.id, roleInEvent: 'SOURCE', volumeChange: 1.0 },
      { lotId: baseRose.id, roleInEvent: 'CIBLE', volumeChange: 5.65 },
    ]) {
      await tx.lotEventLot.create({
        data: {
          eventId: lotEvent7.id,
          lotId: link.lotId,
          roleInEvent: link.roleInEvent,
          volumeChange: decimal(link.volumeChange),
        },
      });
      counts.lotEventLots += 1;
    }
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent7.id,
        containerId: demiMuidA.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent8 = await tx.lotEvent.create({
      data: {
        eventType: 'PREPARATION_TIRAGE',
        eventDatetime: new Date('2027-03-05T08:45:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · préparation de liqueur de tirage BSA`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent8.id,
        lotId: bsaBrut.id,
        roleInEvent: 'SOURCE',
        volumeChange: decimal(111),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent8.id,
        containerId: inox200.id,
        roleInEvent: 'SOURCE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent9 = await tx.lotEvent.create({
      data: {
        eventType: 'TIRAGE',
        eventDatetime: new Date('2027-03-06T07:30:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · tirage cuvée BSA Brut`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent9.id,
        lotId: bsaBrut.id,
        roleInEvent: 'SOURCE',
        volumeChange: decimal(111),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent9.id,
        containerId: inox200.id,
        roleInEvent: 'SOURCE',
      },
    });
    counts.lotEventContainers += 1;

    const lotEvent10 = await tx.lotEvent.create({
      data: {
        eventType: 'ELEVAGE',
        eventDatetime: new Date('2026-11-15T10:15:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · suivi élevage réserve 2025`,
      },
    });
    counts.lotEvents += 1;
    await tx.lotEventLot.create({
      data: {
        eventId: lotEvent10.id,
        lotId: reserve.id,
        roleInEvent: 'CIBLE',
        volumeChange: decimal(28.7),
      },
    });
    counts.lotEventLots += 1;
    await tx.lotEventContainer.create({
      data: {
        eventId: lotEvent10.id,
        containerId: foudre.id,
        roleInEvent: 'CIBLE',
      },
    });
    counts.lotEventContainers += 1;

    const tirage1 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-TIRAGE-2027-0001',
        businessCode: 'Tirage BSA Brut Lot 1',
        type: 'TIRAGE',
        sourceLotId: bsaBrut.id,
        formatCode: '75cl',
        initialBottleCount: 3600,
        currentBottleCount: 3600,
        status: 'SUR_LATTES',
        tirageDate: new Date('2027-03-06T09:00:00.000Z'),
        locationZone: 'Cellier A',
        locationRack: 'Rack 01',
        locationPalette: 'PAL-001',
      },
    });
    const tirage2 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-TIRAGE-2027-0002',
        businessCode: 'Tirage BSA Brut Lot 2',
        type: 'TIRAGE',
        sourceLotId: bsaBrut.id,
        formatCode: '75cl',
        initialBottleCount: 3200,
        currentBottleCount: 3200,
        status: 'SUR_LATTES',
        tirageDate: new Date('2027-03-06T10:30:00.000Z'),
        locationZone: 'Cellier A',
        locationRack: 'Rack 02',
        locationPalette: 'PAL-002',
      },
    });
    const tirage3 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-TIRAGE-2027-0003',
        businessCode: 'Tirage BSA Brut Lot 3',
        type: 'TIRAGE',
        sourceLotId: bsaBrut.id,
        formatCode: '75cl',
        initialBottleCount: 2800,
        currentBottleCount: 2800,
        status: 'SUR_LATTES',
        tirageDate: new Date('2027-03-07T08:45:00.000Z'),
        locationZone: 'Cellier B',
        locationRack: 'Rack 03',
        locationPalette: 'PAL-003',
      },
    });
    const tirageRose = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-TIRAGE-2027-ROSE-0001',
        businessCode: 'Tirage Base Rosé',
        type: 'TIRAGE',
        sourceLotId: baseRose.id,
        formatCode: '75cl',
        initialBottleCount: 600,
        currentBottleCount: 600,
        status: 'SUR_LATTES',
        tirageDate: new Date('2027-03-07T11:00:00.000Z'),
        locationZone: 'Cellier Rose',
        locationRack: 'Rack 01',
        locationPalette: 'PAL-ROSE-01',
      },
    });
    const degorge1 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-DEG-2028-0001',
        businessCode: 'Dégorgé BSA Brut Lot 1',
        type: 'DEGORGE',
        sourceLotId: bsaBrut.id,
        sourceBottleLotId: tirage1.id,
        formatCode: '75cl',
        initialBottleCount: 1600,
        currentBottleCount: 1568,
        status: 'DEGORGE',
        tirageDate: tirage1.tirageDate,
        degorgementDate: new Date('2028-06-14T08:30:00.000Z'),
        dosageValue: decimal(7, 1),
        dosageUnit: 'g/L',
        locationZone: 'Habillage',
        locationRack: 'Poste 01',
        locationPalette: 'PAL-DEG-01',
      },
    });
    const degorge2 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-DEG-2028-0002',
        businessCode: 'Dégorgé BSA Brut Lot 2',
        type: 'DEGORGE',
        sourceLotId: bsaBrut.id,
        sourceBottleLotId: tirage2.id,
        formatCode: '75cl',
        initialBottleCount: 1400,
        currentBottleCount: 1376,
        status: 'DEGORGE',
        tirageDate: tirage2.tirageDate,
        degorgementDate: new Date('2028-06-15T08:45:00.000Z'),
        dosageValue: decimal(8, 1),
        dosageUnit: 'g/L',
        locationZone: 'Habillage',
        locationRack: 'Poste 02',
        locationPalette: 'PAL-DEG-02',
      },
    });
    const pretExpedition = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-HAB-2028-0001',
        businessCode: 'Brut prêt expédition',
        type: 'HABILLE',
        sourceLotId: bsaBrut.id,
        sourceBottleLotId: degorge1.id,
        formatCode: '75cl',
        initialBottleCount: 1000,
        currentBottleCount: 990,
        status: 'PRET_EXPEDITION',
        tirageDate: tirage3.tirageDate,
        degorgementDate: new Date('2028-06-20T07:30:00.000Z'),
        dosageValue: decimal(8, 1),
        dosageUnit: 'g/L',
        locationZone: 'Expédition',
        locationRack: 'Zone A',
        locationPalette: 'PAL-EXP-01',
      },
    });
    counts.bottleLots += 7;

    const bottleEvent1 = await tx.bottleEvent.create({
      data: {
        eventType: 'CREATION_TIRAGE',
        eventDatetime: new Date('2027-03-07T12:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · tirage campagne 2027`,
      },
    });
    counts.bottleEvents += 1;
    for (const bottleLot of [tirage1, tirage2, tirage3, tirageRose]) {
      await tx.bottleEventLink.create({
        data: {
          eventId: bottleEvent1.id,
          bottleLotId: bottleLot.id,
          roleInEvent: 'CIBLE',
          bottleCount: bottleLot.currentBottleCount,
        },
      });
      counts.bottleEventLinks += 1;
    }

    const bottleEvent2 = await tx.bottleEvent.create({
      data: {
        eventType: 'DEGORGEMENT',
        eventDatetime: new Date('2028-06-15T09:15:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · dégorgement deux lots BSA`,
      },
    });
    counts.bottleEvents += 1;
    for (const bottleLot of [degorge1, degorge2]) {
      await tx.bottleEventLink.create({
        data: {
          eventId: bottleEvent2.id,
          bottleLotId: bottleLot.id,
          roleInEvent: 'CIBLE',
          bottleCount: bottleLot.currentBottleCount,
        },
      });
      counts.bottleEventLinks += 1;
    }

    const bottleEvent3 = await tx.bottleEvent.create({
      data: {
        eventType: 'HABILLAGE',
        eventDatetime: new Date('2028-06-21T08:00:00.000Z'),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · lot prêt à expédier`,
      },
    });
    counts.bottleEvents += 1;
    await tx.bottleEventLink.create({
      data: {
        eventId: bottleEvent3.id,
        bottleLotId: pretExpedition.id,
        roleInEvent: 'CIBLE',
        bottleCount: pretExpedition.currentBottleCount,
      },
    });
    counts.bottleEventLinks += 1;

    await tx.degustation.createMany({
      data: [
        {
          date: new Date('2026-08-19T10:00:00.000Z'),
          phase: 'BAIES',
          parcelle: `${createdParcelles.get('Les Grands Près')?.commune} - Les Grands Près`,
          robe: 'Jaune clair',
          nez: 'Agrumes, craie humide',
          bouche: 'Pulpe ferme, acidité nette',
          noteGlobale: 15.8,
          operator: operator.email,
          notes: `${DEMO_CAVE_NAME} · maturité homogène`,
        },
        {
          date: new Date('2026-10-06T09:30:00.000Z'),
          phase: 'VINS_CLAIRS',
          lotId: String(chAvize.id),
          robe: 'Cristalline',
          nez: 'Citron confit, fleurs blanches',
          bouche: 'Droite, saline, finale longue',
          noteGlobale: 16.4,
          operator: operator.email,
          notes: `${DEMO_CAVE_NAME} · base prometteuse pour l'assemblage`,
        },
        {
          date: new Date('2028-06-22T14:00:00.000Z'),
          phase: 'FINI',
          bottleLotId: String(pretExpedition.id),
          robe: 'Or pâle',
          nez: 'Pomme fraîche, viennoiserie',
          bouche: 'Bulles fines, dosage discret',
          noteGlobale: 17.1,
          sucreTest: 8,
          operator: operator.email,
          notes: `${DEMO_CAVE_NAME} · lot commercialisable`,
        },
      ],
    });
    counts.degustations += 3;

    return withOperationCount(counts);
  }
}
