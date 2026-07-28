import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/github/oauth";
import { connectUser } from "@/lib/github/sync";
import { OAUTH_STATE_COOKIE } from "@/app/api/github/connect/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToProjects(params: Record<string, string>): NextResponse {
  const url = new URL("/projects", getEnv().APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const setupAction = params.get("setup_action");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!state || !expectedState) {
    return redirectToProjects({ connect: "error", reason: "missing_state" });
  }
  if (!safeEqual(state, expectedState)) {
    return redirectToProjects({ connect: "error", reason: "state_mismatch" });
  }
  if (setupAction === "request") {
    return redirectToProjects({ connect: "pending", reason: "org_approval" });
  }
  if (!code) {
    return redirectToProjects({ connect: "error", reason: "missing_code" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { githubLogin, repoCount } = await connectUser(tokens);
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
