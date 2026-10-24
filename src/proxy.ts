import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const protectedRoutes = [
  "/dashboard",
  "/interview",
  "/analysis",
  "/reports",
  "/practice-plan",
  "/history",
  "/settings",
];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  let destination: string | null = null;

  if (isProtectedRoute && !userId) {
    destination = "/login";
  } else if (pathname === "/login" && userId) {
    destination = "/dashboard";
  }

  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);

    // Giữ các cookie được cập nhật khi làm mới phiên.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    // Giữ các header kiểm soát cache do Supabase thiết lập.
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(header);

      if (value) {
        redirectResponse.headers.set(header, value);
      }
    }

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
