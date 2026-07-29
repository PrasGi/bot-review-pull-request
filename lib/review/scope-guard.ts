import type { ReviewProfile } from "@/lib/db/types";
import type { FindingOutput } from "@/lib/review/schemas";

const MISSING_RX =
  /\b(missing|no |lacks?|should (have|add|use|include)|needs?|without|forgot)\b/i;

const GLOBAL_WIRING_RX =
  /\b(auth(entication|orization)?|guard|use.?guards|middleware|interceptor|exception filter|csrf|cors|helmet|rate.?limit|throttl|logging|logger|tracing|metrics|transaction|transactional|tenant)\b/i;

const VALIDATION_RX =
  /\b(validat(e|ion|or)|sanitiz|null.?check|undefined.?check|schema check|type.?check)\b/i;

const UNDEFINED_SYMBOL_RX =
  /\b(is not defined|not defined anywhere|undefined (symbol|variable|function|constant)|unclear (what|whether) .{0,40}(does|is))\b/i;

const TEST_COVERAGE_RX =
  /\b(no tests?|missing tests?|test coverage|should (add|write) (a )?tests?|untested)\b/i;

const CONSISTENCY_RX =
  /\b(other (routes?|files?|services?|components?|modules?)|rest of (the )?codebase|convention (in|of) the (project|codebase)|sibling|elsewhere in the)\b/i;

const SPECULATION_RX =
  /\b(probably|likely|might be|may be|could be|presumably|assuming (there|a|the)|another file|other file)\b/i;

const PERF_SPECULATION_RX =
  /\b(n\s*\+\s*1|should (be )?cached?|memory leak|bundle size)\b/i;

function hedge(comment: string): string {
  return /^please double.?check/i.test(comment)
    ? comment
    : `Please double-check that this is handled: ${comment}`;
}

export interface ScopeGuardResult {
  kept: FindingOutput[];
  droppedCount: number;
  downgradedCount: number;
}

export function applyScopeGuard(
  findings: FindingOutput[],
  opts: {
    profile: ReviewProfile;
    removedDiffText: string;
    customGuidelines: string;
  },
): ScopeGuardResult {
  const lenient = opts.profile === "chill" || opts.profile === "normal";
  const kept: FindingOutput[] = [];
  let droppedCount = 0;
  let downgradedCount = 0;

  const drop = (): void => {
    droppedCount += 1;
  };
  const downgrade = (f: FindingOutput): void => {
    downgradedCount += 1;
    kept.push({ ...f, blocking: false, comment: hedge(f.comment) });
  };

  for (const f of findings) {
    const text = `${f.comment} ${f.suggestion ?? ""}`;

    if (UNDEFINED_SYMBOL_RX.test(text) || CONSISTENCY_RX.test(text)) {
      drop();
      continue;
    }

    const missingGlobal =
      MISSING_RX.test(text) &&
      (GLOBAL_WIRING_RX.test(text) || VALIDATION_RX.test(text));
    if (missingGlobal) {
      // Real regressions stay: the diff itself removed the guarded keyword.
      const diffRemovesIt =
        GLOBAL_WIRING_RX.test(opts.removedDiffText) ||
        VALIDATION_RX.test(opts.removedDiffText);
      const guidelinesOverride =
        GLOBAL_WIRING_RX.test(opts.customGuidelines) ||
        VALIDATION_RX.test(opts.customGuidelines);
      if (!diffRemovesIt && !guidelinesOverride) {
        if (lenient) drop();
        else downgrade(f);
        continue;
      }
    }

    if (TEST_COVERAGE_RX.test(text)) {
      if (opts.profile === "chill") drop();
      else if (f.blocking) downgrade(f);
      else kept.push(f);
      continue;
    }

    if (f.blocking && (SPECULATION_RX.test(text) || PERF_SPECULATION_RX.test(text))) {
      downgrade(f);
      continue;
    }

    kept.push(f);
  }

  return { kept, droppedCount, downgradedCount };
}

export function collectRemovedLines(patches: (string | undefined)[]): string {
  const removed: string[] = [];
  for (const patch of patches) {
    if (!patch) continue;
    for (const line of patch.split("\n")) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        removed.push(line);
      }
    }
  }
  return removed.join("\n");
}
