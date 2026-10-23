/**
 * Cloud sync (Supabase) connection settings.
 *
 * Both values are PUBLIC by design: the anon key only identifies the project,
 * and every table + the photo bucket are locked down by row-level security
 * (see supabase/migrations/0001_init.sql). Never put a service-role key here
 * or anywhere in client code.
 *
 * Leave both empty and sync stays dormant: the app works exactly as before and
 * More shows "Sync · Not set up".
 */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

/** Test builds can point at a local Supabase via NEXT_PUBLIC_* env vars; production uses the constants above. */
export const supabaseUrl = SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const syncConfigured = Boolean(supabaseUrl && supabaseAnonKey);
