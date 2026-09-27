import { orgInvitesCollection } from "@/lib/db/collections";

let ensured: Promise<void> | null = null;

async function createInviteIndexes(): Promise<void> {
  const invites = await orgInvitesCollection();
  await invites.createIndexes([
    { key: { tokenHash: 1 }, unique: true, name: "tokenHash_unique" },
    { key: { targetLoginKey: 1, completedAt: 1 }, name: "target_open" },
    { key: { createdAt: -1 }, name: "recent" },
  ]);
}

// Invites were added after the database was seeded, so the indexes are also
// ensured lazily on first use instead of relying on a re-run of `pnpm seed`.
export function ensureInviteIndexes(): Promise<void> {
  if (!ensured) {
    ensured = createInviteIndexes().catch((error: unknown) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}
