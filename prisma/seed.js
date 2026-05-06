const message = 'Seed legacy désactivé. Utiliser le reset/reseed sécurisé depuis l’application en développement.'

console.error(message)

if (process.env.ALLOW_LEGACY_SEED !== 'true') {
  console.error('Définir ALLOW_LEGACY_SEED=true confirme seulement l’appel explicite au script legacy.')
  process.exit(1)
}

console.error('Aucune opération destructive n’est implémentée dans ce script legacy.')
