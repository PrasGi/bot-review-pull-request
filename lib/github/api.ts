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

async function githubGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<GitHubUser> {
  return githubGet<GitHubUser>("/user", accessToken);
}

export async function fetchInstallationRepos(
  accessToken: string,
): Promise<{
  selection: "all" | "selected";
  repos: GitHubRepo[];
}> {
  const collected: GitHubRepo[] = [];
  let page = 1;
  let selection: "all" | "selected" = "selected";
  for (;;) {
    const data = await githubGet<InstallationReposResponse>(
      `/user/installations/repositories?per_page=100&page=${page}`,
      accessToken,
    );
    selection = data.repository_selection;
    collected.push(...data.repositories);
    if (data.repositories.length < 100) break;
    page += 1;
  }
  return { selection, repos: collected };
}
