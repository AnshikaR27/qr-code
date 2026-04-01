-- Ensure floor_plan column exists on restaurants.
-- Run this in the Supabase SQL editor if the floor plan save is returning an error.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS floor_plan JSONB;

-- Confirm the owner UPDATE policy covers the floor_plan column.
-- The existing "Owner manages own restaurant" policy uses FOR ALL, which includes UPDATE,
-- so no additional policy is needed. This statement is a no-op safety check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'restaurants'
      AND policyname = 'Owner manages own restaurant'
  ) THEN
    -- Recreate the policy if it was accidentally dropped
    EXECUTE $policy$
      CREATE POLICY "Owner manages own restaurant"
        ON restaurants FOR ALL
        USING (auth.uid() = owner_id)
        WITH CHECK (auth.uid() = owner_id);
    $policy$;
  END IF;
END;
$$;
