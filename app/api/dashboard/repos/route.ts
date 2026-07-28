import { NextResponse } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import {
  reposCollection,
  installationsCollection,
} from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async () => {
  const repos = await reposCollection();
  const installations = await installationsCollection();

  const all = await repos.find({}).sort({ fullName: 1 }).toArray();
  const insts = await installations.find({}).toArray();
  const accountByInst = new Map(
    insts.map((i) => [i.installationId, i.accountLogin]),
  );

  const items = all.map((r) => ({
    id: r._id.toHexString(),
    fullName: r.fullName,
    accountLogin: accountByInst.get(r.installationId) ?? "unknown",
    enabled: r.enabled,
    removedFromInstallation: r.removedFromInstallation ?? false,
    config: r.config,
    lastEventAt: r.lastEventAt?.toISOString(),
  }));

  return NextResponse.json({ repos: items });
});
