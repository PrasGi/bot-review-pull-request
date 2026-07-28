import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await validateSession(token);
  return NextResponse.json({ authenticated });
}
