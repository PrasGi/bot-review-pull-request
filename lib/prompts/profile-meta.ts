import type { ReviewProfile } from "@/lib/db/types";

// Client-safe: the dashboard imports this, so keep prompt text out of it.

export interface ProfileMeta {
  label: string;
  /** Short qualifier used in selects: "Chill — light-touch suggestions". */
  tagline: string;
  /** One sentence describing the reviewer's character. */
  description: string;
}

export const REVIEW_PROFILES: ReviewProfile[] = [
  "chill",
  "normal",
  "professional",
  "expert",
];

export const PROFILE_META: Record<ReviewProfile, ProfileMeta> = {
  chill: {
    label: "Chill",
    tagline: "light-touch suggestions",
    description:
      "A friendly mentor. Flags only real bugs and security issues, explains why each one matters, and keeps a warm tone.",
  },
  normal: {
    label: "Normal",
    tagline: "balanced feedback",
    description:
      "A pragmatic senior engineer. A light, high-signal pass on bugs and security that skips style and nitpicks.",
  },
  professional: {
    label: "Professional",
    tagline: "thorough review",
    description:
      "A meticulous senior engineer. Also checks error handling, edge cases, tests, naming and contracts.",
  },
  expert: {
    label: "Expert",
    tagline: "exhaustive analysis",
    description:
      "A principal engineer. Everything a professional review covers, plus flow, design, consistency and docs.",
  },
};
