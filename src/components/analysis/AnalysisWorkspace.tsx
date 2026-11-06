"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CvUpload, { type CvStatus } from "@/components/analysis/CvUpload";
import FitResult from "@/components/analysis/FitResult";
import JdInput from "@/components/analysis/JdInput";
import { RESULT_TEXT } from "@/lib/analysis/result-text";
import {
  AnalyzeFitError,
  CvExtractError,
  USE_MOCK,
  analyzeFit,
  extractCvText,
} from "@/lib/analysis/client";
import { getLatestFitAnalysis, saveFitAnalysis, type SavedFitAnalysis } from "@/lib/analysis/storage";
import {
  JD_MAX_CHARS,
  MIN_TEXT_CHARS,
  type AnalysisLanguage,
  type AnalyzeFitResponse,
} from "@/lib/analysis/types";

type RunState =
  | { kind: "idle" }
  | { kind: "loading"; language: AnalysisLanguage }
  | { kind: "done"; result: AnalyzeFitResponse; language: AnalysisLanguage }
  | { kind: "error"; message: string; language: AnalysisLanguage };

// Saving runs after a successful analysis and never blocks showing the result.
type SaveState = "idle" | "saving" | "saved" | "failed";

export default function AnalysisWorkspace() {
  const [jd, setJd] = useState("");
  const [language, setLanguage] = useState<AnalysisLanguage>("vi");

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvStatus, setCvStatus] = useState<CvStatus>({ kind: "idle" });
  const [cvFromPdf, setCvFromPdf] = useState("");
  const [cvPasted, setCvPasted] = useState("");

  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const resultLanguage = run.kind === "idle" ? language : run.language;
  const resultText = RESULT_TEXT[resultLanguage];
  const [save, setSave] = useState<SaveState>("idle");
  // Last result to save again if saving failed.
  const pendingSave = useRef<Parameters<typeof saveFitAnalysis>[0] | null>(null);
  const [latest, setLatest] = useState<SavedFitAnalysis | null>(null);

  // Offer the latest saved analysis so the user can read it again (SCRUM-72).
  useEffect(() => {
    if (USE_MOCK) return;
    getLatestFitAnalysis()
      .then(setLatest)
      .catch(() => setLatest(null)); // optional feature: stay silent on failure
  }, []);

  // Ignore a slow extraction result if the user already removed or replaced the file.
  const extractId = useRef(0);

  const cvText = cvFile ? cvFromPdf : cvPasted.trim();
  const busy = run.kind === "loading" || cvStatus.kind === "extracting";
  const jdLength = jd.trim().length;
  const jdTooShort = jdLength < MIN_TEXT_CHARS;
  const jdTooLong = jdLength > JD_MAX_CHARS;
  const cvTooShort = cvText.length < MIN_TEXT_CHARS;
  const canSubmit = !jdTooShort && !jdTooLong && !cvTooShort && !busy;

  // Tell the user exactly what is missing instead of letting the API return 400.
  let submitHint = "";
  if (jdLength === 0 || cvText.length === 0) {
    submitHint = "Cần nhập JD và tải CV (hoặc dán nội dung CV) để phân tích.";
  } else if (jdTooLong) {
    submitHint = `JD dài ${jdLength} ký tự, vượt giới hạn ${JD_MAX_CHARS}. Hãy bỏ bớt phần giới thiệu công ty hoặc phúc lợi.`;
  } else if (jdTooShort) {
    submitHint = `JD quá ngắn, cần ít nhất ${MIN_TEXT_CHARS} ký tự (hiện có ${jdLength}).`;
  } else if (cvTooShort) {
    submitHint = `Nội dung CV quá ngắn, cần ít nhất ${MIN_TEXT_CHARS} ký tự.`;
  }

  async function handleSelect(file: File) {
    const id = ++extractId.current;
    setCvFile(file);
    setCvFromPdf("");
    setCvStatus({ kind: "extracting" });

    try {
      const { text, pages, truncated, originalChars } = await extractCvText(file);
      if (id !== extractId.current) return;
      setCvFromPdf(text);
      setCvStatus({ kind: "ready", pages, chars: text.length, truncated, originalChars });
    } catch (e) {
      if (id !== extractId.current) return;
      if (e instanceof CvExtractError && e.code === "NO_TEXT") {
        // Scanned PDF: drop the file so the paste box becomes usable.
        setCvFile(null);
        setCvStatus({ kind: "warning", message: e.message });
      } else {
        // A failed PDF must not keep the paste fallback disabled.
        setCvFile(null);
        setCvStatus({ kind: "error", message: e instanceof Error ? e.message : "Không đọc được file PDF." });
      }
    }
  }

  function handleRemove() {
    extractId.current++;
    setCvFile(null);
    setCvFromPdf("");
    setCvStatus({ kind: "idle" });
  }

  async function handleSubmit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (!canSubmit) return;

    const requestedLanguage = language;
    setRun({ kind: "loading", language: requestedLanguage });
    setSave("idle");
    try {
      const result = await analyzeFit({ jd: jd.trim(), cv: cvText, language: requestedLanguage });
      setRun({ kind: "done", result, language: requestedLanguage });
      if (!USE_MOCK) {
        pendingSave.current = {
          jd: jd.trim(),
          cv: cvText,
          cvFileName: cvFile?.name ?? null,
          language: requestedLanguage,
          result,
        };
        void handleSave();
      }
    } catch (err) {
      const message =
        err instanceof AnalyzeFitError ? err.message : RESULT_TEXT[requestedLanguage].unexpectedError;
      setRun({ kind: "error", message, language: requestedLanguage });
    }
  }

  async function handleSave() {
    const input = pendingSave.current;
    if (!input) return;
    setSave("saving");
    try {
      const id = await saveFitAnalysis(input);
      pendingSave.current = null;
      setSave("saved");
      setLatest({ id, createdAt: new Date().toISOString(), language: input.language, result: input.result });
    } catch {
      setSave("failed");
    }
  }

  function showLatest() {
    if (!latest) return;
    setLanguage(latest.language);
    setSave("saved");
    setRun({ kind: "done", result: latest.result, language: latest.language });
  }

  function changeLanguage(next: AnalysisLanguage) {
    if (next === language) return;
    setLanguage(next);
    // Existing AI prose belongs to its original language; request a fresh analysis.
    setRun({ kind: "idle" });
    setSave("idle");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Left: input form */}
      <Card className="h-fit">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <JdInput value={jd} onChange={setJd} disabled={run.kind === "loading"} />

          <CvUpload
            file={cvFile}
            status={cvStatus}
            onSelect={handleSelect}
            onRemove={handleRemove}
            pastedText={cvPasted}
            onPastedTextChange={setCvPasted}
            disabled={run.kind === "loading"}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Ngôn ngữ kết quả</legend>
            <div className="flex gap-4">
              {(
                [
                  ["vi", "Tiếng Việt"],
                  ["en", "English"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="language"
                    value={value}
                    checked={language === value}
                    onChange={() => changeLanguage(value)}
                    disabled={run.kind === "loading"}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {run.kind === "loading" ? "Đang phân tích..." : "Phân tích mức độ phù hợp"}
          </Button>

          {!canSubmit && !busy && submitHint && (
            <p className="text-center text-xs text-slate-500">{submitHint}</p>
          )}
          {USE_MOCK && (
            <p className="rounded-lg bg-slate-100 p-2 text-center text-xs text-slate-600">
              Đang dùng dữ liệu mẫu (NEXT_PUBLIC_ANALYZE_MOCK=1), chưa gọi AI thật.
            </p>
          )}
        </form>
      </Card>

      {/* Right: result */}
      <section aria-labelledby="result-heading" className="min-w-0 space-y-4" lang={resultLanguage}>
        <h2 id="result-heading" className="text-lg font-semibold">
          {resultText.heading}
        </h2>

        {run.kind === "idle" && (
          <Card className="space-y-3 text-sm text-slate-500">
            <p>
              {resultText.empty}
            </p>
            {latest && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                <span>
                  {resultText.latest}: {Math.round(latest.result.fitScore)}/100, {" "}
                  {new Date(latest.createdAt).toLocaleString(resultText.locale)}
                </span>
                <Button variant="secondary" onClick={showLatest}>
                  {resultText.viewLatest}
                </Button>
              </div>
            )}
          </Card>
        )}

        {run.kind === "loading" && <ResultSkeleton language={run.language} />}

        {run.kind === "error" && (
          <Card role="alert" className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{run.message}</p>
            <Button variant="secondary" className="mt-3" onClick={() => handleSubmit()}>
              {resultText.retry}
            </Button>
          </Card>
        )}

        {run.kind === "done" && (
          <>
            <SaveNotice state={save} language={run.language} onRetry={handleSave} />
            <FitResult result={run.result} language={run.language} />
          </>
        )}
      </section>
    </div>
  );
}

function SaveNotice({ state, language, onRetry }: { state: SaveState; language: AnalysisLanguage; onRetry: () => void }) {
  const text = RESULT_TEXT[language];
  if (state === "idle") return null;
  if (state === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <span className="flex-1">{text.saveFailed}</span>
        <Button variant="secondary" onClick={onRetry}>
          {text.retrySave}
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="text-sm text-slate-500">
      {state === "saving"
        ? text.saving
        : text.saved}
    </p>
  );
}

function ResultSkeleton({ language }: { language: AnalysisLanguage }) {
  const text = RESULT_TEXT[language];
  return (
    <div className="space-y-4" aria-busy="true" aria-label={text.loadingLabel}>
      <p className="text-sm text-slate-500">{text.loading}</p>
      {[112, 96, 160].map((h) => (
        <div key={h} className="animate-pulse rounded-xl bg-slate-200" style={{ height: h }} />
      ))}
    </div>
  );
}
