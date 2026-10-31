import type { NextRequest } from "next/server";
import { apiError, apiJson, getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import {
  todayInVietnam,
  toSessionRow,
  validateCreateSession,
} from "@/lib/interview/session-contract.mjs";

// POST /api/interview – create an interview session (UC-05, SCRUM-56).
// Contract: docs/api/INTERVIEW_SESSION_API_v1.md
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return apiError("SERVER_ERROR");

  const auth = await getSignedInClient(request);
  if (!auth) return apiError("UNAUTHORIZED");
  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_INPUT", { body: "Request body must be valid JSON." });
  }

  const validation = validateCreateSession(body, { today: todayInVietnam() });
  if (!validation.ok) return apiError("BAD_INPUT", validation.fields);
  const settings = validation.value;

  // Link a fit analysis (SCRUM-57). RLS only returns the user's own rows.
  let analysis: { id: string; jd_text: string; cv_text: string } | null = null;
  if (settings.fitAnalysisId !== null) {
    let query = supabase.from("fit_analyses").select("id, jd_text, cv_text");
    query = settings.fitAnalysisId
      ? query.eq("id", settings.fitAnalysisId)
      : query.order("created_at", { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error("[api/interview] load fit analysis failed:", error.message);
      return apiError("SERVER_ERROR");
    }
    if (!data && settings.fitAnalysisId) {
      return apiError("BAD_INPUT", { fitAnalysisId: "Analysis not found." });
    }
    analysis = data;
  }

  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert(toSessionRow(settings, { userId, analysis }))
    .select("id")
    .single();

  if (error || !session) {
    console.error("[api/interview] insert failed:", error?.message);
    return apiError("SERVER_ERROR");
  }

  return apiJson({ sessionId: session.id, fitAnalysisId: analysis?.id ?? null }, 201);
}
