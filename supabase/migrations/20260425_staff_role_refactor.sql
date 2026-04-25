-- Refactor staff roles: waiter/counter/both → floor, add manager
-- Migration: waiter→floor, counter→floor, both→floor, kitchen unchanged
--
-- ROLLBACK NOTE: If rolled back, the original role distinctions (waiter vs counter vs both)
-- are permanently lost — all migrated rows will be 'floor'. To restore, you'd need a backup
-- or manual re-assignment. The constraint can be reverted with:
--   ALTER TABLE staff_members DROP CONSTRAINT staff_members_role_check;
--   ALTER TABLE staff_members ADD CONSTRAINT staff_members_role_check
--     CHECK (role IN ('waiter', 'kitchen', 'both', 'counter'));
-- But the data migration is one-way.

BEGIN;

-- Step 1: Migrate data BEFORE changing the constraint
UPDATE staff_members SET role = 'floor' WHERE role IN ('waiter', 'counter', 'both');

-- Step 2: Drop old constraint
ALTER TABLE staff_members DROP CONSTRAINT staff_members_role_check;

-- Step 3: Add new constraint
ALTER TABLE staff_members ADD CONSTRAINT staff_members_role_check
  CHECK (role IN ('floor', 'kitchen', 'manager'));

COMMIT;
