import { after, NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { guard } from "@/lib/auth/guard";
import { retryRequest } from "@/lib/dashboard/retry";
import { runReviewRequest } from "@/lib/review/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await retryRequest(id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json(
      { error: { code: "RETRY_FAILED", message: result.reason } },
      { status },
    );
  }

  const newId = new ObjectId(result.requestId);
  after(async () => {
    await runReviewRequest(newId);
  });

  return NextResponse.json({ ok: true, requestId: result.requestId });
}
