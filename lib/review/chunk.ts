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

// Conservative (÷3, not ÷4) so we under-fill chunks rather than overshoot the
// fast-inference regime and blow the latency budget.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

function fileTokens(file: PrFile): number {
  return estimateTokens(file.patch ?? "");
}

// A single oversized file must be TRUNCATED, not just counted small — otherwise
// the full patch is sent and the "budget" is fiction (this caused 44k-token calls).
function truncatePatch(file: PrFile, maxTokens: number): PrFile {
  if (!file.patch || fileTokens(file) <= maxTokens) return file;
  const maxChars = maxTokens * 3;
  const lines = file.patch.split("\n");
  const kept: string[] = [];
  let chars = 0;
  for (const line of lines) {
    if (chars + line.length > maxChars) break;
    kept.push(line);
    chars += line.length + 1;
  }
  kept.push("... [diff truncated for size]");
  return { ...file, patch: kept.join("\n") };
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

export interface ChunkBudget {
  chunkTokens: number;
  totalInputBudget: number;
  maxChunks: number;
}

export function chunkFiles(files: PrFile[], budget: ChunkBudget): ChunkPlan {
  const ordered = prioritizeFiles(files);
  const chunks: Chunk[] = [];
  const unreviewed: PrFile[] = [];
  let totalPacked = 0;

  let current: Chunk = { files: [], tokenEstimate: 0 };
  const seal = (): void => {
    if (current.files.length > 0) chunks.push(current);
    current = { files: [], tokenEstimate: 0 };
  };

  for (const rawFile of ordered) {
    const file = truncatePatch(rawFile, budget.chunkTokens);
    const tokens = fileTokens(file);

    const totalCapReached = totalPacked + tokens > budget.totalInputBudget;
    const chunkCapReached = chunks.length >= budget.maxChunks;
    const wouldOverflowChunk =
      current.files.length > 0 &&
      current.tokenEstimate + tokens > budget.chunkTokens;

    if (wouldOverflowChunk) seal();

    const noRoomForNewChunk =
      current.files.length === 0 && chunks.length >= budget.maxChunks;

    if (totalCapReached || (wouldOverflowChunk && chunkCapReached) || noRoomForNewChunk) {
      unreviewed.push(rawFile);
      continue;
    }

    current.files.push(file);
    current.tokenEstimate += tokens;
    totalPacked += tokens;
  }
  seal();

  return { chunks, unreviewed };
}
