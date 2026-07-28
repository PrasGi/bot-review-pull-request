import { NextResponse, type NextRequest } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import { usageQuerySchema } from "@/lib/schemas";
import { getUsage, usageToCsv } from "@/lib/dashboard/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = usageQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid query" } },
      { status: 422 },
    );
  }
  const summary = await getUsage(parsed.data);

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(usageToCsv(summary), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="usage.csv"',
      },
    });
  }
  return NextResponse.json(summary);
});
