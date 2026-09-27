import { NextResponse, type NextRequest } from "next/server";
import { getEnv, requireGithubEnv } from "@/lib/env";
import { buildInstallUrl } from "@/lib/github/oauth";
import { findInviteByToken } from "@/lib/invites/invite";
import { inviteStatus } from "@/lib/invites/status";
import { inviteState } from "@/lib/invites/token";
import { invitePath } from "@/lib/invites/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the org owner is not logged in. The token is the only credential.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  requireGithubEnv();
  const { token } = await params;
  const invite = await findInviteByToken(token);
  if (!invite || inviteStatus(invite) !== "open") {
    // The invite page explains why the link cannot be used.
    return NextResponse.redirect(new URL(invitePath(token), getEnv().APP_URL));
  }
  return NextResponse.redirect(buildInstallUrl(inviteState(token)));
}
