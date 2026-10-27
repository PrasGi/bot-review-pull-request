import type { PrFile } from "@/lib/review/diff-format";

const API_BASE = "https://api.github.com";

export type CompareOutcome =
  | { ok: true; files: PrFile[]; status: string }
  | { ok: false; reason: "unreachable" | "diverged" | "merged_base" | "error" };

interface CompareApiResponse {
  status: string;
  total_commits?: number;
  commits?: { parents?: unknown[] }[];
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
  // A merge commit in the range (e.g. `main` merged into the PR branch) brings the
  // other branch's changes into the diff, so it no longer shows only the PR's own
  // work. A truncated commit list cannot be checked, so it is treated the same way.
  const commits = data.commits ?? [];
  if (
    commits.length < (data.total_commits ?? commits.length) ||
    commits.some((commit) => (commit.parents?.length ?? 0) > 1)
  ) {
    return { ok: false, reason: "merged_base" };
  }

  return { ok: true, files: data.files ?? [], status: data.status };
}
