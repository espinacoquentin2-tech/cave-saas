-- Drop previous global unique constraint on parcelle name
DROP INDEX IF EXISTS "Parcelle_nom_key";

-- Enforce uniqueness at terroir (name + geographic scope) level
CREATE UNIQUE INDEX "Parcelle_nom_departement_region_commune_key"
ON "Parcelle"("nom", "departement", "region", "commune");
