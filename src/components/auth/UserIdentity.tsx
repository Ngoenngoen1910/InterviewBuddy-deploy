"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UserIdentity() {
  const [name, setName] = useState("Đang tải...");
  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("…");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    function showUser(user: {
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null) {
      if (!active) return;

      if (!user) {
        setName("Chưa đăng nhập");
        setEmail("");
        setInitials("?");
        return;
      }

      const metadata = user.user_metadata;
      const fullName =
        typeof metadata?.full_name === "string"
          ? metadata.full_name
          : typeof metadata?.name === "string"
            ? metadata.name
            : "";

      const displayName =
        fullName.trim() || user.email?.split("@")[0] || "Người dùng";

      const letters = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((word) => Array.from(word)[0])
        .join("")
        .toUpperCase();

      setName(displayName);
      setEmail(user.email ?? "");
      setInitials(letters || "U");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      showUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
      >
        {initials}
      </div>

      <div className="min-w-0">
        <p
          title={name}
          className="max-w-40 truncate text-sm font-semibold text-slate-900"
        >
          {name}
        </p>

        <p
          title={email}
          className="max-w-40 truncate text-xs text-slate-500"
        >
          {email}
        </p>
      </div>
    </div>
  );
}
