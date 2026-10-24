"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CvUpload, { type CvStatus } from "@/components/analysis/CvUpload";
import FitResult from "@/components/analysis/FitResult";
import JdInput from "@/components/analysis/JdInput";
import {
  AnalyzeFitError,
  CvExtractError,
  USE_MOCK,
  analyzeFit,
  extractCvText,
} from "@/lib/analysis/client";
import { MIN_TEXT_CHARS, type AnalysisLanguage, type AnalyzeFitResponse } from "@/lib/analysis/types";

type RunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: AnalyzeFitResponse }
  | { kind: "error"; message: string };

export default function AnalysisWorkspace() {
  const [jd, setJd] = useState("");
  const [language, setLanguage] = useState<AnalysisLanguage>("vi");

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvStatus, setCvStatus] = useState<CvStatus>({ kind: "idle" });
  const [cvFromPdf, setCvFromPdf] = useState("");
  const [cvPasted, setCvPasted] = useState("");

  const [run, setRun] = useState<RunState>({ kind: "idle" });

  // Ignore a slow extraction result if the user already removed or replaced the file.
  const extractId = useRef(0);

  const cvText = cvFile ? cvFromPdf : cvPasted.trim();
  const busy = run.kind === "loading" || cvStatus.kind === "extracting";
  const jdLength = jd.trim().length;
  const jdTooShort = jdLength < MIN_TEXT_CHARS;
  const cvTooShort = cvText.length < MIN_TEXT_CHARS;
  const canSubmit = !jdTooShort && !cvTooShort && !busy;

  // Tell the user exactly what is missing instead of letting the API return 400.
  let submitHint = "";
  if (jdLength === 0 || cvText.length === 0) {
    submitHint = "Cần nhập JD và tải CV (hoặc dán nội dung CV) để phân tích.";
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
      const { text, pages } = await extractCvText(file);
      if (id !== extractId.current) return;
      setCvFromPdf(text);
      setCvStatus({ kind: "ready", pages, chars: text.length });
    } catch (e) {
      if (id !== extractId.current) return;
      if (e instanceof CvExtractError && e.code === "NO_TEXT") {
        // Scanned PDF: drop the file so the paste box becomes usable.
        setCvFile(null);
        setCvStatus({ kind: "warning", message: e.message });
      } else {
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

    setRun({ kind: "loading" });
    try {
      const result = await analyzeFit({ jd: jd.trim(), cv: cvText, language });
      setRun({ kind: "done", result });
    } catch (err) {
      const message =
        err instanceof AnalyzeFitError ? err.message : "Có lỗi không xác định. Vui lòng thử lại.";
      setRun({ kind: "error", message });
    }
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
                    onChange={() => setLanguage(value)}
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
      <section aria-labelledby="result-heading" className="min-w-0 space-y-4">
        <h2 id="result-heading" className="text-lg font-semibold">
          Kết quả phân tích
        </h2>

        {run.kind === "idle" && (
          <Card className="text-sm text-slate-500">
            Kết quả sẽ hiện ở đây sau khi bạn bấm phân tích: điểm phù hợp, kỹ năng đã có và còn
            thiếu, bảng so sánh yêu cầu và lời khuyên.
          </Card>
        )}

        {run.kind === "loading" && <ResultSkeleton />}

        {run.kind === "error" && (
          <Card role="alert" className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{run.message}</p>
            <Button variant="secondary" className="mt-3" onClick={() => handleSubmit()}>
              Thử lại
            </Button>
          </Card>
        )}

        {run.kind === "done" && <FitResult result={run.result} />}
      </section>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang phân tích">
      <p className="text-sm text-slate-500">AI đang đọc JD và CV, thường mất 5–15 giây...</p>
      {[112, 96, 160].map((h) => (
        <div key={h} className="animate-pulse rounded-xl bg-slate-200" style={{ height: h }} />
      ))}
    </div>
  );
}
