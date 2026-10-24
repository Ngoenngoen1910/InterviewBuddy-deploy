# InterviewBuddy – Web app

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + ESLint, with Supabase for auth and database.

## Run it on your machine

Requirements: [Node.js](https://nodejs.org) 20.9 or newer (check with `node -v`) and Git.

```bash
git clone https://github.com/TrungNhan8386/InterviewBuddy.git
cd InterviewBuddy/src
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The home page shows whether Supabase is configured.

To check that the keys really work, open:

- http://localhost:3000/api/health – Supabase database, auth, and that the Gemini model exists.
- http://localhost:3000/api/health?ai=1 – also asks Gemini for a one-word reply. On staging this needs a signed-in user, to protect the free quota.

`"ok": true` means everything works. Otherwise the `detail` field says what failed. The same URLs work on the staging site.

- Fill in `.env.local` with the values Nhân sends you privately. **Never commit it.**
- Without `.env.local` the app still starts, so you can build UI with mock data. Anything that calls Supabase will throw a clear error until the keys are set.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build (run it before opening a PR) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check without building |

## Folder layout

```
src/
├── app/                    Pages and API routes (App Router)
│   ├── api/                API routes – server only (e.g. api/analyze-fit)
│   ├── auth/callback/      Supabase redirect after Google sign-in / email confirmation
│   ├── layout.tsx          Root layout
│   └── page.tsx            Home page (temporary)
├── components/ui/          Shared Button, Card, Input (owner: Tài)
├── lib/supabase/
│   ├── client.ts           Supabase client for Client Components
│   ├── server.ts           Supabase client for Server Components and API routes
│   ├── admin.ts            service_role client – server only, bypasses RLS
│   ├── proxy.ts            Session refresh used by proxy.ts
│   └── env.ts              Reads the public Supabase variables
├── supabase/migrations/    SQL migrations (owner: Nhân)
├── proxy.ts                Runs before every request (Next.js 16 name for middleware)
└── .env.example            Variable names only, no values
```

Owners and rules for each folder are in the week-3 guide. `components/ui/` and `app/api/` are created by their owners when they start.

## Using Supabase

```tsx
// Server Component or API route – acts as the signed-in user, RLS applies
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data: sessions } = await supabase.from("interview_sessions").select("*");
```

```tsx
// Client Component
"use client";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${location.origin}/auth/callback` },
});
```

- Call Gemini and use `SUPABASE_SERVICE_ROLE_KEY` **only** in server code (`app/api/*`).
- Any variable starting with `NEXT_PUBLIC_` is sent to the browser. Never give a secret that prefix.
- Check the user on the server with `supabase.auth.getClaims()`.

## Database

The schema is in `supabase/migrations/`. Design and RLS rules: [`docs/analysis and design/database-design.md`](../docs/analysis%20and%20design/database-design.md). Architecture: [`docs/analysis and design/architecture.md`](../docs/analysis%20and%20design/architecture.md).

To change the schema, add a **new** migration file (`YYYYMMDDHHMMSS_short_name.sql`) instead of editing an old one, and ask Nhân to review it.

## Notes on this Next.js version

- `proxy.ts` replaces `middleware.ts` (Next.js 16).
- `cacheComponents` is turned off in `next.config.ts` to keep data fetching simple. With it on, every page that reads the session must be wrapped in `<Suspense>`.
- `npm audit` reports issues in ESLint's dependencies only (development tools, not shipped to users). Do not run `npm audit fix --force`; it downgrades `eslint-config-next`.
