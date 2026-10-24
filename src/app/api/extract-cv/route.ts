import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { CV_MAX_FILE_BYTES } from "@/lib/analysis/types";

// POST /api/extract-cv  (multipart/form-data, field "file": a PDF)
// Returns { text, pages, noText } or { error: { code, message } }.
// pdf-parse is a Node.js library, so the text is extracted here on the server
// (see architecture.md, section 2.1). The file is read in memory and never stored.

export const runtime = "nodejs";

const MIN_TEXT_CHARS = 50; // less than this = probably a scanned PDF
const MAX_TEXT_CHARS = 20_000; // keeps the Gemini prompt small

export async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail(400, "BAD_FILE", "Không nhận được file. Vui lòng chọn lại file PDF.");
  }

  if (!(file instanceof File)) {
    return fail(400, "BAD_FILE", "Không nhận được file. Vui lòng chọn lại file PDF.");
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return fail(400, "BAD_FILE", "Chỉ hỗ trợ file PDF.");
  }
  if (file.size > CV_MAX_FILE_BYTES) {
    return fail(400, "BAD_FILE", "File quá lớn (tối đa 5 MB).");
  }

  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const result = await parser.getText();
    const text = cleanText(result.text);

    // A scanned PDF is not an error (status 200), so the browser console stays clean;
    // the page sees noText: true and shows a warning instead.
    const noText = text.length < MIN_TEXT_CHARS;

    return NextResponse.json(
      { text: noText ? "" : text.slice(0, MAX_TEXT_CHARS), pages: result.total, noText },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[extract-cv]", e);
    return fail(400, "BAD_FILE", "Không đọc được file PDF (file hỏng hoặc có mật khẩu).");
  } finally {
    await parser.destroy();
  }
}

// pdf-parse adds "-- 1 of 2 --" page markers; drop them and squeeze blank lines.
function cleanText(raw: string) {
  return raw
    .replace(/^\s*-- \d+ of \d+ --\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
