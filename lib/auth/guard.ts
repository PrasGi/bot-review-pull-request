import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
    { status: 401 },
  );
}

export function forbidden(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 },
  );
}

export async function requireSession(
  request: NextRequest,
): Promise<NextResponse | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await validateSession(token))) return unauthorized();
  return null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function checkOrigin(request: NextRequest): NextResponse | null {
  if (!MUTATING.has(request.method)) return null;
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const appOrigin = new URL(getEnv().APP_URL).origin;
  if (origin !== appOrigin) {
    return forbidden("Cross-origin request rejected");
  }
  return null;
}

export async function guard(
  request: NextRequest,
): Promise<NextResponse | null> {
  const originFail = checkOrigin(request);
  if (originFail) return originFail;
  return requireSession(request);
}

export function withGuard(
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const blocked = await guard(request);
    if (blocked) return blocked;
    try {
      return await handler(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      return NextResponse.json(
        { error: { code: "INTERNAL", message } },
        { status: 500 },
      );
    }
  };
}
