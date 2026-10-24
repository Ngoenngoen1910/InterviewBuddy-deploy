import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" (previously called middleware). Runs before every matched request.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);

  // Route protection (redirect signed-out users to /login) is added here
  // together with the login page. Use the userId returned by updateSession().

  return response;
}

export const config = {
  // Skip static files and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
