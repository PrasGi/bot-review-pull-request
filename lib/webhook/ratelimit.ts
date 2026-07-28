const CAPACITY = 60;
const REFILL_PER_SEC = 1;
const SIGNATURE_FAILURE_COST = 10;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

function take(ip: string, cost: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { tokens: CAPACITY, lastRefill: now };
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    CAPACITY,
    bucket.tokens + elapsedSec * REFILL_PER_SEC,
  );
  bucket.lastRefill = now;

  if (bucket.tokens < cost) {
    buckets.set(ip, bucket);
    return false;
  }
  bucket.tokens -= cost;
  buckets.set(ip, bucket);
  return true;
}

export function allowRequest(ip: string): boolean {
  return take(ip, 1);
}

export function penalizeSignatureFailure(ip: string): void {
  take(ip, SIGNATURE_FAILURE_COST);
}
