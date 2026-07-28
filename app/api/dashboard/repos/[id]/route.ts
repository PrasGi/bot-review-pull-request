import { NextResponse, type NextRequest } from "next/server";
import { ObjectId, type UpdateFilter } from "mongodb";
import { guard } from "@/lib/auth/guard";
import { reposCollection } from "@/lib/db/collections";
import { repoUpdateSchema } from "@/lib/schemas";
import type { RepoDoc } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
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

  const parsed = repoUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          fields: parsed.error?.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.enabled !== undefined) set.enabled = parsed.data.enabled;
  if (parsed.data.config) {
    for (const [key, value] of Object.entries(parsed.data.config)) {
      set[`config.${key}`] = value;
    }
  }

  const repos = await reposCollection();
  const update = { $set: set } as UpdateFilter<RepoDoc>;
  const result = await repos.findOneAndUpdate(
    { _id: new ObjectId(id) },
    update,
    { returnDocument: "after" },
  );
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Repo not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, config: result.config, enabled: result.enabled });
}
