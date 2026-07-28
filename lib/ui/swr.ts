export type ApiError = {
  error: { code: string; message: string };
};

export class FetchError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.code = code;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // non-JSON error body; keep defaults
    }
    throw new FetchError(res.status, code, message);
  }
  return (await res.json()) as T;
}

type MutateMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export async function mutateJson<T>(
  url: string,
  method: MutateMethod,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const parsed = (await res.json()) as Partial<ApiError>;
      if (parsed.error) {
        code = parsed.error.code;
        message = parsed.error.message;
      }
    } catch {
      // non-JSON error body; keep defaults
    }
    throw new FetchError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
