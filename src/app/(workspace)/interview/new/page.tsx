"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

const roundOptions = [
  { value: "hr", label: "HR" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
];

const difficultyOptions = [
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

const languageOptions = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const durationOptions = [
  { value: "15", label: "15 phút" },
  { value: "30", label: "30 phút" },
  { value: "45", label: "45 phút" },
];

const answerOptions = [
  { value: "text", label: "Văn bản" },
  { value: "voice", label: "Giọng nói" },
];

const initialForm = {
  targetPosition: "",
  roundType: "technical",
  difficulty: "medium",
  language: "vi",
  interviewDate: "",
  duration: "30",
  answerMode: "text",
};

type SetupForm = typeof initialForm;

type FormErrors = {
  targetPosition?: string;
  interviewDate?: string;
};

type Option = {
  value: string;
  label: string;
};

type ChoiceGroupProps = {
  name: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

function ChoiceGroup({
  name,
  label,
  value,
  options,
  onChange,
}: ChoiceGroupProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-slate-700">
        {label}
      </legend>

      <div
        className={`grid gap-2 ${
          options.length === 2
            ? "grid-cols-2"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {options.map((option) => (
          <label key={option.value} className="min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />

            <span className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700 transition hover:border-indigo-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? "—";
}

function localToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  if (!value) return "Chưa chọn";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function InterviewSetupPage() {
  const [form, setForm] = useState<SetupForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");

  function updateField(field: keyof SetupForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");

    if (field === "targetPosition" || field === "interviewDate") {
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!form.targetPosition.trim()) {
      nextErrors.targetPosition = "Vui lòng nhập vị trí muốn ứng tuyển.";
    }

    if (!form.interviewDate) {
      nextErrors.interviewDate = "Vui lòng chọn ngày phỏng vấn.";
    } else if (form.interviewDate < localToday()) {
      nextErrors.interviewDate =
        "Ngày phỏng vấn phải là hôm nay hoặc một ngày trong tương lai.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage("");
      return;
    }

    setMessage(
      "Thiết lập hợp lệ. Bạn có thể kiểm tra lại thông tin trong phần xem trước."
    );
  }

  const preview = [
    {
      label: "Vị trí",
      value: form.targetPosition.trim() || "Chưa nhập",
    },
    {
      label: "Vòng phỏng vấn",
      value: optionLabel(roundOptions, form.roundType),
    },
    {
      label: "Độ khó",
      value: optionLabel(difficultyOptions, form.difficulty),
    },
    {
      label: "Ngôn ngữ",
      value: optionLabel(languageOptions, form.language),
    },
    {
      label: "Ngày phỏng vấn",
      value: displayDate(form.interviewDate),
    },
    {
      label: "Thời lượng",
      value: optionLabel(durationOptions, form.duration),
    },
    {
      label: "Cách trả lời",
      value: optionLabel(answerOptions, form.answerMode),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Thiết lập phỏng vấn
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tạo một buổi luyện tập phù hợp với mục tiêu của bạn.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-sm font-medium text-indigo-800">
          Muốn luyện tập sát với công việc?
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          Bạn có thể{" "}
          <Link
            href="/analysis"
            className="font-medium text-indigo-700 underline underline-offset-4"
          >
            phân tích CV và JD
          </Link>{" "}
          trước khi bắt đầu.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <h2 className="text-lg font-semibold">
            Thông tin buổi luyện tập
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Chọn thông số bên dưới. Phần xem trước sẽ cập nhật ngay.
          </p>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <Input
              id="target-position"
              label="Vị trí mục tiêu *"
              placeholder="Ví dụ: Software Engineer Intern"
              value={form.targetPosition}
              onChange={(event) =>
                updateField("targetPosition", event.target.value)
              }
              maxLength={120}
              required
              error={errors.targetPosition}
            />

            <ChoiceGroup
              name="round-type"
              label="Loại phỏng vấn"
              value={form.roundType}
              options={roundOptions}
              onChange={(value) => updateField("roundType", value)}
            />

            <ChoiceGroup
              name="difficulty"
              label="Độ khó"
              value={form.difficulty}
              options={difficultyOptions}
              onChange={(value) => updateField("difficulty", value)}
            />

            <ChoiceGroup
              name="language"
              label="Ngôn ngữ"
              value={form.language}
              options={languageOptions}
              onChange={(value) => updateField("language", value)}
            />

            <Input
              id="interview-date"
              label="Ngày phỏng vấn thực tế *"
              type="date"
              value={form.interviewDate}
              onChange={(event) =>
                updateField("interviewDate", event.target.value)
              }
              required
              error={errors.interviewDate}
            />

            <ChoiceGroup
              name="duration"
              label="Thời lượng"
              value={form.duration}
              options={durationOptions}
              onChange={(value) => updateField("duration", value)}
            />

            <ChoiceGroup
              name="answer-mode"
              label="Cách trả lời"
              value={form.answerMode}
              options={answerOptions}
              onChange={(value) => updateField("answerMode", value)}
            />

            {form.answerMode === "voice" && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                Giọng nói cần quyền sử dụng micro và trình duyệt hỗ trợ.
                Bạn luôn có thể chuyển sang văn bản.
              </p>
            )}

            <Button type="submit" className="w-full sm:w-auto">
              Kiểm tra thiết lập
            </Button>

            <p
              role="status"
              aria-live="polite"
              className="text-sm leading-6 text-green-700"
            >
              {message}
            </p>
          </form>
        </Card>

        <aside aria-labelledby="session-preview-title" className="min-w-0">
          <Card className="border-indigo-100 bg-indigo-50">
            <p className="text-xs font-semibold tracking-widest text-indigo-600">
              PHIÊN CỦA BẠN
            </p>

            <h2
              id="session-preview-title"
              className="mt-3 text-xl font-semibold"
            >
              Xem trước phiên phỏng vấn
            </h2>

            <dl className="mt-6 space-y-4">
              {preview.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3"
                >
                  <dt className="text-sm text-slate-500">
                    {item.label}
                  </dt>

                  <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Button
              disabled
              className="mt-6 w-full"
              aria-describedby="start-session-note"
            >
              Bắt đầu phỏng vấn
            </Button>

            <p
              id="start-session-note"
              className="mt-3 text-xs leading-5 text-slate-500"
            >
              Chức năng bắt đầu phiên chưa được mở.
              Bạn có thể thiết lập và xem trước thông tin.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
