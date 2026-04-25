-- Refactor staff roles: replace waiter/counter/both with floor/kitchen/manager
--
-- Safe to run on an empty table or with pre-migrated data.
-- No data migration needed — staff_members was emptied before applying.

BEGIN;

ALTER TABLE staff_members DROP CONSTRAINT staff_members_role_check;

ALTER TABLE staff_members ADD CONSTRAINT staff_members_role_check
  CHECK (role IN ('floor', 'kitchen', 'manager'));

COMMIT;
