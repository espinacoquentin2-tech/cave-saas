import { Prisma } from '@prisma/client';
import { logger, serializeErrorDetails } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';

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
  requestId?: string;
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

type SeedOperator = {
  id: number;
  email: string;
};

type CreatedParcelle = {
  id: number;
  commune: string;
  nom: string;
  grapeCode: ParcelleSeed['grapeCode'];
  areaHa: number;
};

type SeedContainerMap = Map<string, number>;
type SeedLotMap = Map<string, number>;

const SEED_TRANSACTION_OPTIONS = {
  timeout: 30000,
  maxWait: 10000,
} as const;

const getPrismaModelName = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (typeof error.meta?.modelName === 'string') {
    return error.meta.modelName;
  }

  if (Array.isArray(error.meta?.target) && error.meta.target.length > 0) {
    return String(error.meta.target[0]);
  }

  return null;
};

export class AdminSeedError extends Error {
  constructor(
    message: string,
    public readonly block: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AdminSeedError';
  }
}

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

    await tx.idempotencyRecord.deleteMany();
    await tx.auditLog.deleteMany();

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

  static async seedDemoData(context: SeedContext): Promise<AdminSeedCounts> {
    const counts = createEmptySeedCounts();
    const operator = await prisma.user.findFirst({
      where: { email: { equals: context.operatorEmail, mode: 'insensitive' } },
      select: { id: true, email: true },
    });

    if (!operator) {
      throw new Error('Utilisateur administrateur introuvable pour générer les données de démonstration.');
    }

    const createdParcelles = await this.runSeedBlock(
      'parcelles_maturations',
      context.requestId,
      async (tx) => this.seedParcellesAndMaturations(tx, operator, counts),
    );

    await this.runSeedBlock(
      'pressoirs_pressings',
      context.requestId,
      async (tx) => this.seedPressingsAndPressoirs(tx, counts),
    );

    const containerIds = await this.runSeedBlock(
      'containers_compartments',
      context.requestId,
      async (tx) => this.seedContainers(tx, counts),
    );

    const lotIds = await this.runSeedBlock(
      'lots_analyses_components',
      context.requestId,
      async (tx) => this.seedLotsAndAnalyses(tx, counts, containerIds),
    );

    await this.runSeedBlock(
      'products_stock_movements',
      context.requestId,
      async (tx) => this.seedProductsAndStockMovements(tx, operator, counts),
    );

    await this.runSeedBlock(
      'lot_events',
      context.requestId,
      async (tx) => this.seedLotEvents(tx, operator, counts, containerIds, lotIds),
    );

    await this.runSeedBlock(
      'bottle_lots_events_degustations',
      context.requestId,
      async (tx) => this.seedBottleLotsEventsAndDegustations(tx, operator, counts, lotIds, createdParcelles),
    );

    return withOperationCount(counts);
  }

  private static async runSeedBlock<T>(
    block: string,
    requestId: string | undefined,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    try {
      return await prisma.$transaction(async (tx) => work(tx), SEED_TRANSACTION_OPTIONS);
    } catch (error) {
      const prismaModel = getPrismaModelName(error);
      logger.error({
        action: 'admin.reset-database.seed.block_failed',
        requestId,
        details: {
          block,
          ...(prismaModel ? { prismaModel } : {}),
          ...serializeErrorDetails(error),
        },
      });

      throw new AdminSeedError(
        `Le rechargement des données de démonstration a échoué dans le bloc "${block}"${prismaModel ? ` (${prismaModel})` : ''}.`,
        block,
        error,
      );
    }
  }

  private static async seedParcellesAndMaturations(
    tx: Tx,
    operator: SeedOperator,
    counts: Omit<AdminSeedCounts, 'operations'>,
  ): Promise<Map<string, CreatedParcelle>> {
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

    const parcelleInsert = await tx.parcelle.createMany({
      data: parcellesSeed.map((parcelle) => ({
        nom: parcelle.nom,
        commune: parcelle.commune,
        region: 'Champagne',
        departement: 'Marne',
      })),
    });
    counts.parcelles += parcelleInsert.count;

    const parcelleRecords = await tx.parcelle.findMany({
      where: {
        nom: { in: parcellesSeed.map((parcelle) => parcelle.nom) },
      },
      select: {
        id: true,
        commune: true,
        nom: true,
      },
    });

    const parcelleMap = new Map(
      parcelleRecords.map((record) => [record.nom, record] as const),
    );
    const createdParcelles = new Map<string, CreatedParcelle>();

    for (const parcelle of parcellesSeed) {
      const record = parcelleMap.get(parcelle.nom);
      if (!record) {
        throw new Error(`Parcelle démo introuvable après insertion: ${parcelle.nom}.`);
      }

      createdParcelles.set(parcelle.nom, {
        id: record.id,
        commune: record.commune ?? parcelle.commune,
        nom: record.nom,
        grapeCode: parcelle.grapeCode,
        areaHa: parcelle.areaHa,
      });
    }

    const maturationDates = ['2026-08-05', '2026-08-12', '2026-08-19'] as const;
    const maturationRows = parcellesSeed.flatMap((parcelle) => {
      const created = createdParcelles.get(parcelle.nom);
      if (!created) {
        throw new Error(`Parcelle démo absente de la map: ${parcelle.nom}.`);
      }

      return maturationDates.map((date, index) => ({
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
      }));
    });

    const maturationInsert = await tx.maturation.createMany({
      data: maturationRows,
    });
    counts.maturations += maturationInsert.count;

    return createdParcelles;
  }

  private static async seedPressingsAndPressoirs(
    tx: Tx,
    counts: Omit<AdminSeedCounts, 'operations'>,
  ) {
    const pressoirInsert = await tx.pressoir.createMany({
      data: [
        {
          nom: 'Pressoir Coquard 4000',
          type: 'Traditionnel',
          marque: 'Coquard',
          capacite: 4000,
          status: 'VIDE',
        },
        {
          nom: 'Pressoir Bucher XPlus',
          type: 'Pneumatique',
          marque: 'Bucher',
          capacite: 8000,
          status: 'PRET_ECOULAGE',
          loadKg: 6200,
          parcelle: 'Les Grands Près',
          cepage: 'CH',
        },
      ],
    });
    counts.pressoirs += pressoirInsert.count;

    const pressingInsert = await tx.pressing.createMany({
      data: [
        { date: '2026-09-07', cru: 'Avize', cepage: 'CH', weight: decimal(6200), status: 'PRESSE' },
        { date: '2026-09-08', cru: 'Bouzy', cepage: 'PN', weight: decimal(5800), status: 'PRESSE' },
        { date: '2026-09-09', cru: 'Damery', cepage: 'PM', weight: decimal(7100), status: 'EN_ATTENTE' },
      ],
    });
    counts.pressings += pressingInsert.count;
  }

  private static async seedContainers(
    tx: Tx,
    counts: Omit<AdminSeedCounts, 'operations'>,
  ): Promise<SeedContainerMap> {
    const rootContainers = [
      { code: 'CUV-INX-025-A', displayName: 'Cuve inox 25 hL A', type: 'CUVE_INOX', capacityValue: decimal(25), zone: 'Cuverie Nord', status: 'EN_FERMENTATION' },
      { code: 'CUV-INX-050-A', displayName: 'Cuve inox 50 hL A', type: 'CUVE_INOX', capacityValue: decimal(50), zone: 'Cuverie Nord', status: 'EN_FERMENTATION' },
      { code: 'CUV-INX-100-A', displayName: 'Cuve inox 100 hL A', type: 'CUVE_INOX', capacityValue: decimal(100), zone: 'Cuverie Centrale', status: 'EN_ELEVAGE' },
      { code: 'CUV-INX-200-A', displayName: 'Cuve inox 200 hL A', type: 'CUVE_INOX', capacityValue: decimal(200), zone: 'Cuverie Centrale', status: 'RESERVE_TIRAGE' },
      { code: 'CUV-INX-120-B', displayName: 'Cuve inox 120 hL B', type: 'CUVE_INOX', capacityValue: decimal(120), zone: 'Cuverie Assemblages', status: 'VIDE' },
      { code: 'CUV-INX-060-B', displayName: 'Cuve inox 60 hL B', type: 'CUVE_INOX', capacityValue: decimal(60), zone: 'Cuverie Assemblages', status: 'VIDE' },
      { code: 'CUV-INX-015-ROUGE', displayName: 'Cuve inox 15 hL Rouge', type: 'CUVE_INOX', capacityValue: decimal(15), zone: 'Cuverie Rouge', status: 'EN_ELEVAGE' },
      { code: 'CUV-COMP-100-A', displayName: 'Cuve compartimentée 2 x 50 hL', type: 'CUVE_INOX', capacityValue: decimal(100), zone: 'Cuverie Est', status: 'EN_SERVICE' },
      { code: 'FOUDRE-030-A', displayName: 'Foudre 30 hL', type: 'FOUDRE', capacityValue: decimal(30), zone: 'Elevage Bois', status: 'EN_ELEVAGE' },
      { code: 'BARRIQUE-228-A', displayName: 'Barrique 228 L A', type: 'BARRIQUE', capacityValue: decimal(2.28), zone: 'Elevage Bois', status: 'RESERVE_TIRAGE' },
      { code: 'BARRIQUE-228-B', displayName: 'Barrique 228 L B', type: 'BARRIQUE', capacityValue: decimal(2.28), zone: 'Elevage Bois', status: 'A_NETTOYER' },
      { code: 'DEMI-MUID-600-A', displayName: 'Demi-muid 600 L A', type: 'DEMI_MUID', capacityValue: decimal(6), zone: 'Elevage Bois', status: 'EN_ELEVAGE' },
      { code: 'DEMI-MUID-600-B', displayName: 'Demi-muid 600 L B', type: 'DEMI_MUID', capacityValue: decimal(6), zone: 'Elevage Bois', status: 'VIDE' },
    ] as const;

    const rootInsert = await tx.container.createMany({
      data: rootContainers.map((container) => ({
        code: container.code,
        displayName: container.displayName,
        type: container.type,
        capacityValue: container.capacityValue,
        capacityUnit: 'hL',
        site: DEMO_CAVE_NAME,
        zone: container.zone,
        status: container.status,
      })),
    });
    counts.containers += rootInsert.count;

    const rootRecords = await tx.container.findMany({
      where: {
        code: { in: rootContainers.map((container) => container.code) },
      },
      select: {
        id: true,
        code: true,
      },
    });
    const rootMap = new Map(rootRecords.map((container) => [container.code, container.id] as const));
    const parentId = rootMap.get('CUV-COMP-100-A');

    if (!parentId) {
      throw new Error('Cuve parent compartimentée introuvable après insertion.');
    }

    const childInsert = await tx.container.createMany({
      data: [
        {
          code: 'CUV-COMP-050-A',
          displayName: 'Compartiment A 50 hL',
          type: 'COMPARTIMENT',
          capacityValue: decimal(50),
          capacityUnit: 'hL',
          site: DEMO_CAVE_NAME,
          zone: 'Cuverie Est',
          status: 'EN_ELEVAGE',
          parentId,
        },
        {
          code: 'CUV-COMP-050-B',
          displayName: 'Compartiment B 50 hL',
          type: 'COMPARTIMENT',
          capacityValue: decimal(50),
          capacityUnit: 'hL',
          site: DEMO_CAVE_NAME,
          zone: 'Cuverie Est',
          status: 'EN_ELEVAGE',
          parentId,
        },
      ],
    });
    counts.containers += childInsert.count;

    const allCodes = [
      ...rootContainers.map((container) => container.code),
      'CUV-COMP-050-A',
      'CUV-COMP-050-B',
    ];
    const allContainers = await tx.container.findMany({
      where: {
        code: { in: allCodes },
      },
      select: {
        id: true,
        code: true,
      },
    });

    const containerIds = new Map(allContainers.map((container) => [container.code, container.id] as const));
    for (const code of allCodes) {
      if (!containerIds.has(code)) {
        throw new Error(`Contenant démo introuvable après insertion: ${code}.`);
      }
    }

    return containerIds;
  }

  private static async seedLotsAndAnalyses(
    tx: Tx,
    counts: Omit<AdminSeedCounts, 'operations'>,
    containerIds: SeedContainerMap,
  ): Promise<SeedLotMap> {
    const lotDefinitions = [
      {
        technicalCode: 'LOT-CH-AVIZE-2026',
        businessCode: 'CH-AVIZE-2026',
        year: 2026,
        mainGrapeCode: 'CH',
        placeCode: 'AVIZE-LES-GRANDS-PRES',
        sequenceNumber: 1,
        status: 'VIN_DE_BASE',
        currentVolume: 46.8,
        currentContainerCode: 'CUV-INX-050-A',
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
        currentContainerCode: 'CUV-INX-025-A',
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
        currentContainerCode: 'CUV-INX-100-A',
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
        status: 'FERMENTATION_ALCOOLIQUE',
        currentVolume: 47.1,
        currentContainerCode: 'CUV-COMP-050-A',
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
        currentContainerCode: 'CUV-COMP-050-B',
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
        currentContainerCode: 'DEMI-MUID-600-B',
        qualiteLot: 'TAILLE',
        notes: `${DEMO_CAVE_NAME} · lot test sur petit contenant`,
        components: [{ grapeCode: 'PM', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-ROUGE-BOUZY-2025',
        businessCode: 'Vin Rouge Bouzy 2025',
        year: 2025,
        mainGrapeCode: 'PN',
        placeCode: 'BOUZY-LES-TERRES-ROUGES',
        sequenceNumber: 7,
        status: 'VIN_ROUGE',
        currentVolume: 8.4,
        currentContainerCode: 'CUV-INX-015-ROUGE',
        qualiteLot: 'CUVEE',
        notes: `${DEMO_CAVE_NAME} · vin rouge de réserve pour rosé d'assemblage`,
        components: [{ grapeCode: 'PN', percentage: 100 }],
      },
      {
        technicalCode: 'LOT-BSA-BRUT-2026',
        businessCode: 'Assemblage BSA Brut',
        year: 2026,
        mainGrapeCode: 'MULTI',
        placeCode: 'DOMAINE-DES-TROIS-COTEAUX',
        sequenceNumber: 8,
        status: 'ASSEMBLAGE',
        currentVolume: 186.4,
        currentContainerCode: 'CUV-INX-200-A',
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
        sequenceNumber: 9,
        status: 'ASSEMBLE',
        currentVolume: 5.65,
        currentContainerCode: 'DEMI-MUID-600-A',
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
        sequenceNumber: 10,
        status: 'RESERVE',
        currentVolume: 26.9,
        currentContainerCode: 'FOUDRE-030-A',
        qualiteLot: 'RESERVE',
        notes: `${DEMO_CAVE_NAME} · réserve élevée sous bois`,
        components: [
          { grapeCode: 'CH', percentage: 45 },
          { grapeCode: 'PN', percentage: 35 },
          { grapeCode: 'PM', percentage: 20 },
        ],
      },
    ] as const;

    const lotInsert = await tx.lot.createMany({
      data: lotDefinitions.map((definition) => {
        const currentContainerId = containerIds.get(definition.currentContainerCode);
        if (!currentContainerId) {
          throw new Error(`Contenant introuvable pour le lot démo ${definition.businessCode}.`);
        }

        return {
          technicalCode: definition.technicalCode,
          businessCode: definition.businessCode,
          year: definition.year,
          mainGrapeCode: definition.mainGrapeCode,
          placeCode: definition.placeCode,
          sequenceNumber: definition.sequenceNumber,
          status: definition.status,
          currentVolume: decimal(definition.currentVolume),
          currentContainerId,
          qualiteLot: definition.qualiteLot,
          notes: definition.notes,
        };
      }),
    });
    counts.lots += lotInsert.count;

    const createdLots = await tx.lot.findMany({
      where: {
        businessCode: { in: lotDefinitions.map((definition) => definition.businessCode) },
      },
      select: {
        id: true,
        businessCode: true,
      },
    });
    const lotIds = new Map(createdLots.map((lot) => [lot.businessCode, lot.id] as const));
    for (const definition of lotDefinitions) {
      if (!lotIds.has(definition.businessCode)) {
        throw new Error(`Lot démo introuvable après insertion: ${definition.businessCode}.`);
      }
    }

    const lotComponentInsert = await tx.lotComponent.createMany({
      data: lotDefinitions.flatMap((definition) => {
        const lotId = lotIds.get(definition.businessCode);
        if (!lotId) {
          throw new Error(`Lot démo introuvable pour composant: ${definition.businessCode}.`);
        }

        return definition.components.map((component) => ({
          lotId,
          grapeCode: component.grapeCode,
          percentage: decimal(component.percentage, 2),
        }));
      }),
    });
    counts.lotComponents += lotComponentInsert.count;

    const analysisDefinitions = [
      { lotCode: 'CH-AVIZE-2026', analysisDate: '2026-09-11', alcohol: 10.4, ph: 3.04, at: 7.8, so2Free: 18, so2Total: 64, sucresResiduel: 1.8, aciditeVolatile: 0.18, turbiditeNtu: 140 },
      { lotCode: 'CH-CRAMANT-2026', analysisDate: '2026-09-11', alcohol: 10.1, ph: 3.01, at: 8.0, so2Free: 16, so2Total: 58, sucresResiduel: 2.2, aciditeVolatile: 0.16, turbiditeNtu: 165 },
      { lotCode: 'PN-AY-2026', analysisDate: '2026-09-12', alcohol: 10.8, ph: 3.09, at: 7.0, so2Free: 14, so2Total: 55, sucresResiduel: 1.5, aciditeVolatile: 0.22, turbiditeNtu: 95 },
      { lotCode: 'PN-BOUZY-2026', analysisDate: '2026-09-12', alcohol: 10.7, ph: 3.11, at: 6.8, so2Free: 15, so2Total: 57, sucresResiduel: 1.4, aciditeVolatile: 0.24, turbiditeNtu: 90 },
      { lotCode: 'ME-DAMERY-2026', analysisDate: '2026-09-13', alcohol: 10.0, ph: 3.03, at: 7.6, so2Free: 20, so2Total: 68, sucresResiduel: 2.1, aciditeVolatile: 0.17, turbiditeNtu: 120 },
      { lotCode: 'ME-FESTIGNY-2026', analysisDate: '2026-09-13', alcohol: 9.8, ph: 2.99, at: 8.2, so2Free: 19, so2Total: 70, sucresResiduel: 2.5, aciditeVolatile: 0.18, turbiditeNtu: 132 },
      { lotCode: 'Vin Rouge Bouzy 2025', analysisDate: '2026-09-22', alcohol: 10.9, ph: 3.18, at: 6.4, so2Free: 18, so2Total: 52, sucresResiduel: 1.3, aciditeVolatile: 0.29, turbiditeNtu: 48 },
      { lotCode: 'Assemblage BSA Brut', analysisDate: '2026-10-03', alcohol: 10.6, ph: 3.08, at: 7.2, so2Free: 22, so2Total: 82, sucresResiduel: 1.6, aciditeVolatile: 0.21, turbiditeNtu: 60 },
      { lotCode: 'Base Rosé', analysisDate: '2026-10-04', alcohol: 10.5, ph: 3.1, at: 7.1, so2Free: 23, so2Total: 79, sucresResiduel: 1.9, aciditeVolatile: 0.23, turbiditeNtu: 70 },
      { lotCode: 'Vin de réserve 2025', analysisDate: '2026-10-05', alcohol: 10.9, ph: 3.14, at: 6.7, so2Free: 24, so2Total: 90, sucresResiduel: 1.2, aciditeVolatile: 0.26, turbiditeNtu: 45 },
    ] as const;

    const analysisInsert = await tx.analysis.createMany({
      data: analysisDefinitions.map((analysis) => {
        const lotId = lotIds.get(analysis.lotCode);
        if (!lotId) {
          throw new Error(`Lot démo introuvable pour analyse: ${analysis.lotCode}.`);
        }

        return {
          lotId,
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
        };
      }),
    });
    counts.analyses += analysisInsert.count;

    return lotIds;
  }

  private static async seedProductsAndStockMovements(
    tx: Tx,
    operator: SeedOperator,
    counts: Omit<AdminSeedCounts, 'operations'>,
  ) {
    const productDefinitions = [
      { name: 'Bouteilles 37.5cl', category: 'Matières Sèches', subCategory: 'Bouteilles', unit: 'unites', minStock: 500, currentStock: 2400 },
      { name: 'Bouteilles 75cl', category: 'Matières Sèches', subCategory: 'Bouteilles', unit: 'unites', minStock: 8000, currentStock: 36000 },
      { name: 'Magnums 150cl', category: 'Matières Sèches', subCategory: 'Bouteilles', unit: 'unites', minStock: 300, currentStock: 1800 },
      { name: 'Jeroboams 300cl', category: 'Matières Sèches', subCategory: 'Bouteilles', unit: 'unites', minStock: 60, currentStock: 240 },
      { name: 'Capsules tirage', category: 'Bouchage', subCategory: 'Capsules', unit: 'unites', minStock: 8000, currentStock: 36000 },
      { name: 'Bidules', category: 'Bouchage', subCategory: 'Bidules', unit: 'unites', minStock: 8000, currentStock: 36000 },
      { name: 'Bouchons liege tirage', category: 'Bouchage', subCategory: 'Bouchons', unit: 'unites', minStock: 1200, currentStock: 6400 },
      { name: 'Agrafes tirage', category: 'Bouchage', subCategory: 'Agrafes', unit: 'unites', minStock: 1200, currentStock: 6400 },
      { name: 'Bouchons liege expédition', category: 'Bouchage', subCategory: 'Bouchons', unit: 'unites', minStock: 1800, currentStock: 12000 },
      { name: 'Muselets expédition', category: 'Bouchage', subCategory: 'Muselets', unit: 'unites', minStock: 1800, currentStock: 12000 },
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
      { name: 'Liqueur de dosage Brut', category: 'Intrants', subCategory: 'Liqueurs de dosage', unit: 'L', minStock: 30, currentStock: 180 },
      { name: 'Liqueur de dosage Extra-Brut', category: 'Intrants', subCategory: 'Liqueurs de dosage', unit: 'L', minStock: 20, currentStock: 120 },
      { name: 'Coiffes Brut Classique', category: 'Habillage', subCategory: 'Coiffes', unit: 'unites', minStock: 1800, currentStock: 12000 },
      { name: 'Étiquettes Brut Classique', category: 'Habillage', subCategory: 'Étiquettes', unit: 'unites', minStock: 1800, currentStock: 12000 },
      { name: 'Contre-étiquettes Brut Classique', category: 'Habillage', subCategory: 'Contre-étiquettes', unit: 'unites', minStock: 1800, currentStock: 12000 },
      { name: 'Cartons 6 bouteilles', category: 'Matières Sèches', subCategory: 'Cartons', unit: 'unites', minStock: 400, currentStock: 2400 },
    ] as const;

    const productInsert = await tx.product.createMany({
      data: productDefinitions.map((product) => ({
        name: product.name,
        category: product.category,
        subCategory: product.subCategory,
        unit: product.unit,
        minStock: decimal(product.minStock),
        currentStock: decimal(product.currentStock),
      })),
    });
    counts.products += productInsert.count;

    const products = await tx.product.findMany({
      where: {
        name: { in: productDefinitions.map((product) => product.name) },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.name, product.id] as const));

    const stockMovementInsert = await tx.stockMovement.createMany({
      data: productDefinitions.map((product) => {
        const productId = productMap.get(product.name);
        if (!productId) {
          throw new Error(`Produit démo introuvable après insertion: ${product.name}.`);
        }

        return {
          productId,
          type: 'IN',
          quantity: decimal(product.currentStock),
          note: `${DEMO_CAVE_NAME} · stock initial démo`,
          operator: operator.email,
        };
      }),
    });
    counts.stockMovements += stockMovementInsert.count;
  }

  private static async seedLotEvents(
    tx: Tx,
    operator: SeedOperator,
    counts: Omit<AdminSeedCounts, 'operations'>,
    containerIds: SeedContainerMap,
    lotIds: SeedLotMap,
  ) {
    const eventDefinitions = [
      {
        eventType: 'DEBOURBAGE',
        eventDatetime: '2026-09-01T09:00:00.000Z',
        comment: `${DEMO_CAVE_NAME} · débourbage statique Chardonnay Avize`,
        lotLinks: [{ lotCode: 'CH-AVIZE-2026', roleInEvent: 'CIBLE', volumeChange: 46.8 }],
        containerLinks: [{ containerCode: 'CUV-INX-050-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'LEVURAGE',
        eventDatetime: '2026-09-01T14:00:00.000Z',
        comment: `${DEMO_CAVE_NAME} · levurage Chardonnay Cramant`,
        lotLinks: [{ lotCode: 'CH-CRAMANT-2026', roleInEvent: 'CIBLE', volumeChange: 23.6 }],
        containerLinks: [{ containerCode: 'CUV-INX-025-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'FERMENTATION_ALCOOLIQUE',
        eventDatetime: '2026-09-03T08:00:00.000Z',
        comment: `${DEMO_CAVE_NAME} · départ FA Pinot Noir Aÿ`,
        lotLinks: [{ lotCode: 'PN-AY-2026', roleInEvent: 'CIBLE', volumeChange: 98.2 }],
        containerLinks: [{ containerCode: 'CUV-INX-100-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'SOUTIRAGE',
        eventDatetime: '2026-09-09T10:00:00.000Z',
        comment: `${DEMO_CAVE_NAME} · soutirage Pinot Noir Bouzy`,
        lotLinks: [{ lotCode: 'PN-BOUZY-2026', roleInEvent: 'CIBLE', volumeChange: 47.1 }],
        containerLinks: [{ containerCode: 'CUV-COMP-050-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'SULFITAGE',
        eventDatetime: '2026-09-10T11:30:00.000Z',
        comment: `${DEMO_CAVE_NAME} · sulfitage Meunier Damery`,
        lotLinks: [{ lotCode: 'ME-DAMERY-2026', roleInEvent: 'CIBLE', volumeChange: 43.9 }],
        containerLinks: [{ containerCode: 'CUV-COMP-050-B', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'ASSEMBLAGE',
        eventDatetime: '2026-10-01T08:30:00.000Z',
        comment: `${DEMO_CAVE_NAME} · assemblage BSA Brut`,
        lotLinks: [
          { lotCode: 'CH-AVIZE-2026', roleInEvent: 'SOURCE', volumeChange: 55 },
          { lotCode: 'PN-AY-2026', roleInEvent: 'SOURCE', volumeChange: 75 },
          { lotCode: 'ME-DAMERY-2026', roleInEvent: 'SOURCE', volumeChange: 38 },
          { lotCode: 'Vin de réserve 2025', roleInEvent: 'SOURCE', volumeChange: 18.4 },
          { lotCode: 'Assemblage BSA Brut', roleInEvent: 'CIBLE', volumeChange: 186.4 },
        ],
        containerLinks: [{ containerCode: 'CUV-INX-200-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'ASSEMBLAGE',
        eventDatetime: '2026-10-02T09:30:00.000Z',
        comment: `${DEMO_CAVE_NAME} · préparation Base Rosé`,
        lotLinks: [
          { lotCode: 'PN-BOUZY-2026', roleInEvent: 'SOURCE', volumeChange: 3.2 },
          { lotCode: 'CH-AVIZE-2026', roleInEvent: 'SOURCE', volumeChange: 1.45 },
          { lotCode: 'ME-DAMERY-2026', roleInEvent: 'SOURCE', volumeChange: 1.0 },
          { lotCode: 'Base Rosé', roleInEvent: 'CIBLE', volumeChange: 5.65 },
        ],
        containerLinks: [{ containerCode: 'DEMI-MUID-600-A', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'ELEVAGE',
        eventDatetime: '2026-10-03T07:15:00.000Z',
        comment: `${DEMO_CAVE_NAME} · maintien d'un vin rouge de réserve pour assemblage rosé`,
        lotLinks: [{ lotCode: 'Vin Rouge Bouzy 2025', roleInEvent: 'CIBLE', volumeChange: 8.4 }],
        containerLinks: [{ containerCode: 'CUV-INX-015-ROUGE', roleInEvent: 'CIBLE' }],
      },
      {
        eventType: 'PREPARATION_TIRAGE',
        eventDatetime: '2027-03-05T08:45:00.000Z',
        comment: `${DEMO_CAVE_NAME} · préparation de liqueur de tirage BSA`,
        lotLinks: [{ lotCode: 'Assemblage BSA Brut', roleInEvent: 'SOURCE', volumeChange: 111 }],
        containerLinks: [{ containerCode: 'CUV-INX-200-A', roleInEvent: 'SOURCE' }],
      },
      {
        eventType: 'TIRAGE',
        eventDatetime: '2027-03-06T07:30:00.000Z',
        comment: `${DEMO_CAVE_NAME} · tirage cuvée BSA Brut`,
        lotLinks: [{ lotCode: 'Assemblage BSA Brut', roleInEvent: 'SOURCE', volumeChange: 111 }],
        containerLinks: [{ containerCode: 'CUV-INX-200-A', roleInEvent: 'SOURCE' }],
      },
      {
        eventType: 'ELEVAGE',
        eventDatetime: '2026-11-15T10:15:00.000Z',
        comment: `${DEMO_CAVE_NAME} · suivi élevage réserve 2025`,
        lotLinks: [{ lotCode: 'Vin de réserve 2025', roleInEvent: 'CIBLE', volumeChange: 28.7 }],
        containerLinks: [{ containerCode: 'FOUDRE-030-A', roleInEvent: 'CIBLE' }],
      },
    ] as const;

    for (const eventDefinition of eventDefinitions) {
      const lotEvent = await tx.lotEvent.create({
        data: {
          eventType: eventDefinition.eventType,
          eventDatetime: new Date(eventDefinition.eventDatetime),
          operatorUserId: operator.id,
          comment: eventDefinition.comment,
        },
      });
      counts.lotEvents += 1;

      const lotLinksInsert = await tx.lotEventLot.createMany({
        data: eventDefinition.lotLinks.map((link) => {
          const lotId = lotIds.get(link.lotCode);
          if (!lotId) {
            throw new Error(`Lot démo introuvable pour évènement: ${link.lotCode}.`);
          }

          return {
            eventId: lotEvent.id,
            lotId,
            roleInEvent: link.roleInEvent,
            volumeChange: decimal(link.volumeChange),
          };
        }),
      });
      counts.lotEventLots += lotLinksInsert.count;

      const containerLinksInsert = await tx.lotEventContainer.createMany({
        data: eventDefinition.containerLinks.map((link) => {
          const containerId = containerIds.get(link.containerCode);
          if (!containerId) {
            throw new Error(`Contenant démo introuvable pour évènement: ${link.containerCode}.`);
          }

          return {
            eventId: lotEvent.id,
            containerId,
            roleInEvent: link.roleInEvent,
          };
        }),
      });
      counts.lotEventContainers += containerLinksInsert.count;
    }
  }

  private static async seedBottleLotsEventsAndDegustations(
    tx: Tx,
    operator: SeedOperator,
    counts: Omit<AdminSeedCounts, 'operations'>,
    lotIds: SeedLotMap,
    createdParcelles: Map<string, CreatedParcelle>,
  ) {
    const bsaBrut = lotIds.get('Assemblage BSA Brut');
    const baseRose = lotIds.get('Base Rosé');
    const chAvize = lotIds.get('CH-AVIZE-2026');
    const reserve2025 = lotIds.get('Vin de réserve 2025');

    if (!bsaBrut || !baseRose || !chAvize || !reserve2025) {
      throw new Error('Lots nécessaires au seed bouteilles/dégustations introuvables.');
    }

    const shiftMonths = (baseDate: Date, monthOffset: number) => {
      const nextDate = new Date(baseDate);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + monthOffset);
      return nextDate;
    };
    const shiftDays = (baseDate: Date, dayOffset: number) => {
      const nextDate = new Date(baseDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
      return nextDate;
    };

    const today = new Date();
    const reserveBottleDefinitions = [
      {
        technicalCode: 'BL-RESERVE-0001',
        businessCode: 'Réserve 2025 75cl',
        sourceLotId: reserve2025,
        formatCode: '75cl',
        initialBottleCount: 120,
        currentBottleCount: 120,
        locationZone: 'Réserve bouteilles',
        locationRack: 'Rack RES-01',
        locationPalette: 'PAL-RES-75',
      },
      {
        technicalCode: 'BL-RESERVE-0002',
        businessCode: 'Réserve 2025 Magnum',
        sourceLotId: reserve2025,
        formatCode: '150cl',
        initialBottleCount: 60,
        currentBottleCount: 60,
        locationZone: 'Réserve bouteilles',
        locationRack: 'Rack RES-02',
        locationPalette: 'PAL-RES-MAG',
      },
    ] as const;

    const reserveBottleInsert = await tx.bottleLot.createMany({
      data: reserveBottleDefinitions.map((definition) => ({
        technicalCode: definition.technicalCode,
        businessCode: definition.businessCode,
        type: 'RESERVE',
        sourceLotId: definition.sourceLotId,
        formatCode: definition.formatCode,
        initialBottleCount: definition.initialBottleCount,
        currentBottleCount: definition.currentBottleCount,
        status: 'RESERVE',
        locationZone: definition.locationZone,
        locationRack: definition.locationRack,
        locationPalette: definition.locationPalette,
      })),
    });
    counts.bottleLots += reserveBottleInsert.count;

    const tirageOldDate = shiftMonths(today, -18);
    const tirageRecentDate = shiftMonths(today, -10);
    const degorgementDate = shiftDays(shiftMonths(today, -1), -7);
    const habillageDate = shiftDays(today, -14);

    const tirageDefinitions = [
      {
        technicalCode: 'BL-TIRAGE-ELIGIBLE-0001',
        businessCode: 'Tirage BSA Brut Élevage long',
        sourceLotId: bsaBrut,
        formatCode: '75cl',
        initialBottleCount: 600,
        currentBottleCount: 360,
        tirageDate: tirageOldDate,
        locationZone: 'Cellier A',
        locationRack: 'Rack 01',
        locationPalette: 'PAL-001',
      },
      {
        technicalCode: 'BL-TIRAGE-RECENT-0002',
        businessCode: 'Tirage BSA Brut Récent',
        sourceLotId: bsaBrut,
        formatCode: '75cl',
        initialBottleCount: 420,
        currentBottleCount: 420,
        tirageDate: tirageRecentDate,
        locationZone: 'Cellier A',
        locationRack: 'Rack 02',
        locationPalette: 'PAL-002',
      },
      {
        technicalCode: 'BL-TIRAGE-ROSE-0003',
        businessCode: 'Tirage Base Rosé',
        sourceLotId: baseRose,
        formatCode: '75cl',
        initialBottleCount: 180,
        currentBottleCount: 180,
        tirageDate: shiftMonths(today, -16),
        locationZone: 'Cellier Rose',
        locationRack: 'Rack 01',
        locationPalette: 'PAL-ROSE-01',
      },
    ] as const;

    const tirageInsert = await tx.bottleLot.createMany({
      data: tirageDefinitions.map((definition) => ({
        technicalCode: definition.technicalCode,
        businessCode: definition.businessCode,
        type: 'TIRAGE',
        sourceLotId: definition.sourceLotId,
        formatCode: definition.formatCode,
        initialBottleCount: definition.initialBottleCount,
        currentBottleCount: definition.currentBottleCount,
        status: 'SUR_LATTES',
        tirageDate: definition.tirageDate,
        locationZone: definition.locationZone,
        locationRack: definition.locationRack,
        locationPalette: definition.locationPalette,
      })),
    });
    counts.bottleLots += tirageInsert.count;

    const tirageLots = await tx.bottleLot.findMany({
      where: {
        technicalCode: { in: tirageDefinitions.map((definition) => definition.technicalCode) },
      },
      select: {
        id: true,
        technicalCode: true,
        currentBottleCount: true,
        tirageDate: true,
      },
    });
    const tirageMap = new Map(tirageLots.map((lot) => [lot.technicalCode, lot] as const));

    const tirageEligible = tirageMap.get('BL-TIRAGE-ELIGIBLE-0001');
    const tirageRecent = tirageMap.get('BL-TIRAGE-RECENT-0002');
    const tirageRose = tirageMap.get('BL-TIRAGE-ROSE-0003');

    if (!tirageEligible || !tirageRecent || !tirageRose) {
      throw new Error('Lots bouteilles de tirage introuvables après insertion.');
    }

    const degorge1 = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-DEG-0001',
        businessCode: 'DEG-LOT-0001',
        type: 'DEGORGE',
        sourceLotId: bsaBrut,
        sourceBottleLotId: tirageEligible.id,
        formatCode: '75cl',
        initialBottleCount: 240,
        currentBottleCount: 140,
        status: 'DEGORGE',
        tirageDate: tirageEligible.tirageDate,
        degorgementDate,
        dosageValue: decimal(8, 1),
        dosageUnit: 'g/L',
        locationZone: 'Habillage',
        locationRack: 'Poste 01',
        locationPalette: 'PAL-DEG-01',
      },
    });
    const pretExpedition = await tx.bottleLot.create({
      data: {
        technicalCode: 'BL-HAB-0001',
        businessCode: 'HAB-LOT-0001',
        type: 'HABILLE',
        sourceLotId: bsaBrut,
        sourceBottleLotId: degorge1.id,
        formatCode: '75cl',
        initialBottleCount: 100,
        currentBottleCount: 88,
        status: 'PRET_EXPEDITION',
        tirageDate: tirageEligible.tirageDate,
        degorgementDate,
        dosageValue: decimal(8, 1),
        dosageUnit: 'g/L',
        locationZone: 'Expédition',
        locationRack: 'Zone A',
        locationPalette: 'PAL-EXP-01',
      },
    });
    counts.bottleLots += 2;

    const bottleEvent1 = await tx.bottleEvent.create({
      data: {
        eventType: 'CREATION_TIRAGE',
        eventDatetime: shiftDays(tirageOldDate, 1),
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · tirage campagne démo bouteilles`,
        metadata: {
          operation: 'TIRAGE',
          sourceLotId: bsaBrut,
          sourceContainerId: null,
          quantity:
            tirageEligible.currentBottleCount + tirageRecent.currentBottleCount + tirageRose.currentBottleCount,
          format: '75cl',
          bottleCount:
            tirageEligible.currentBottleCount + tirageRecent.currentBottleCount + tirageRose.currentBottleCount,
          requestedVolumeHl: null,
          consumedVolumeHl: null,
          pressureTargetBars: null,
          wineTemperatureC: null,
          residualSugarGPerL: null,
          bouchage: null,
          stockItems: [],
          calculatedItems: [],
          notes: `${DEMO_CAVE_NAME} · tirage campagne démo bouteilles`,
        },
      },
    });
    counts.bottleEvents += 1;
    const bottleEvent1Links = await tx.bottleEventLink.createMany({
      data: [tirageEligible, tirageRecent, tirageRose].map((bottleLot) => ({
        eventId: bottleEvent1.id,
        bottleLotId: bottleLot.id,
        roleInEvent: 'CIBLE',
        bottleCount: bottleLot.currentBottleCount,
      })),
    });
    counts.bottleEventLinks += bottleEvent1Links.count;

    const bottleEvent2 = await tx.bottleEvent.create({
      data: {
        eventType: 'DEGORGEMENT',
        eventDatetime: degorgementDate,
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · dégorgement partiel lot BSA`,
        metadata: {
          operation: 'DEGORGEMENT',
          quantity: 240,
          losses: 0,
          dosageGPerL: 8,
          liqueurType: 'Brut',
          liqueurVolumeL: null,
          sourceBottleLotId: tirageEligible.id,
          destinationBottleLotId: degorge1.id,
          consumables: [],
          notes: `${DEMO_CAVE_NAME} · dégorgement partiel lot BSA`,
        },
      },
    });
    counts.bottleEvents += 1;
    const bottleEvent2Links = await tx.bottleEventLink.createMany({
      data: [
        {
          eventId: bottleEvent2.id,
          bottleLotId: tirageEligible.id,
          roleInEvent: 'SOURCE',
          bottleCount: 240,
        },
        {
          eventId: bottleEvent2.id,
          bottleLotId: degorge1.id,
          roleInEvent: 'CIBLE',
          bottleCount: 240,
        },
      ],
    });
    counts.bottleEventLinks += bottleEvent2Links.count;

    const bottleEvent3 = await tx.bottleEvent.create({
      data: {
        eventType: 'HABILLAGE',
        eventDatetime: habillageDate,
        operatorUserId: operator.id,
        comment: `${DEMO_CAVE_NAME} · habillage partiel lot dégorgé`,
        metadata: {
          operation: 'HABILLAGE',
          quantity: 100,
          sourceBottleLotId: degorge1.id,
          destinationBottleLotId: pretExpedition.id,
          consumables: [],
          packaging: {
            cartonSize: null,
            cartons: null,
          },
          notes: `${DEMO_CAVE_NAME} · habillage partiel lot dégorgé`,
        },
      },
    });
    counts.bottleEvents += 1;
    const bottleEvent3Links = await tx.bottleEventLink.createMany({
      data: [
        {
          eventId: bottleEvent3.id,
          bottleLotId: degorge1.id,
          roleInEvent: 'SOURCE',
          bottleCount: 100,
        },
        {
          eventId: bottleEvent3.id,
          bottleLotId: pretExpedition.id,
          roleInEvent: 'CIBLE',
          bottleCount: 100,
        },
      ],
    });
    counts.bottleEventLinks += bottleEvent3Links.count;

    const degustationInsert = await tx.degustation.createMany({
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
          lotId: String(chAvize),
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
    counts.degustations += degustationInsert.count;
  }
}
