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
