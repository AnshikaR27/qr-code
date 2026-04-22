-- Add 'both' option to staff_members role for small cafes
ALTER TABLE staff_members DROP CONSTRAINT staff_members_role_check;
ALTER TABLE staff_members ADD CONSTRAINT staff_members_role_check CHECK (role IN ('waiter', 'kitchen', 'both'));
