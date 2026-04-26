-- Re-add 'counter' role for pay-at-counter workflow.
-- Counter staff can take payment and mark orders delivered, but cannot
-- cancel orders, edit menu, view reports, or change settings.

BEGIN;

ALTER TABLE staff_members DROP CONSTRAINT staff_members_role_check;

ALTER TABLE staff_members ADD CONSTRAINT staff_members_role_check
  CHECK (role IN ('floor', 'kitchen', 'manager', 'counter'));

COMMIT;
