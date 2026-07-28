import { NextResponse, type NextRequest } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import { requestsQuerySchema } from "@/lib/schemas";
import { listRequests } from "@/lib/dashboard/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = requestsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid query" } },
      { status: 422 },
    );
  }
  const result = await listRequests(parsed.data);
  return NextResponse.json(result);
});
