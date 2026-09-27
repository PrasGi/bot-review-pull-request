import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  filterOptions,
  filterRepos,
  hasActiveFilter,
  modelKey,
  modelLabel,
  parseRepoFilter,
  type FilterableRepo,
} from "@/lib/repos/filter";

function repo(fullName: string, overrides: Partial<FilterableRepo> = {}, config: Partial<FilterableRepo["config"]> = {}): FilterableRepo {
  return {
    fullName,
    accountLogin: fullName.split("/")[0] ?? "",
    enabled: true,
    removedFromInstallation: false,
    ...overrides,
    config: { provider: null, model: null, reviewProfile: "chill", ...config },
  };
}

const repos = [
  repo("YoCoApp/yoco-lib"),
  repo("YoCoApp/engineering", { enabled: false }, { reviewProfile: "expert" }),
  repo("YoCoApp/old", { removedFromInstallation: true }),
  repo("PrasGi/home", {}, { provider: "anthropic", model: "claude-sonnet-5" }),
  repo("PrasGi/bot", {}, { provider: "glm", model: null }),
];

const names = (list: FilterableRepo[]): string[] => list.map((r) => r.fullName);

describe("parseRepoFilter", () => {
  it("reads known values and drops unknown ones", () => {
    const filter = parseRepoFilter(
      new URLSearchParams("q=lib&account=YoCoApp&status=disabled&profile=expert&model=default"),
    );
    expect(filter).toEqual({ q: "lib", account: "YoCoApp", status: "disabled", profile: "expert", model: "default" });
    expect(parseRepoFilter(new URLSearchParams("status=weird&profile=nope"))).toEqual(EMPTY_FILTER);
  });

  it("knows when any filter is active", () => {
    expect(hasActiveFilter(EMPTY_FILTER)).toBe(false);
    expect(hasActiveFilter({ ...EMPTY_FILTER, model: "default" })).toBe(true);
  });
});

describe("filterRepos", () => {
  it("returns everything without a filter", () => {
    expect(filterRepos(repos, EMPTY_FILTER)).toHaveLength(5);
  });

  it("filters by account, status, character and search together", () => {
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, account: "YoCoApp", status: "enabled" }))).toEqual([
      "YoCoApp/yoco-lib",
    ]);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, status: "disabled" }))).toEqual(["YoCoApp/engineering"]);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, status: "removed" }))).toEqual(["YoCoApp/old"]);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, profile: "expert" }))).toEqual(["YoCoApp/engineering"]);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, q: "  HOME " }))).toEqual(["PrasGi/home"]);
  });

  it("filters by model: inherited vs each override", () => {
    expect(filterRepos(repos, { ...EMPTY_FILTER, model: "default" })).toHaveLength(3);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, model: "anthropic:claude-sonnet-5" }))).toEqual(["PrasGi/home"]);
    expect(names(filterRepos(repos, { ...EMPTY_FILTER, model: "glm:default" }))).toEqual(["PrasGi/bot"]);
  });
});

describe("model keys and options", () => {
  it("labels inherited halves plainly", () => {
    expect(modelKey({ provider: null, model: null, reviewProfile: "chill" })).toBe("default");
    expect(modelLabel("default")).toBe("Default (inherit global)");
    expect(modelLabel("anthropic:claude-sonnet-5")).toBe("Anthropic · claude-sonnet-5");
    expect(modelLabel("glm:default")).toBe("GLM · default model");
  });

  it("offers only values present in the data, default model first", () => {
    const options = filterOptions(repos);
    expect(options.accounts.map((o) => o.value)).toEqual(["PrasGi", "YoCoApp"]);
    expect(options.models.map((o) => o.value)).toEqual(["default", "anthropic:claude-sonnet-5", "glm:default"]);
    expect(options.profiles.map((o) => o.value)).toEqual(["chill", "normal", "professional", "expert"]);
  });
});
