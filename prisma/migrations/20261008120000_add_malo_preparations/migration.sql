-- AlterTable
ALTER TABLE "containers" ADD COLUMN     "usage" TEXT;

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "malo_composition_event_id" INTEGER,
ADD COLUMN     "malo_preparation_id" INTEGER,
ADD COLUMN     "malo_role" TEXT;

-- CreateTable
CREATE TABLE "malo_preparations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "planned_volume_hl" DECIMAL(65,30) NOT NULL,
    "dose_pct" DECIMAL(65,30) NOT NULL DEFAULT 4,
    "protocol_snapshot" JSONB NOT NULL,
    "planned_destinations" JSONB NOT NULL DEFAULT '[]',
    "creator_user_id" INTEGER NOT NULL,
    "initial_analysis_id" INTEGER,
    "reference_composition_event_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "malo_preparations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "malo_preparations_organization_id_idx" ON "malo_preparations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_malo_preparation_id_malo_role_key" ON "lots"("malo_preparation_id", "malo_role");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_malo_preparation_id_fkey" FOREIGN KEY ("malo_preparation_id") REFERENCES "malo_preparations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malo_preparations" ADD CONSTRAINT "malo_preparations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malo_preparations" ADD CONSTRAINT "malo_preparations_initial_analysis_id_fkey" FOREIGN KEY ("initial_analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malo_preparations" ADD CONSTRAINT "malo_preparations_reference_composition_event_id_fkey" FOREIGN KEY ("reference_composition_event_id") REFERENCES "lot_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "containers" ADD CONSTRAINT "containers_malo_usage_check" CHECK ("usage" IS NULL OR "usage" IN ('MR','PCM'));
ALTER TABLE "lots" ADD CONSTRAINT "lots_malo_role_check" CHECK (("malo_role" IS NULL AND "malo_preparation_id" IS NULL) OR ("malo_role" IS NOT NULL AND "malo_role" IN ('MR','PCM') AND "malo_preparation_id" IS NOT NULL));
ALTER TABLE "malo_preparations" ADD CONSTRAINT "malo_positive_values_check" CHECK ("dose_pct" > 0 AND "planned_volume_hl" > 0);
-- Dossiers servis uniquement par les routes authentifiées et filtrées par organisation.
ALTER TABLE "malo_preparations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "malo_preparations" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "malo_preparations" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "malo_preparations" FROM authenticated;
  END IF;
END $$;

ALTER TABLE "malo_preparations" ADD CONSTRAINT "malo_preparations_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
