import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

// Refreshes the Supabase session cookie on every request and returns the
// signed-in user's id (or null). Called from /proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Without .env.local the app still runs, so teammates can build UI with mock data.
  if (!isSupabaseConfigured) {
    return { response, userId: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Do not put any code between createServerClient and getClaims():
  // getClaims() is what triggers the token refresh.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  return { response, userId };
}
