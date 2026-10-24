"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Topbar from "@/components/layout/Topbar";

const navigation = [
  { label: "Dashboard", href: "/dashboard", ready: true },
  { label: "New Interview", href: "/interview/new", ready: false },
  { label: "Analysis", href: "/analysis", ready: true },
  { label: "Reports", href: "/reports", ready: false },
  { label: "Practice Plan", href: "/practice-plan", ready: false },
  { label: "History", href: "/history", ready: false },
  { label: "Settings", href: "/settings", ready: false },
];

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Chuyển đến nội dung
      </a>

      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:overflow-y-auto md:border-r md:border-b-0">
          <div className="flex h-20 items-center justify-between px-5">
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-xl font-bold tracking-tight"
            >
              Interview<span className="text-indigo-600">Buddy</span>
            </Link>

            <Button
              variant="secondary"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? "Đóng" : "Menu"}
            </Button>
          </div>

          <nav
            id="workspace-navigation"
            aria-label="Điều hướng chính"
            className={`${menuOpen ? "block" : "hidden"} space-y-1 px-3 pb-5 md:block`}
          >
            {navigation.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              if (!item.ready) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    disabled
                    className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm text-slate-400"
                  >
                    <span>{item.label}</span>
                    <span className="text-xs">Sắp có</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-3 py-3 text-sm font-medium ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <Topbar />

          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
