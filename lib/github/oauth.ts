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

// The install URL (not the authorize endpoint) is what creates an installation;
// with OAuth-on-install enabled it also returns a code to the callback.
export function buildInstallUrl(state: string): string {
  const env = getEnv();
  const url = new URL(
    `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
  );
  url.searchParams.set("state", state);
  return url.toString();
}

// For an app that is already installed: GitHub shows the installation settings
// instead of redirecting, so only user authorization returns a code.
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/api/github/callback`);
  url.searchParams.set("state", state);
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

/**
 * Revokes a user token issued to this app (DELETE /applications/{client_id}/token).
 * Used for tokens we only needed once, such as an org owner's during an invite.
 */
export async function revokeUserToken(accessToken: string): Promise<void> {
  const env = getEnv();
  const basic = Buffer.from(
    `${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(
    `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  );
  // 204 = revoked; 404 = already gone. Anything else is worth a log line.
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`GitHub token revoke returned ${res.status}`);
  }
}
