import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Temporary launch gate. Set false to reopen the storefront.
const UNDER_CONSTRUCTION = true;

function isOperationalRoute(pathname: string) {
  return ["/admin", "/admin-afiliados", "/login", "/unauthorized", "/pos", "/vendedor", "/api", "/_next", "/assets"]
    .some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStaticFile = /\.(?:css|js|map|mp4|webm|ico|woff2?|ttf|svg|png|jpg|jpeg|gif|webp|txt|xml)$/i.test(pathname);

  if (pathname === "/proximamente" || isStaticFile || pathname.startsWith("/assets/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  if (UNDER_CONSTRUCTION && !isOperationalRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/proximamente";
    // Preserve referral/search parameters for the temporary landing.
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
