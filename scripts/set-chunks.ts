import { reposCollection } from "@/lib/db/collections";
import { repoConfigSchema } from "@/lib/schemas";

const MAX_CHUNKS = repoConfigSchema.shape.maxChunks.maxValue ?? 84;

async function main(): Promise<void> {
  const arg = process.argv[2];
  const parsed = repoConfigSchema.shape.maxChunks.safeParse(
    arg === undefined ? MAX_CHUNKS : Number(arg),
  );
  if (!parsed.success) {
    process.stderr.write(
      `Invalid maxChunks "${arg}". Use a whole number between 1 and ${MAX_CHUNKS}.\n`,
    );
    process.exit(1);
  }
  const maxChunks = parsed.data;

  const repos = await reposCollection();
  const behind = await repos.countDocuments({
    "config.maxChunks": { $ne: maxChunks },
  });
  if (behind === 0) {
    process.stdout.write(`All repos already at maxChunks=${maxChunks}.\n`);
    process.exit(0);
  }

  const result = await repos.updateMany(
    { "config.maxChunks": { $ne: maxChunks } },
    { $set: { "config.maxChunks": maxChunks, updatedAt: new Date() } },
  );

  process.stdout.write(
    `Set maxChunks=${maxChunks} on ${result.modifiedCount} repos (matched ${result.matchedCount}).\n`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`set-chunks failed: ${message}\n`);
  process.exit(1);
});
