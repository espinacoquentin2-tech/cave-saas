const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage de la base de données...')
  
  // On garde cette partie : elle vide bien toutes les tables
  await prisma.lotEventLot.deleteMany().catch(() => {})
  await prisma.lotEventContainer.deleteMany().catch(() => {})
  await prisma.lotEvent.deleteMany().catch(() => {})
  await prisma.lot.deleteMany().catch(() => {})
  await prisma.container.deleteMany().catch(() => {})
  await prisma.user.deleteMany().catch(() => {})
  
  console.log('🌱 Création des données de base...')

  // 1. Création d'un utilisateur (Indispensable pour se connecter à l'app)
  const chef = await prisma.user.create({
    data: {
      name: 'Jean Dubois',
      email: 'jean@domaine.fr',
      role: 'CHEF_CAVE',
    },
  })

  // =========================================================================
  // 🚫 PARTIE DÉSACTIVÉE POUR LES TESTS (Base 100% Vierge)
  // =========================================================================
  
  /*
  // 2. Création de Cuves et Foudres
  const cuve1 = await prisma.container.create({
    data: { code: 'CUV-01', displayName: 'Cuve Inox 1', type: 'CUVE_INOX', capacityValue: 100, status: 'PLEIN' },
  })
  const cuve2 = await prisma.container.create({
    data: { code: 'CUV-02', displayName: 'Cuve Inox 2', type: 'CUVE_INOX', capacityValue: 100, status: 'VIDE' },
  })
  const foudreA = await prisma.container.create({
    data: { code: 'FOU-A', displayName: 'Foudre A', type: 'FOUDRE', capacityValue: 50, status: 'ELEVAGE' },
  })

  // 3. Création des Lots de Vin
  const lotChardonnay = await prisma.lot.create({
    data: {
      technicalCode: 'LOT-000001', businessCode: '2025-CH-AVZ-001', year: 2025, mainGrapeCode: 'CH',
      sequenceNumber: 1, currentVolume: 85, currentContainerId: cuve1.id,
    },
  })
  const lotPinotNoir = await prisma.lot.create({
    data: {
      technicalCode: 'LOT-000002', businessCode: '2025-PN-CRA-002', year: 2025, mainGrapeCode: 'PN',
      sequenceNumber: 2, currentVolume: 48, currentContainerId: foudreA.id,
    },
  })
  */

  console.log('✅ Base de données initialisée avec succès (Utilisateur uniquement) !')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })