-- Add a stable technical role key while keeping the historical display/compatibility field.
ALTER TABLE "users" ADD COLUMN "role_key" TEXT;

UPDATE "users"
SET "role_key" = CASE
    WHEN UPPER(REPLACE(TRIM("role"), ' ', '_')) = 'ADMIN' THEN 'ADMIN'
    WHEN UPPER(REPLACE(TRIM("role"), ' ', '_')) IN ('CHEF_CAVE', 'CHEF_DE_CAVE') THEN 'CHEF_CAVE'
    WHEN UPPER(REPLACE(TRIM("role"), ' ', '_')) = 'CAVISTE' THEN 'CAVISTE'
    WHEN UPPER(REPLACE(TRIM("role"), ' ', '_')) = 'LECTURE_SEULE' THEN 'LECTURE_SEULE'
    ELSE NULL
  END
WHERE "role_key" IS NULL;
