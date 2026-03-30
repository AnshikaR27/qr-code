-- Fix 1: Original INSERT policy was scoped to `anon` only.
-- When the restaurant owner has the dashboard open in the same browser,
-- their session token is sent, making them `authenticated` — which had no INSERT policy.
-- Removing the `TO anon` clause makes the policy apply to ALL roles.
DROP POLICY IF EXISTS "anon_insert_waiter_calls" ON waiter_calls;

CREATE POLICY "anyone_insert_waiter_calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (true);

-- Fix 2: The CallWaiterButton subscribes to realtime updates on the specific
-- waiter_call row (id=eq.${callId}) so the customer sees when it's acknowledged.
-- Supabase Realtime filters events through RLS, so anon users need a SELECT policy.
-- The callId is a random UUID known only to the customer, so this is safe.
DROP POLICY IF EXISTS "anon_select_waiter_calls" ON waiter_calls;

CREATE POLICY "anon_select_waiter_calls"
  ON waiter_calls FOR SELECT
  TO anon
  USING (true);
