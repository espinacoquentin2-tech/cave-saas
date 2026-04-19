ALTER TABLE "lots"
ADD COLUMN "qualite_lot" TEXT;

CREATE INDEX "lots_qualite_lot_idx" ON "lots"("qualite_lot");
