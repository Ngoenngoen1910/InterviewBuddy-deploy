import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import type { InterviewApiErrorCode } from "./session-contract.mjs";

/**
 * Returns a Supabase client that acts as the signed-in user, or null.
 * Works with the browser's session cookie (the app) and with an
 * `Authorization: Bearer <access_token>` header (Postman, curl, scripts).
 * Both clients use the anon key, so Row Level Security still applies.
 */
export async function getSignedInClient(
  request: Request,
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (token) {
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data } = await supabase.auth.getClaims(token);
      const userId = data?.claims?.sub;
      return userId ? { supabase, userId } : null;
    } catch {
      // A malformed token makes getClaims throw instead of returning an error.
      return null;
    }
  }

  const supabase = await createCookieClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}

const MESSAGES: Record<InterviewApiErrorCode, string> = {
  BAD_INPUT: "Some interview settings are missing or invalid.",
  UNAUTHORIZED: "Please sign in first.",
  NOT_FOUND: "Interview session not found.",
  SERVER_ERROR: "Could not save the interview session. Please try again.",
};

const STATUS: Record<InterviewApiErrorCode, number> = {
  BAD_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

export function apiError(code: InterviewApiErrorCode, fields?: Record<string, string>) {
  return NextResponse.json(
    { error: { code, message: MESSAGES[code], ...(fields ? { fields } : {}) } },
    { status: STATUS[code], headers: { "Cache-Control": "no-store" } },
  );
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export { isSupabaseConfigured };
