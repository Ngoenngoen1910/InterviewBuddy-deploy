import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, supabaseUrl } from "./env";

// Supabase client with the service_role key. It BYPASSES Row Level Security,
// so use it only in server code that must act on behalf of the system
// (for example, reading a shared report by its link token). Never import it
// from a Client Component.
export function createAdminClient() {
  assertSupabaseConfigured();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server only).");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
