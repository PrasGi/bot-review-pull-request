import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { guard } from "@/lib/auth/guard";
import { userConnectionsCollection } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid id" } },
      { status: 422 },
    );
  }
  const connections = await userConnectionsCollection();
  const result = await connections.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Account not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
