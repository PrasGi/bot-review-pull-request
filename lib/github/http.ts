const API_BASE = "https://api.github.com";
const GH_TIMEOUT_MS = 15_000;

export type GhResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: string };

export async function ghRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<GhResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(GH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: true, data: (await res.json()) as T };
}
