import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export default function Input({
  id,
  label,
  error,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: InputProps) {
  const errorId = `${id}-error`;
  const descriptionIds =
    [describedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <input
        {...props}
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={descriptionIds}
        className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 ${
          error ? "border-red-500" : "border-slate-300"
        } ${className}`}
      />

      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
