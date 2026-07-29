import { describe, it, expect, vi } from "vitest";
import {
  withRetry,
  HttpError,
  isRetryableStatus,
  parseRetryAfter,
} from "@/lib/util/retry";

const RETRY_OPTS = {
  maxAttempts: 3,
  baseDelayMs: 1,
  maxDelayMs: 5,
  isRetryable: (error: unknown) =>
    error instanceof HttpError && isRetryableStatus(error.status),
  retryAfterMs: (error: unknown) =>
    error instanceof HttpError ? error.retryAfterMs : null,
};

describe("isRetryableStatus", () => {
  it("treats 429 and 5xx as retryable", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("treats 4xx (except 429) as non-retryable", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  it("returns null for a missing header", () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("parses a delay in seconds", () => {
    expect(parseRetryAfter("2")).toBe(2000);
  });

  it("parses an HTTP date into a future delay", () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).not.toBeNull();
    expect(ms as number).toBeGreaterThan(0);
  });
});

describe("withRetry", () => {
  it("returns the result without retrying on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, RETRY_OPTS);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors up to maxAttempts then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(503, "down", null));
    await expect(withRetry(fn, RETRY_OPTS)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(404, "missing", null));
    await expect(withRetry(fn, RETRY_OPTS)).rejects.toThrow("missing");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds on a later attempt after transient failures", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(500, "flaky", null))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn, RETRY_OPTS);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
