"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: logoutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (logoutError) {
        setError("Đăng xuất chưa thành công. Vui lòng thử lại.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-full">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={handleLogout}
      >
        {busy ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>

      {error && (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
