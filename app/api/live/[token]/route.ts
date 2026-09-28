import { NextResponse, type NextRequest } from "next/server";
import { loadPublicLive } from "@/lib/review/public-live-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERRORS = {
  invalid: { status: 422, code: "VALIDATION_ERROR", message: "Invalid link" },
  not_found: { status: 404, code: "NOT_FOUND", message: "Link not found" },
  expired: { status: 410, code: "EXPIRED", message: "Link expired" },
} as const;

// Public: whoever holds the link from the PR comment can read the progress.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = await loadPublicLive(token);
  if (result.kind !== "ok") {
    const e = ERRORS[result.kind];
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
  return NextResponse.json(result.live, { headers: { "Cache-Control": "no-store" } });
}
