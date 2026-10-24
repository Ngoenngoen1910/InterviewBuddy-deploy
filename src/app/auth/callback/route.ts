import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth_callback");

  if (providerError || !code) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
