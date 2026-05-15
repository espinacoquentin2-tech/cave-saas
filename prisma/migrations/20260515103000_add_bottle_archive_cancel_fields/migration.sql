ALTER TABLE "bottle_lots"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by" TEXT,
  ADD COLUMN "archive_reason" TEXT;

ALTER TABLE "bottle_events"
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by" TEXT,
  ADD COLUMN "cancel_reason" TEXT,
  ADD COLUMN "cancel_event_id" INTEGER;

ALTER TABLE "shipment_lines"
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancel_reason" TEXT;
