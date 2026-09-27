import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv, requireGithubEnv } from "@/lib/env";
import { buildAuthorizeUrl, buildInstallUrl } from "@/lib/github/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "gh_oauth_state";

// `?mode=authorize` signs in an account whose installation already exists
// (e.g. after moving to a new database); the default installs the app.
export async function GET(request: NextRequest): Promise<NextResponse> {
  requireGithubEnv();
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const authorize = request.nextUrl.searchParams.get("mode") === "authorize";
  return NextResponse.redirect(
    authorize ? buildAuthorizeUrl(state) : buildInstallUrl(state),
  );
}
