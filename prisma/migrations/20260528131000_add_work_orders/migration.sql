CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "recette" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "target_container_id" INTEGER,
    "target_lot_id" INTEGER,
    "details" TEXT,
    "sources" JSONB NOT NULL,
    "planned_volume" DECIMAL(65,30) NOT NULL,
    "created_by" TEXT,
    "operator" TEXT,
    "execution_evidence" JSONB,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_orders_public_id_key" ON "work_orders"("public_id");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
