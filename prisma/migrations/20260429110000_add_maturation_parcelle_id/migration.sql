ALTER TABLE "Maturation"
ADD COLUMN "parcelleId" INTEGER;

CREATE INDEX "Maturation_parcelleId_idx" ON "Maturation"("parcelleId");

ALTER TABLE "Maturation"
ADD CONSTRAINT "Maturation_parcelleId_fkey"
FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

WITH unique_parcelles AS (
  SELECT MIN(id) AS id, nom
  FROM "Parcelle"
  GROUP BY nom
  HAVING COUNT(*) = 1
)
UPDATE "Maturation" AS m
SET "parcelleId" = up.id
FROM unique_parcelles AS up
WHERE m."parcelleId" IS NULL
  AND m."parcelle" = up.nom;
