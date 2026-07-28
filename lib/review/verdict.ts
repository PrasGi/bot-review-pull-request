import type {
  Finding,
  FindingSeverity,
  RepoConfig,
  Verdict,
  VerdictForcedReason,
} from "@/lib/db/types";
import type { FindingOutput, IntentMatchOutput } from "@/lib/review/schemas";
import { PROFILE_KNOBS } from "@/lib/prompts/defaults";

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  nit: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

const CATEGORY_RANK: Record<Finding["category"], number> = {
  security: 5,
  bug: 4,
  scope: 3,
  performance: 2,
  test: 1,
  maintainability: 0,
};

export function enforceKnobs(
  findings: FindingOutput[],
  profile: RepoConfig["reviewProfile"],
): { kept: FindingOutput[]; droppedCount: number } {
  const knobs = PROFILE_KNOBS[profile];
  const floor = SEVERITY_RANK[knobs.severityFloor];
  const passed = findings.filter((f) => SEVERITY_RANK[f.severity] >= floor);
  passed.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    return CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category];
  });
  const kept = passed.slice(0, knobs.maxFindings);
  return { kept, droppedCount: findings.length - kept.length };
}

export function filterFindingsToValidLines(
  findings: FindingOutput[],
  newHunkLinesByPath: Map<string, Set<number>>,
): { kept: FindingOutput[]; droppedCount: number } {
  const kept = findings.filter((f) => {
    const lines = newHunkLinesByPath.get(f.path);
    return lines?.has(f.line) ?? false;
  });
  return { kept, droppedCount: findings.length - kept.length };
}

export interface VerdictResolution {
  verdict: Verdict;
  forced?: VerdictForcedReason;
  caveat?: string;
}

// The model self-declares `blocking` per finding: true only when it is confident
// the issue must be fixed. Uncertain concerns are non-blocking -> approve with a
// "please double-check" caveat instead of blocking the PR.
export function resolveVerdict(params: {
  intentMatch: IntentMatchOutput;
  findings: FindingOutput[];
  config: RepoConfig;
}): VerdictResolution {
  const { intentMatch, findings, config } = params;

  if (!config.autoVerdict) {
    return { verdict: "COMMENT", forced: "auto_verdict_off" };
  }

  const hasBlocker = findings.some((f) => f.blocking);
  if (hasBlocker) {
    return { verdict: "REQUEST_CHANGES", forced: "critical_findings" };
  }

  const hasCaveat = findings.some((f) => !f.blocking && f.severity !== "nit");
  if (intentMatch.status === "mismatch") {
    return {
      verdict: "APPROVE",
      forced: "intent_mismatch",
      caveat:
        "The title/description don't fully match the changes — please confirm this is intentional and documented.",
    };
  }
  if (hasCaveat) {
    return {
      verdict: "APPROVE",
      caveat:
        "A few things I couldn't fully verify from the diff alone — please double-check the comments below.",
    };
  }
  return { verdict: "APPROVE" };
}
