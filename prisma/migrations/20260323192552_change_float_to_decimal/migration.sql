-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intrants" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "main_unit" TEXT NOT NULL,

    CONSTRAINT "intrants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity_value" DECIMAL(65,30) NOT NULL,
    "capacity_unit" TEXT NOT NULL DEFAULT 'hL',
    "site" TEXT,
    "zone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VIDE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parent_id" INTEGER,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" SERIAL NOT NULL,
    "technical_code" TEXT NOT NULL,
    "business_code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "main_grape_code" TEXT NOT NULL,
    "place_code" TEXT,
    "sequence_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "current_volume" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "current_volume_unit" TEXT NOT NULL DEFAULT 'hL',
    "current_container_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_components" (
    "id" SERIAL NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "grape_code" TEXT NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "lot_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" SERIAL NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "analysis_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ph" DOUBLE PRECISION,
    "at" DOUBLE PRECISION,
    "so2_free" DOUBLE PRECISION,
    "so2_total" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "file_url" TEXT,
    "notes" TEXT,
    "extra_data" JSONB,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_events" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_user_id" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_event_lots" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "role_in_event" TEXT NOT NULL,
    "volume" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hL',

    CONSTRAINT "lot_event_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_event_containers" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "container_id" INTEGER NOT NULL,
    "role_in_event" TEXT NOT NULL,

    CONSTRAINT "lot_event_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_event_intrants" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "intrant_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier_batch" TEXT,

    CONSTRAINT "lot_event_intrants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bottle_lots" (
    "id" SERIAL NOT NULL,
    "technical_code" TEXT NOT NULL,
    "business_code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source_lot_id" INTEGER,
    "source_bottle_lot_id" INTEGER,
    "format_code" TEXT NOT NULL,
    "initial_bottle_count" INTEGER NOT NULL,
    "current_bottle_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_CAVE',
    "tirage_date" TIMESTAMP(3),
    "degorgement_date" TIMESTAMP(3),
    "dosage_value" DOUBLE PRECISION,
    "dosage_unit" TEXT,
    "location_zone" TEXT,
    "location_rack" TEXT,
    "location_palette" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bottle_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bottle_events" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_user_id" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bottle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bottle_event_links" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "bottle_lot_id" INTEGER NOT NULL,
    "role_in_event" TEXT NOT NULL,
    "bottle_count" INTEGER NOT NULL,

    CONSTRAINT "bottle_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "shipment_date" TIMESTAMP(3) NOT NULL,
    "customer_name" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "bottle_lot_id" INTEGER NOT NULL,
    "bottle_count" INTEGER NOT NULL,

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fa_readings" (
    "id" SERIAL NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "density" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "operator" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fa_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pressings" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "cru" TEXT NOT NULL,
    "cepage" TEXT NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pressings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maturation" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "parcelle" TEXT NOT NULL,
    "cepage" TEXT NOT NULL,
    "sucre" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "at" DOUBLE PRECISION,
    "malique" DOUBLE PRECISION,
    "tartrique" DOUBLE PRECISION,
    "maladie" TEXT,
    "intensite" DOUBLE PRECISION,
    "tavp" DOUBLE PRECISION,
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maturation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcelle" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "departement" TEXT,
    "region" TEXT,
    "commune" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Degustation" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phase" TEXT NOT NULL,
    "parcelle" TEXT,
    "lotId" TEXT,
    "bottleLotId" TEXT,
    "robe" TEXT,
    "nez" TEXT,
    "bouche" TEXT,
    "noteGlobale" DOUBLE PRECISION,
    "sucreTest" DOUBLE PRECISION,
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Degustation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pressoir" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "capacite" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VIDE',
    "loadKg" INTEGER,
    "parcelle" TEXT,
    "cepage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pressoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "min_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "current_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "places_code_key" ON "places"("code");

-- CreateIndex
CREATE UNIQUE INDEX "intrants_code_key" ON "intrants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "containers_code_key" ON "containers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lots_technical_code_key" ON "lots"("technical_code");

-- CreateIndex
CREATE UNIQUE INDEX "lots_business_code_key" ON "lots"("business_code");

-- CreateIndex
CREATE UNIQUE INDEX "bottle_lots_technical_code_key" ON "bottle_lots"("technical_code");

-- CreateIndex
CREATE UNIQUE INDEX "bottle_lots_business_code_key" ON "bottle_lots"("business_code");

-- CreateIndex
CREATE UNIQUE INDEX "Parcelle_nom_key" ON "Parcelle"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_key" ON "idempotency_records"("key");

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_current_container_id_fkey" FOREIGN KEY ("current_container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_components" ADD CONSTRAINT "lot_components_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_events" ADD CONSTRAINT "lot_events_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_lots" ADD CONSTRAINT "lot_event_lots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "lot_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_lots" ADD CONSTRAINT "lot_event_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_containers" ADD CONSTRAINT "lot_event_containers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "lot_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_containers" ADD CONSTRAINT "lot_event_containers_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_intrants" ADD CONSTRAINT "lot_event_intrants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "lot_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_event_intrants" ADD CONSTRAINT "lot_event_intrants_intrant_id_fkey" FOREIGN KEY ("intrant_id") REFERENCES "intrants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bottle_lots" ADD CONSTRAINT "bottle_lots_source_lot_id_fkey" FOREIGN KEY ("source_lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bottle_events" ADD CONSTRAINT "bottle_events_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bottle_event_links" ADD CONSTRAINT "bottle_event_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "bottle_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bottle_event_links" ADD CONSTRAINT "bottle_event_links_bottle_lot_id_fkey" FOREIGN KEY ("bottle_lot_id") REFERENCES "bottle_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_bottle_lot_id_fkey" FOREIGN KEY ("bottle_lot_id") REFERENCES "bottle_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fa_readings" ADD CONSTRAINT "fa_readings_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
