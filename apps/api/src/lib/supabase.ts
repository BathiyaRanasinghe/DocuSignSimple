import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Used only for JWT validation (auth.getUser)
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Used for all DB writes and Storage operations — bypasses RLS
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
