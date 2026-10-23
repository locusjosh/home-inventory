/**
 * Cloud sync (Supabase) connection settings.
 *
 * Both values are PUBLIC by design: the anon key only identifies the project,
 * and every table + the photo bucket are locked down by row-level security
 * (see supabase/migrations/0001_init.sql). Never put a service-role key here
 * or anywhere in client code.
 *
 * Set both empty and sync goes dormant again: the app works exactly as before and
 * More shows "Sync · Not set up".
 */
export const SUPABASE_URL = "https://rrrinzynkvccygstpfxs.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycmluenlua3ZjY3lnc3RwZnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjgxMjgsImV4cCI6MjEwODMwNDEyOH0.BzFKKCDoe03avqQgI2kxZeqgYcc3GslAgqtOxB4XkGc";

/** Test builds point at a local Supabase via NEXT_PUBLIC_* env vars (set only by the test build script); production uses the constants above. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
export const syncConfigured = Boolean(supabaseUrl && supabaseAnonKey);
