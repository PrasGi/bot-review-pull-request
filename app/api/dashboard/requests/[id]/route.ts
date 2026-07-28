import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/auth/guard";
import { getRequestDetail } from "@/lib/dashboard/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const { id } = await params;
  const detail = await getRequestDetail(id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Request not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(detail);
}
