"use client";

import { useRef, useState, type DragEvent } from "react";
import { CV_MAX_FILE_BYTES } from "@/lib/analysis/types";

export type CvStatus =
  | { kind: "idle" }
  | { kind: "extracting" }
  | { kind: "ready"; pages: number; chars: number }
  | { kind: "warning"; message: string } // e.g. scanned PDF with no text
  | { kind: "error"; message: string };

type CvUploadProps = {
  file: File | null;
  status: CvStatus;
  onSelect: (file: File) => void;
  onRemove: () => void;
  pastedText: string;
  onPastedTextChange: (value: string) => void;
  disabled?: boolean;
};

export default function CvUpload({
  file,
  status,
  onSelect,
  onRemove,
  pastedText,
  onPastedTextChange,
  disabled,
}: CvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    // Check on the client first so the user gets instant feedback.
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setLocalError("Chỉ hỗ trợ file PDF.");
      return;
    }
    if (picked.size > CV_MAX_FILE_BYTES) {
      setLocalError("File quá lớn (tối đa 5 MB).");
      return;
    }
    setLocalError(null);
    onSelect(picked);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">CV / Resume</h2>
        <p className="text-sm text-slate-500">
          Tải CV dạng PDF hoặc dán nội dung CV bên dưới. File chỉ được đọc để phân tích, không
          được lưu lại.
        </p>
      </div>

      {!file ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-describedby="cv-drop-help"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
            dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <p className="text-sm font-medium text-slate-700">
            Kéo thả file PDF vào đây hoặc <span className="text-indigo-600 underline">chọn file</span>
          </p>
          <p id="cv-drop-help" className="text-xs text-slate-500">
            PDF, tối đa 5 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = ""; // allow choosing the same file again
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-xs font-bold text-red-600"
          >
            PDF
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">
              {formatSize(file.size)}
              {status.kind === "extracting" && " · Đang đọc chữ trong PDF..."}
              {status.kind === "ready" && ` · ${status.pages} trang · ${status.chars} ký tự`}
            </p>
          </div>
          {status.kind === "ready" && (
            <span className="text-sm font-medium text-green-700" aria-label="Đã đọc xong">
              ✓
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            aria-label={`Xóa file ${file.name}`}
          >
            Xóa
          </button>
        </div>
      )}

      {(localError || status.kind === "error") && (
        <p role="alert" className="text-sm text-red-600">
          {localError ?? (status.kind === "error" ? status.message : "")}
        </p>
      )}
      {status.kind === "warning" && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {status.message}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        hoặc dán nội dung CV
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <label htmlFor="cv-text" className="sr-only">
        Nội dung CV
      </label>
      <textarea
        id="cv-text"
        value={pastedText}
        onChange={(e) => onPastedTextChange(e.target.value)}
        disabled={disabled || !!file}
        rows={4}
        placeholder={file ? "Đang dùng chữ lấy từ file PDF." : "Dán nội dung CV vào đây (không bắt buộc nếu đã tải PDF)."}
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
