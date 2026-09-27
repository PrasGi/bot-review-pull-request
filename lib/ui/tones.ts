// State → tone mapping shared by every screen (see design-system/README.md, "State mapping").

export type Tone = "success" | "warning" | "error" | "info" | "neutral";

/** completed → success, failed → error, queued/processing → info, everything else → neutral. */
export function requestStatusTone(status: string): Tone {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "queued" || status === "processing") return "info";
  return "neutral";
}

/** APPROVE → success, REQUEST_CHANGES → error, COMMENT → warning. */
export function verdictTone(verdict: string): Tone {
  if (verdict === "APPROVE") return "success";
  if (verdict === "REQUEST_CHANGES") return "error";
  if (verdict === "COMMENT") return "warning";
  return "neutral";
}

/** critical/major → error, minor → warning, nit → neutral. */
export function severityTone(severity: string): Tone {
  if (severity === "critical" || severity === "major") return "error";
  if (severity === "minor") return "warning";
  return "neutral";
}
