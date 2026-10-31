import type { NextRequest } from "next/server";
import { apiError, apiJson, getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid, toSessionResponse } from "@/lib/interview/session-contract.mjs";

// GET /api/interview/{id} – settings of one session and its linked fit analysis.
// Another user's session returns 404 (not 403), so ids cannot be probed.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/interview/[id]">) {
  if (!isSupabaseConfigured) return apiError("SERVER_ERROR");

  const auth = await getSignedInClient(request);
  if (!auth) return apiError("UNAUTHORIZED");

  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError("NOT_FOUND");

  const { data, error } = await auth.supabase
    .from("interview_sessions")
    .select(
      "id, status, created_at, round_type, difficulty, language, target_position, interview_date, " +
        "duration_minutes, input_mode, planned_questions, " +
        "fit_analyses (id, fit_score, language, created_at, result)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/interview/:id] select failed:", error.message);
    return apiError("SERVER_ERROR");
  }
  if (!data) return apiError("NOT_FOUND");

  return apiJson(toSessionResponse(data as unknown as Record<string, unknown>));
}
