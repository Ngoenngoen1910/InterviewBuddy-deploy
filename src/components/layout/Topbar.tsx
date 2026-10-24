"use client";

import { useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import UserIdentity from "@/components/auth/UserIdentity";

export default function Topbar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="order-2 w-full md:order-1 md:w-auto md:max-w-md md:flex-1">
          <label htmlFor="workspace-search" className="sr-only">
            Tìm kiếm phiên phỏng vấn, chủ đề hoặc kỹ năng
          </label>

          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>

            <input
              id="workspace-search"
              type="search"
              disabled
              placeholder="Tìm phiên, chủ đề, kỹ năng..."
              aria-describedby="search-note"
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-10 text-sm text-slate-600 placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>

          <p id="search-note" className="mt-1 text-xs text-slate-400">
            Tìm kiếm sẽ được bổ sung sau.
          </p>
        </div>

        <div className="order-1 flex w-full min-w-0 items-center justify-end gap-4 md:order-2 md:w-auto">
          <button
            type="button"
            aria-label={
              notificationsOpen ? "Đóng thông báo" : "Mở thông báo"
            }
            aria-expanded={notificationsOpen}
            aria-controls="notifications-panel"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>

          <UserIdentity />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <LogoutButton />
      </div>

      <section
        id="notifications-panel"
        hidden={!notificationsOpen}
        aria-label="Thông báo"
        className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Thông báo
          </h2>

          <button
            type="button"
            onClick={() => setNotificationsOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Đóng
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Chưa có thông báo. Đây là giao diện mẫu.
        </p>
      </section>
    </header>
  );
}
