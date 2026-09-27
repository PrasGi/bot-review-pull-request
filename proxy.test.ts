import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie: `pr_session=${cookie}` } : undefined;
  return new NextRequest(new URL(path, "https://bot-review.example"), { headers });
}

describe("proxy", () => {
  it("sends visitors without a session to /login", () => {
    const res = proxy(request("/requests"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bot-review.example/login?next=%2Frequests");
  });

  it("sends visitors with a session away from /login", () => {
    const res = proxy(request("/login", "token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bot-review.example/");
  });

  it("clears a stale session on /login?expired=1 instead of redirecting (no loop)", () => {
    const res = proxy(request("/login?expired=1", "stale"));
    expect(res.headers.get("location")).toBeNull();
    const cleared = res.cookies.get("pr_session");
    expect(cleared?.value).toBe("");
  });
});
