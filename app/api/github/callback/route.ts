import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/github/oauth";
import { connectUser } from "@/lib/github/sync";
import { OAUTH_STATE_COOKIE } from "@/app/api/github/connect/route";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToProjects(params: Record<string, string>): NextResponse {
  const url = new URL("/projects", getEnv().APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function redirectToConnected(status: string): NextResponse {
  const url = new URL("/connected", getEnv().APP_URL);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE)?.value);

  // A callback without our CSRF cookie is not a user-initiated OAuth leg (e.g.
  // an org owner approving an install lands here without ever clicking Connect).
  // Never exchange tokens without a validated state — just show the info page;
  // the installation webhook is the source of truth for the actual data sync.
  if (!expectedState) {
    return redirectToConnected("received");
  }
  if (!state || !safeEqual(state, expectedState)) {
    return redirectToProjects({ connect: "error", reason: "state_mismatch" });
  }
  if (!code) {
    return redirectToProjects({ connect: "error", reason: "missing_code" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { githubLogin, repoCount } = await connectUser(tokens);
    if (!hasSession) {
      return redirectToConnected("received");
    }
    return redirectToProjects({
      connect: "success",
      login: githubLogin,
      repos: String(repoCount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return redirectToProjects({ connect: "error", reason: message });
  }
}
