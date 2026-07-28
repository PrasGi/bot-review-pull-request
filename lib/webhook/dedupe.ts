import { processedWebhooksCollection } from "@/lib/db/collections";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function registerDelivery(
  deliveryId: string,
  event: string,
): Promise<boolean> {
  const collection = await processedWebhooksCollection();
  const now = new Date();
  try {
    await collection.insertOne({
      _id: deliveryId,
      event,
      processedAt: now,
      expiresAt: new Date(now.getTime() + RETENTION_MS),
    });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === 11000
    ) {
      return false;
    }
    throw error;
  }
}
