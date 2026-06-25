ALTER TABLE "work_orders"
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancelled_by" TEXT,
ADD COLUMN "cancel_reason" TEXT;
