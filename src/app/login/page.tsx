"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthCallbackNotice from "@/components/auth/AuthCallbackNotice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSignup = mode === "signup";

  function switchMode() {
    setMode(isSignup ? "login" : "signup");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (isSignup && password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signupError) {
          setError(signupError.message);
          return;
        }

        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setMessage(
          "Nếu địa chỉ này đủ điều kiện đăng ký, bạn sẽ nhận được email xác nhận. Hãy kiểm tra hộp thư và mục spam. Nếu đã có tài khoản, hãy chuyển sang đăng nhập."
        );

        setPassword("");
        setConfirmPassword("");
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) {
          setError(
            loginError.code === "email_not_confirmed"
              ? "Bạn cần xác nhận email trước khi đăng nhập."
              : "Không thể đăng nhập. Hãy kiểm tra email, mật khẩu và thử lại."
          );
          return;
        }

        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setError(
        "Không thể kết nối dịch vụ đăng nhập. Kiểm tra mạng và cấu hình Supabase."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const supabase = createClient();

      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

      if (googleError) {
        setError(googleError.message);
        setBusy(false);
      }
    } catch {
      setError("Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight">
            Interview<span className="text-indigo-600">Buddy</span>
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Tự tin hơn trong buổi phỏng vấn tiếp theo.
          </p>
        </div>

        <Card>
          <h1 className="text-2xl font-bold">
            {isSignup ? "Tạo tài khoản" : "Chào mừng trở lại"}
          </h1>

          <Suspense fallback={null}>
            <AuthCallbackNotice />
          </Suspense>

          <p className="mt-2 text-sm text-slate-500">
            {isSignup
              ? "Đăng ký để bắt đầu luyện phỏng vấn."
              : "Đăng nhập để tiếp tục hành trình luyện tập."}
          </p>

          <Button
            variant="secondary"
            className="mt-6 w-full"
            disabled={busy}
            onClick={handleGoogleLogin}
          >
            Tiếp tục với Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs text-slate-400">
              hoặc dùng email
            </span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form
            onSubmit={handleSubmit}
            aria-busy={busy}
            className="space-y-4"
          >
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              required
              disabled={busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              id="password"
              label="Mật khẩu"
              type="password"
              autoComplete={
                isSignup ? "new-password" : "current-password"
              }
              placeholder={
                isSignup ? "Ít nhất 8 ký tự" : "Nhập mật khẩu"
              }
              minLength={isSignup ? 8 : undefined}
              required
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {isSignup && (
              <Input
                id="confirm-password"
                label="Nhập lại mật khẩu"
                type="password"
                autoComplete="new-password"
                required
                disabled={busy}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
              />
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
              >
                {message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={busy}
            >
              {busy
                ? "Đang xử lý..."
                : isSignup
                  ? "Đăng ký"
                  : "Đăng nhập"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            <span>
              {isSignup ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            </span>

            <button
              type="button"
              disabled={busy}
              onClick={switchMode}
              className="rounded font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {isSignup ? "Đăng nhập" : "Đăng ký"}
            </button>
          </div>
        </Card>
      </div>
    </main>
  );
}
