import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { withGuard } from "@/lib/auth/guard";
import { userConnectionsCollection } from "@/lib/db/collections";
import { createInvite, listRecentInvites } from "@/lib/invites/invite";
import { inviteStatus } from "@/lib/invites/status";
import { inviteUrl } from "@/lib/invites/urls";
import { inviteCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async () => {
  const invites = await listRecentInvites();
  const connections = await userConnectionsCollection();
  const reviewers = await connections
    .find(
      { _id: { $in: invites.map((i) => i.reviewerConnectionId) } },
      { projection: { githubLogin: 1 } },
    )
    .toArray();
  const loginById = new Map(
    reviewers.map((r) => [r._id.toHexString(), r.githubLogin]),
  );

  // The raw token is never stored, so a listed invite cannot be copied again.
  return NextResponse.json({
    invites: invites.map((invite) => ({
      id: invite._id.toHexString(),
      targetLogin: invite.targetLogin,
      status: inviteStatus(invite),
      reviewerLogin:
        loginById.get(invite.reviewerConnectionId.toHexString()) ?? null,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      completedAt: invite.completedAt?.toISOString() ?? null,
      accountLogin: invite.accountLogin ?? null,
    })),
  });
});

export const POST = withGuard(async (request: NextRequest) => {
  const parsed = inviteCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  const reviewerConnectionId = new ObjectId(parsed.data.reviewerConnectionId);
  const connections = await userConnectionsCollection();
  const reviewer = await connections.findOne(
    { _id: reviewerConnectionId },
    { projection: { _id: 1 } },
  );
  if (!reviewer) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Reviewer account not found" } },
      { status: 404 },
    );
  }

  const { token, invite } = await createInvite({
    targetLogin: parsed.data.targetLogin,
    reviewerConnectionId,
  });
  return NextResponse.json(
    {
      id: invite._id.toHexString(),
      url: inviteUrl(token),
      expiresAt: invite.expiresAt.toISOString(),
    },
    { status: 201 },
  );
});
