import { getEnv } from "@/lib/env";
import { accountsCollection } from "@/lib/db/collections";

async function main(): Promise<void> {
  const env = getEnv();

  process.stdout.write(
    "\nOpen this URL in a browser, pick the account + repositories, approve:\n\n" +
      `  ${env.APP_URL}/api/github/connect\n\n` +
      "This endpoint sets the CSRF state cookie and redirects through GitHub's\n" +
      "authorize flow. After approving, the account is stored automatically.\n" +
      "Re-run with --verify to confirm.\n\n",
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
