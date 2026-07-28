import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";
import { buildInstallUrl } from "@/lib/github/oauth";
import { accountsCollection } from "@/lib/db/collections";

async function main(): Promise<void> {
  const env = getEnv();
  const state = randomBytes(32).toString("hex");
  const url = buildInstallUrl(state);

  process.stdout.write(
    "\nOpen this URL, pick the account + repositories, and approve:\n\n" +
      `  ${url}\n\n` +
      "The OAuth callback runs in your deployed app at:\n" +
      `  ${env.APP_URL}/api/github/callback\n\n` +
      "Note: the CLI cannot receive the browser redirect. Use the deployed\n" +
      "callback (or a local tunnel) so the account is stored, then re-run this\n" +
      "script with --verify to confirm.\n\n",
  );

  if (process.argv.includes("--verify")) {
    const accounts = await accountsCollection();
    const count = await accounts.countDocuments();
    process.stdout.write(`Connected accounts in DB: ${count}\n`);
    const list = await accounts
      .find({}, { projection: { githubLogin: 1, installationId: 1 } })
      .toArray();
    for (const acc of list) {
      process.stdout.write(`  - @${acc.githubLogin}\n`);
    }
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`connect failed: ${message}\n`);
  process.exit(1);
});
