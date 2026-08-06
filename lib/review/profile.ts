import type { RepoConfig, ReviewProfile } from "@/lib/db/types";

export function resolveReviewProfile(
  config: RepoConfig,
  authorLogin: string,
): ReviewProfile {
  const login = authorLogin.trim().toLowerCase();
  if (!login) return config.reviewProfile;

  const rule = config.authorProfiles?.find(
    (r) => r.login.trim().toLowerCase() === login,
  );
  return rule?.profile ?? config.reviewProfile;
}
