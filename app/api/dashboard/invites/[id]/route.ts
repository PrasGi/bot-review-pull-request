import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { guard } from "@/lib/auth/guard";
import { revokeInvite } from "@/lib/invites/invite";

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
  const revoked = await revokeInvite(new ObjectId(id));
  if (!revoked) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "The invite is already used, revoked or missing",
        },
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
