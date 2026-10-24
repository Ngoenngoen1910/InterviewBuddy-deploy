import { isSupabaseConfigured } from "@/lib/supabase/env";

// Temporary home page for the project skeleton.
// Replaced by the landing page / redirect to /dashboard once login is built.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">InterviewBuddy</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Luyện phỏng vấn với AI theo đúng JD và CV của bạn.
      </p>
      <p className="text-sm text-zinc-500">
        Supabase:{" "}
        {isSupabaseConfigured ? (
          <span className="font-medium text-green-700 dark:text-green-400">configured</span>
        ) : (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            not configured (copy .env.example to .env.local)
          </span>
        )}
      </p>
    </main>
  );
}
