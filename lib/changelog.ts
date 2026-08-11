export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.4.0",
    date: "2026-08-11",
    title: "Self-hosted tuning — bigger budget, honest verdicts",
    changes: [
      "Token budget per PR raised from 96k to 1,000,000 now that the 300s serverless cap is gone.",
      "A review may now run for up to 30 minutes instead of 4.",
      "An incomplete review posts a COMMENT only — it will no longer approve or request changes on code it never read.",
      "The review body now states plainly why it stopped: token limit, time limit, or a failed read.",
      "Chunks that fail are recorded instead of vanishing silently, so failures can finally be diagnosed.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-08-07",
    title: "Per-author review profiles",
    changes: [
      "A repo can now override its review profile per GitHub author — one repo can review user A as expert and everyone else as chill.",
      "Raised the per-PR chunk ceiling so large PRs get more coverage.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-07",
    title: "GLM-5.2 and reasoning control",
    changes: [
      "Default model switched to glm-5.2.",
      "Reasoning mode is now controlled explicitly; with it off the model missed a planted open-redirect, so it stays on for code review.",
      "Fixed vendor parameters being silently ignored — determinism settings had never actually applied.",
      "Added a real concurrency limiter and wall-clock deadlines so one stuck call can no longer consume the whole run.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-08-07",
    title: "Reviews that explain themselves",
    changes: [
      "An approval now says why instead of a fixed 'All good — no blocking issues found.'",
      "Named vulnerability classes (open redirect, path traversal, injection, JWT signature) are no longer dropped by the scope heuristics.",
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0]?.version ?? "0.0.0";
