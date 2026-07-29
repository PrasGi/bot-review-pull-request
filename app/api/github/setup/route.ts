import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const setupAction = request.nextUrl.searchParams.get("setup_action");
  const status = setupAction === "request" ? "pending" : "received";
  const url = new URL("/connected", getEnv().APP_URL);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url);
}
