import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

// Supabase client for Client Components ("use client").
// Runs in the browser with the anon key; Row Level Security limits what it can read.
export function createClient() {
  assertSupabaseConfigured();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
