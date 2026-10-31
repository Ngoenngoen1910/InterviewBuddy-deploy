import { createClient } from "@/lib/supabase/client";
import type { AnalysisLanguage, AnalyzeFitResponse } from "./types";

// Saves and reads fit analyses in the fit_analyses table (SCRUM-72).
// Contract: docs/api/INTERVIEW_SESSION_API_v1.md, section 4 (owner: Nhân).
// RLS fills in user_id and only returns the signed-in user's rows.
// The interview session API links the latest saved analysis to a new session.

export type SavedFitAnalysis = {
  id: string;
  createdAt: string;
  language: AnalysisLanguage;
  result: AnalyzeFitResponse;
};

export async function saveFitAnalysis(input: {
  jd: string;
  cv: string;
  cvFileName: string | null;
  language: AnalysisLanguage;
  result: AnalyzeFitResponse;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fit_analyses")
    .insert({
      jd_text: input.jd,
      cv_text: input.cv,
      cv_file_name: input.cvFileName,
      language: input.language,
      fit_score: Math.round(input.result.fitScore),
      result: input.result,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not save the analysis.");
  return data.id as string;
}

// Returns null when the user has no saved analysis yet.
export async function getLatestFitAnalysis(): Promise<SavedFitAnalysis | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fit_analyses")
    .select("id, created_at, language, result")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    createdAt: data.created_at,
    language: data.language,
    result: data.result as AnalyzeFitResponse,
  };
}
