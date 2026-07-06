-- Enforces the product rule: one user belongs to exactly one organization.
-- Diagnostic to run before applying:
-- select user_id, count(*)
-- from organization_members
-- group by user_id
-- having count(*) > 1;

ALTER TABLE "organization_members"
ADD CONSTRAINT "organization_members_user_id_key" UNIQUE ("user_id");
