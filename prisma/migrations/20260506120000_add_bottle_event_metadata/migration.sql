-- Add structured metadata for bottle traceability events while preserving legacy comments.
ALTER TABLE "bottle_events" ADD COLUMN "metadata" JSONB;
