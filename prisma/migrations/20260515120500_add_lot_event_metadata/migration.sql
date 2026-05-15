-- Add structured metadata for bulk/cuverie traceability events.
ALTER TABLE "lot_events" ADD COLUMN "metadata" JSONB;
