import {
  withRetry,
  HttpError,
  isRetryableStatus,
  parseRetryAfter,
} from "@/lib/util/retry";

const API_BASE = "https://api.github.com";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
}

interface InstallationReposResponse {
  total_count: number;
  repository_selection: "all" | "selected";
  repositories: GitHubRepo[];
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    type?: "User" | "Organization";
  } | null;
  repository_selection?: "all" | "selected";
}

interface UserInstallationsResponse {
  total_count: number;
  installations: GitHubInstallation[];
}

async function githubGet<T>(path: string, accessToken: string): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!res.ok) {
        throw new HttpError(
          res.status,
          `GitHub API ${path} returned ${res.status}`,
          parseRetryAfter(res.headers.get("retry-after")),
        );
      }
      return (await res.json()) as T;
    },
    {
      maxAttempts: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 10_000,
      isRetryable: (error) =>
        error instanceof HttpError && isRetryableStatus(error.status),
      retryAfterMs: (error) =>
        error instanceof HttpError ? error.retryAfterMs : null,
    },
  );
}

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<GitHubUser> {
  return githubGet<GitHubUser>("/user", accessToken);
}

export async function fetchUserInstallations(
  accessToken: string,
): Promise<GitHubInstallation[]> {
  const data = await githubGet<UserInstallationsResponse>(
    "/user/installations?per_page=100",
    accessToken,
  );
  return data.installations;
}

export async function fetchInstallationRepos(
  accessToken: string,
  installationId: number,
): Promise<{
  selection: "all" | "selected";
  repos: GitHubRepo[];
}> {
  const collected: GitHubRepo[] = [];
  let page = 1;
  let selection: "all" | "selected" = "selected";
  for (;;) {
    const data = await githubGet<InstallationReposResponse>(
      `/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
      accessToken,
    );
    selection = data.repository_selection;
    collected.push(...data.repositories);
    if (data.repositories.length < 100) break;
    page += 1;
  }
  return { selection, repos: collected };
}
