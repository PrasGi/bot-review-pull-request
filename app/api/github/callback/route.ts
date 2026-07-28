import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/github/oauth";
import { connectAccount } from "@/lib/github/sync";
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
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectToProjects({ connect: "error", reason: "invalid_state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { githubLogin, repoCount } = await connectAccount(tokens);
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
