import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { guard } from "@/lib/auth/guard";
import { userConnectionsCollection } from "@/lib/db/collections";
import { resyncConnection } from "@/lib/github/sync";
import { log, errorFields } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
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

  const connectionId = new ObjectId(id);
  const connections = await userConnectionsCollection();
  const connection = await connections.findOne({ _id: connectionId });
  if (!connection) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Account not found" } },
      { status: 404 },
    );
  }

  try {
    const { installationCount, repoCount } = await resyncConnection(connectionId);
    log.info("account.resync.ok", {
      connectionId: id,
      installationCount,
      repoCount,
    });
    return NextResponse.json({ ok: true, installationCount, repoCount });
  } catch (error) {
    log.error("account.resync.failed", { connectionId: id, ...errorFields(error) });
    const message = error instanceof Error ? error.message : "Re-sync failed";
    return NextResponse.json(
      { error: { code: "RESYNC_FAILED", message } },
      { status: 502 },
    );
  }
}
