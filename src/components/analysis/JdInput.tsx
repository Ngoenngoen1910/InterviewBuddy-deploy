"use client";

import { JD_MAX_CHARS } from "@/lib/analysis/types";

type JdInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function JdInput({ value, onChange, disabled }: JdInputProps) {
  const count = value.length;
  const nearLimit = count >= JD_MAX_CHARS * 0.9;

  return (
    <div className="space-y-1.5">
      <label htmlFor="jd" className="block text-base font-semibold text-slate-900">
        Job Description
      </label>
      <p id="jd-help" className="text-sm text-slate-500">
        Dán toàn bộ mô tả công việc. Càng chi tiết, kết quả càng chính xác.
      </p>

      <textarea
        id="jd"
        value={value}
        // maxLength stops typing and pasting past the limit.
        maxLength={JD_MAX_CHARS}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={10}
        aria-describedby="jd-help jd-count"
        placeholder="Ví dụ: Software Engineer Intern – Phát triển web với React và Node.js..."
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
      />

      <p
        id="jd-count"
        aria-live="polite"
        className={`text-right text-xs ${nearLimit ? "font-medium text-amber-700" : "text-slate-500"}`}
      >
        {count} / {JD_MAX_CHARS}
        {count >= JD_MAX_CHARS && " – đã đạt giới hạn"}
      </p>
    </div>
  );
}
