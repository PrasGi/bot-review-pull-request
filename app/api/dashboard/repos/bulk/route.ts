import { NextResponse, type NextRequest } from "next/server";
import { ObjectId, type UpdateFilter } from "mongodb";
import { withGuard } from "@/lib/auth/guard";
import { reposCollection } from "@/lib/db/collections";
import type { RepoDoc } from "@/lib/db/types";
import { buildRepoSet } from "@/lib/repos/update";
import { repoBulkUpdateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = withGuard(async (request: NextRequest) => {
  const parsed = repoBulkUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid body",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  const { ids, ...changes } = parsed.data;
  const repos = await reposCollection();
  // Repos removed from their installation cannot be reviewed; leave them alone.
  const result = await repos.updateMany(
    {
      _id: { $in: [...new Set(ids)].map((id) => new ObjectId(id)) },
      removedFromInstallation: { $ne: true },
    },
    { $set: buildRepoSet(changes) } as UpdateFilter<RepoDoc>,
  );
  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
});
