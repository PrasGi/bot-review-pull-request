import type { PrFile } from "@/lib/review/diff-format";

const SOURCE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|cpp|cc|c|h|hpp|swift|scala|ex|exs|vue|svelte)$/i;
const CONFIG_EXT =
  /\.(json|ya?ml|toml|ini|env|conf)$|(^|\/)(Dockerfile|Makefile|\.github\/)/i;
const DOC_EXT = /\.(md|mdx|txt|rst)$/i;

function rank(file: PrFile): number {
  if (SOURCE_EXT.test(file.filename)) return 1;
  if (CONFIG_EXT.test(file.filename)) return 3;
  if (DOC_EXT.test(file.filename)) return 4;
  return 2;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function fileTokens(file: PrFile): number {
  return estimateTokens(file.patch ?? "");
}

export function prioritizeFiles(files: PrFile[]): PrFile[] {
  return [...files].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return fileTokens(b) - fileTokens(a);
  });
}

export interface Chunk {
  files: PrFile[];
  tokenEstimate: number;
}

export interface ChunkPlan {
  chunks: Chunk[];
  unreviewed: PrFile[];
}

export function chunkFiles(
  files: PrFile[],
  diffBudgetTokens: number,
  maxChunks: number,
): ChunkPlan {
  const ordered = prioritizeFiles(files);
  const chunks: Chunk[] = [];
  const unreviewed: PrFile[] = [];

  let current: Chunk = { files: [], tokenEstimate: 0 };
  for (const file of ordered) {
    const tokens = Math.min(fileTokens(file), diffBudgetTokens);
    if (
      current.files.length > 0 &&
      current.tokenEstimate + tokens > diffBudgetTokens
    ) {
      chunks.push(current);
      if (chunks.length >= maxChunks) {
        current = { files: [], tokenEstimate: 0 };
        unreviewed.push(file);
        continue;
      }
      current = { files: [], tokenEstimate: 0 };
    }
    if (chunks.length >= maxChunks && current.files.length === 0) {
      unreviewed.push(file);
      continue;
    }
    current.files.push(file);
    current.tokenEstimate += tokens;
  }
  if (current.files.length > 0) chunks.push(current);

  return { chunks, unreviewed };
}
