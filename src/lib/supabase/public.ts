// USE THIS IN: server components that serve public, unauthenticated data
// and need ISR/edge caching (e.g. the customer menu route).
//
// Does NOT read cookies — Next.js won't opt routes using this client
// into dynamic rendering, so revalidate/ISR works as expected.
//
// Do NOT use for anything that requires an authenticated user session.
import { createClient } from '@supabase/supabase-js';

export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
