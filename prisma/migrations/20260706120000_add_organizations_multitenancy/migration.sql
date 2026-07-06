-- Multi-tenant foundation: one shared PostgreSQL database, strict organization scoping.
-- This migration intentionally only touches organization tables and organization_id scoping columns.

CREATE TABLE "organizations" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "primary_domain" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

CREATE TABLE "organization_members" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key"
  ON "organization_members"("organization_id", "user_id");
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "organizations" ("id", "name", "slug")
VALUES (1, 'Organisation Démo', 'organisation-demo')
ON CONFLICT ("slug") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"organizations"', 'id'), GREATEST((SELECT MAX("id") FROM "organizations"), 1));

INSERT INTO "organization_members" ("organization_id", "user_id", "role_key")
SELECT
  org."id",
  users."id",
  COALESCE(users."role_key", 'CAVISTE')
FROM "users" users
CROSS JOIN "organizations" org
WHERE org."slug" = 'organisation-demo'
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

ALTER TABLE "containers" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "lots" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "analyses" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "lot_events" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "bottle_lots" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "bottle_events" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "shipments" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "fa_readings" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "pressings" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "Maturation" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "Parcelle" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "Degustation" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "Pressoir" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "products" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "stock_movements" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" INTEGER DEFAULT 1;
ALTER TABLE "work_orders" ADD COLUMN "organization_id" INTEGER DEFAULT 1;

UPDATE "containers" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "lots" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "analyses" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "lot_events" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "bottle_lots" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "bottle_events" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "shipments" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "fa_readings" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "pressings" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "Maturation" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "Parcelle" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "Degustation" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "Pressoir" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "products" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "stock_movements" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "audit_logs" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');
UPDATE "work_orders" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'organisation-demo');

ALTER TABLE "containers" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "lots" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "analyses" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "lot_events" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bottle_lots" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bottle_events" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "shipments" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "fa_readings" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "pressings" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "Maturation" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "Parcelle" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "Degustation" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "Pressoir" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "work_orders" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "containers_organization_id_idx" ON "containers"("organization_id");
CREATE INDEX "lots_organization_id_idx" ON "lots"("organization_id");
CREATE INDEX "analyses_organization_id_idx" ON "analyses"("organization_id");
CREATE INDEX "lot_events_organization_id_idx" ON "lot_events"("organization_id");
CREATE INDEX "bottle_lots_organization_id_idx" ON "bottle_lots"("organization_id");
CREATE INDEX "bottle_events_organization_id_idx" ON "bottle_events"("organization_id");
CREATE INDEX "shipments_organization_id_idx" ON "shipments"("organization_id");
CREATE INDEX "fa_readings_organization_id_idx" ON "fa_readings"("organization_id");
CREATE INDEX "pressings_organization_id_idx" ON "pressings"("organization_id");
CREATE INDEX "Maturation_organization_id_idx" ON "Maturation"("organization_id");
CREATE INDEX "Parcelle_organization_id_idx" ON "Parcelle"("organization_id");
CREATE INDEX "Degustation_organization_id_idx" ON "Degustation"("organization_id");
CREATE INDEX "Pressoir_organization_id_idx" ON "Pressoir"("organization_id");
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");
CREATE INDEX "stock_movements_organization_id_idx" ON "stock_movements"("organization_id");
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX "work_orders_organization_id_idx" ON "work_orders"("organization_id");

ALTER TABLE "containers" ADD CONSTRAINT "containers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lots" ADD CONSTRAINT "lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_events" ADD CONSTRAINT "lot_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bottle_lots" ADD CONSTRAINT "bottle_lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bottle_events" ADD CONSTRAINT "bottle_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fa_readings" ADD CONSTRAINT "fa_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pressings" ADD CONSTRAINT "pressings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Maturation" ADD CONSTRAINT "Maturation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Degustation" ADD CONSTRAINT "Degustation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pressoir" ADD CONSTRAINT "Pressoir_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
