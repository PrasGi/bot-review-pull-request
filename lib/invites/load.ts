import {
  installationsCollection,
  reposCollection,
  settingsCollection,
  userConnectionsCollection,
} from "@/lib/db/collections";
import type { OrgInviteDoc } from "@/lib/db/types";
import { buildConnectionSummary, type ConnectionSummary } from "@/lib/invites/summary";

export async function loadReviewerLogin(invite: OrgInviteDoc): Promise<string | null> {
  const connections = await userConnectionsCollection();
  const reviewer = await connections.findOne(
    { _id: invite.reviewerConnectionId },
    { projection: { githubLogin: 1 } },
  );
  return reviewer?.githubLogin ?? null;
}

/** Everything the public confirmation page shows. Only non-sensitive fields are read. */
export async function loadConnectionSummary(
  invite: OrgInviteDoc,
): Promise<ConnectionSummary & { reviewerLogin: string | null }> {
  const installationId = invite.installationId ?? -1;
  const [installation, repos, settings, reviewer] = await Promise.all([
    installationsCollection().then((c) => c.findOne({ installationId })),
    reposCollection().then((c) => c.find({ installationId }).toArray()),
    settingsCollection().then((c) =>
      c.findOne(
        { _id: "global" },
        { projection: { defaultProvider: 1, defaultModel: 1 } },
      ),
    ),
    userConnectionsCollection().then((c) =>
      c.findOne(
        { _id: invite.reviewerConnectionId },
        { projection: { githubLogin: 1, installationIds: 1, reconnectRequired: 1 } },
      ),
    ),
  ]);
  return {
    ...buildConnectionSummary({ repos, installation, settings, reviewer }),
    reviewerLogin: reviewer?.githubLogin ?? null,
  };
}
