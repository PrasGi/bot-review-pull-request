import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pr_session";

const PROTECTED_PAGES = [
  "/",
  "/requests",
  "/usage",
  "/projects",
  "/settings",
];

// Edge-safe presence check only. Real session validation (DB lookup) happens in
// the route handlers via guard() — the DB driver can't run in the proxy runtime.
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtectedPage =
    PROTECTED_PAGES.includes(pathname) ||
    PROTECTED_PAGES.some((p) => p !== "/" && pathname.startsWith(`${p}/`));

  if (isProtectedPage && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    // The dashboard sends sessions that fail validation (expired, or signed with an old
    // SESSION_SECRET) here with ?expired=1. Drop the stale cookie and show the login page;
    // bouncing back to "/" would loop forever, since this check only sees that a cookie exists.
    if (request.nextUrl.searchParams.has("expired")) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/requests/:path*", "/usage/:path*", "/projects/:path*", "/settings/:path*", "/login"],
};
