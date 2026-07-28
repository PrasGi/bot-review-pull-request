import { getEnv } from "@/lib/env";

export interface GitHubTokenSet {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

const TOKEN_URL = "https://github.com/login/oauth/access_token";

function toTokenSet(data: TokenResponse): GitHubTokenSet {
  if (
    !data.access_token ||
    !data.refresh_token ||
    data.expires_in === undefined ||
    data.refresh_token_expires_in === undefined
  ) {
    throw new Error(
      data.error_description ?? data.error ?? "Incomplete token response",
    );
  }
  const now = Date.now();
  return {
    accessToken: data.access_token,
    accessTokenExpiresAt: new Date(now + data.expires_in * 1000),
    refreshToken: data.refresh_token,
    refreshTokenExpiresAt: new Date(
      now + data.refresh_token_expires_in * 1000,
    ),
  };
}

async function postToken(
  params: Record<string, string>,
): Promise<GitHubTokenSet> {
  const env = getEnv();
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(`GitHub token endpoint returned ${res.status}`);
  }
  const data = (await res.json()) as TokenResponse;
  return toTokenSet(data);
}

export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/api/github/callback`);
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GitHubTokenSet> {
  return postToken({
    code,
    redirect_uri: `${getEnv().APP_URL}/api/github/callback`,
  });
}

export async function refreshTokens(
  refreshToken: string,
): Promise<GitHubTokenSet> {
  return postToken({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}
