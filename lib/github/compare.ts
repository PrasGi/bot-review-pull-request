import type { PrFile } from "@/lib/review/diff-format";

const API_BASE = "https://api.github.com";

export type CompareOutcome =
  | { ok: true; files: PrFile[]; status: string }
  | { ok: false; reason: "unreachable" | "diverged" | "error" };

interface CompareApiResponse {
  status: string;
  files?: PrFile[];
}

export async function fetchCompare(
  token: string,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
): Promise<CompareOutcome> {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`,
    {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (res.status === 404) return { ok: false, reason: "unreachable" };
  if (!res.ok) return { ok: false, reason: "error" };

  const data = (await res.json()) as CompareApiResponse;
  if (data.status === "diverged") return { ok: false, reason: "diverged" };

  return { ok: true, files: data.files ?? [], status: data.status };
}
