import { reposCollection, settingsCollection } from "@/lib/db/collections";

async function main(): Promise<void> {
  const model = process.argv[2] ?? "glm-5.2";
  const clearOverrides = process.argv.includes("--clear-overrides");

  const settings = await settingsCollection();
  const global = await settings.findOne({ _id: "global" });
  if (!global) {
    process.stderr.write("No global settings found. Run `pnpm seed` first.\n");
    process.exit(1);
  }

  const pricing = global.modelPricing.find((p) => p.model === model);
  if (!pricing) {
    const known = global.modelPricing.map((p) => p.model).join(", ");
    process.stderr.write(
      `Unknown model "${model}" — it has no pricing row, so cost tracking would silently report $0.\nKnown models: ${known}\n`,
    );
    process.exit(1);
  }

  await settings.updateOne(
    { _id: "global" },
    {
      $set: {
        defaultModel: model,
        defaultProvider: pricing.provider,
        updatedAt: new Date(),
      },
    },
  );

  const repos = await reposCollection();
  const overridden = await repos.countDocuments({ "config.model": { $ne: null } });

  let clearedCount = 0;
  if (clearOverrides && overridden > 0) {
    const cleared = await repos.updateMany(
      { "config.model": { $ne: null } },
      { $set: { "config.model": null, "config.provider": null, updatedAt: new Date() } },
    );
    clearedCount = cleared.modifiedCount;
  }

  const lines = [
    `Default model set to "${model}" (provider: ${pricing.provider}, $${pricing.inputPerM}/M in, $${pricing.outputPerM}/M out).`,
  ];
  if (clearOverrides) {
    lines.push(`Cleared per-repo overrides on ${clearedCount} repos.`);
  } else if (overridden > 0) {
    lines.push(
      `${overridden} repos still override this with their own model. Re-run with --clear-overrides to reset them.`,
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`set-model failed: ${message}\n`);
  process.exit(1);
});
