import { describe, expect, it } from "vitest";
import { requestStatusTone, severityTone, verdictTone } from "./tones";

describe("requestStatusTone", () => {
  it("maps terminal and in-flight statuses", () => {
    expect(requestStatusTone("completed")).toBe("success");
    expect(requestStatusTone("failed")).toBe("error");
    expect(requestStatusTone("queued")).toBe("info");
    expect(requestStatusTone("processing")).toBe("info");
  });

  it("treats cancelled, skipped and superseded as neutral", () => {
    expect(requestStatusTone("cancelled")).toBe("neutral");
    expect(requestStatusTone("skipped_draft")).toBe("neutral");
    expect(requestStatusTone("superseded")).toBe("neutral");
  });
});

describe("verdictTone", () => {
  it("uses GitHub's verdict words", () => {
    expect(verdictTone("APPROVE")).toBe("success");
    expect(verdictTone("REQUEST_CHANGES")).toBe("error");
    expect(verdictTone("COMMENT")).toBe("warning");
    expect(verdictTone("UNKNOWN")).toBe("neutral");
  });
});

describe("severityTone", () => {
  it("groups critical and major as error", () => {
    expect(severityTone("critical")).toBe("error");
    expect(severityTone("major")).toBe("error");
    expect(severityTone("minor")).toBe("warning");
    expect(severityTone("nit")).toBe("neutral");
  });
});
