import { NextResponse } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import { getDashboardStats } from "@/lib/dashboard/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withGuard(async () => {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
});
