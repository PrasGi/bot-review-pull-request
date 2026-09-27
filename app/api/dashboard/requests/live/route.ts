import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { withGuard } from "@/lib/auth/guard";
import { getLiveReview } from "@/lib/dashboard/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  focus: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const GET = withGuard(async (request: NextRequest) => {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid focus id" } },
      { status: 422 },
    );
  }
  const focusId = parsed.data.focus ? new ObjectId(parsed.data.focus) : null;
  return NextResponse.json(await getLiveReview(focusId));
});
