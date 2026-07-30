export class PrClosedError extends Error {
  readonly reason: "pr_merged" | "pr_closed";

  constructor(reason: "pr_merged" | "pr_closed") {
    super(`PR review skipped: ${reason}`);
    this.name = "PrClosedError";
    this.reason = reason;
  }
}
