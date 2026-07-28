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
}

export function resolveVerdict(params: {
  proposed: Verdict;
  confidence: number;
  intentMatch: IntentMatchOutput;
  findings: FindingOutput[];
  config: RepoConfig;
}): VerdictResolution {
  const { proposed, confidence, intentMatch, findings, config } = params;
  const hasCritical = findings.some((f) => f.severity === "critical");

  if (hasCritical) {
    return { verdict: "REQUEST_CHANGES", forced: "critical_findings" };
  }
  if (!config.autoVerdict) {
    return { verdict: "COMMENT", forced: "auto_verdict_off" };
  }
  if (confidence < config.confidenceThreshold) {
    return { verdict: "COMMENT", forced: "low_confidence" };
  }
  if (intentMatch.status === "mismatch" && proposed === "APPROVE") {
    return { verdict: "COMMENT", forced: "intent_mismatch" };
  }
  return { verdict: proposed };
}
