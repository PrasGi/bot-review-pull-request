import { reposCollection } from "@/lib/db/collections";
import type { ReviewProfile } from "@/lib/db/types";

const VALID: ReviewProfile[] = ["chill", "normal", "professional", "expert"];

async function main(): Promise<void> {
  const arg = process.argv[2];
  const profile = (arg ?? "chill") as ReviewProfile;
  if (!VALID.includes(profile)) {
    process.stderr.write(
      `Invalid profile "${arg}". Use one of: ${VALID.join(", ")}\n`,
    );
    process.exit(1);
  }

  const repos = await reposCollection();
  const result = await repos.updateMany(
    {},
    { $set: { "config.reviewProfile": profile, updatedAt: new Date() } },
  );

  process.stdout.write(
    `Set reviewProfile="${profile}" on ${result.modifiedCount} repos (matched ${result.matchedCount}).\n`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`set-profile failed: ${message}\n`);
  process.exit(1);
});
