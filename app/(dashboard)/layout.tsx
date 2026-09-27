import * as React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await validateSession(token))) {
    // ?expired=1 tells proxy.ts to clear the invalid cookie instead of redirecting back here.
    redirect("/login?expired=1");
  }
  return <AppShell>{children}</AppShell>;
}
