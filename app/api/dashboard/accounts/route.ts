import { NextResponse } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import {
  userConnectionsCollection,
  installationsCollection,
  reposCollection,
} from "@/lib/db/collections";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async () => {
  const connections = await userConnectionsCollection();
  const installations = await installationsCollection();
  const repos = await reposCollection();

  const conns = await connections.find({}).toArray();
  const items = await Promise.all(
    conns.map(async (c) => {
      const insts = await installations
        .find({ installationId: { $in: c.installationIds } })
        .toArray();
      const repoCount = await repos.countDocuments({
        installationId: { $in: c.installationIds },
        removedFromInstallation: { $ne: true },
      });
      return {
        id: c._id.toHexString(),
        githubLogin: c.githubLogin,
        displayName: c.displayName || c.githubLogin,
        avatarUrl: c.avatarUrl,
        reconnectRequired: c.reconnectRequired ?? false,
        refreshTokenExpiresAt: c.refreshTokenExpiresAt.toISOString(),
        installations: insts.map((i) => ({
          installationId: i.installationId,
          accountType: i.accountType,
          accountLogin: i.accountLogin,
          manageUrl: `https://github.com/settings/installations/${i.installationId}`,
        })),
        repoCount,
      };
    }),
  );

  return NextResponse.json({
    accounts: items,
    connectUrl: `${getEnv().APP_URL}/api/github/connect`,
  });
});
