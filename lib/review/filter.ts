import type { PrFile } from "@/lib/review/diff-format";
import type { SkippedFile } from "@/lib/db/types";

const LOCKFILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "npm-shrinkwrap.json",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "bun.lockb",
]);

const GENERATED_DIR = /(^|\/)(dist|build|\.next|node_modules|vendor|coverage)\//;
const GENERATED_FILE =
  /\.(min\.js|min\.css|map|lock)$|\.generated\.|(^|\/)__snapshots__\//;
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|svg|ico|bmp|pdf|zip|gz|tar|woff2?|ttf|eot|otf|mp4|mp3|wav|mov|exe|dll|so|dylib|wasm|class|jar)$/i;

const GLOBSTAR_PLACEHOLDER = "___GLOBSTAR___";

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, GLOBSTAR_PLACEHOLDER)
    .replace(/\*/g, "[^/]*")
    .replace(new RegExp(GLOBSTAR_PLACEHOLDER, "g"), ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((glob) => {
    try {
      return globToRegExp(glob).test(path);
    } catch {
      return false;
    }
  });
}

export interface FilterResult {
  kept: PrFile[];
  skipped: SkippedFile[];
}

export function filterFiles(
  files: PrFile[],
  ignorePatterns: string[],
): FilterResult {
  const kept: PrFile[] = [];
  const skipped: SkippedFile[] = [];

  for (const file of files) {
    const name = file.filename;
    const base = name.split("/").pop() ?? name;

    if (file.status === "removed") {
      skipped.push({ path: name, reason: "removed" });
    } else if (LOCKFILES.has(base)) {
      skipped.push({ path: name, reason: "lockfile" });
    } else if (GENERATED_DIR.test(name) || GENERATED_FILE.test(name)) {
      skipped.push({ path: name, reason: "generated" });
    } else if (BINARY_EXT.test(name)) {
      skipped.push({ path: name, reason: "binary" });
    } else if (!file.patch) {
      skipped.push({ path: name, reason: "no_diff" });
    } else if (matchesAnyGlob(name, ignorePatterns)) {
      skipped.push({ path: name, reason: "ignored_pattern" });
    } else {
      kept.push(file);
    }
  }

  return { kept, skipped };
}
