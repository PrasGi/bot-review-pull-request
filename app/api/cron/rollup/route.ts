import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { rollupUsageDaily } from "@/lib/dashboard/rollup";
import { log, errorFields } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = getEnv().CRON_SECRET;
  if (secret.length === 0) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  try {
    const upserts = await rollupUsageDaily();
    log.info("cron.rollup.ok", { upserts });
    return NextResponse.json({ status: "ok", upserts });
  } catch (error) {
    log.error("cron.rollup.failed", errorFields(error));
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
