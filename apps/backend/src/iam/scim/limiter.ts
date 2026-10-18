import type { ScimConfig } from "./config";

type Decision = { allowed: true } | { allowed: false; retryAfter: number };
const WINDOW_MS = 60_000;

/** Fixed windows start at the first accepted request. Active budgets are never evicted. */
export function createScimLimiter(config: ScimConfig, clock: () => number = Date.now) {
  const ips = new Map<string, { count: number; reset: number }>();
  const sources = new Map<string, { count: number; reset: number }>();
  const clean = (buckets: typeof ips, now: number) => {
    // Insertion order is expiry order because windows are never extended.
    for (const [key, bucket] of buckets) {
      if (bucket.reset > now) break;
      buckets.delete(key);
    }
  };
  const consume = (buckets: typeof ips, key: string, limit: number, cap: number): Decision => {
    const now = clock();
    clean(ips, now);
    clean(sources, now);
    const bucket = buckets.get(key);
    const retry = (reset: number): Decision => ({ allowed: false, retryAfter: Math.max(1, Math.ceil((reset - now) / 1000)) });
    if (bucket) {
      if (bucket.count >= limit) return retry(bucket.reset);
      bucket.count++;
    } else {
      if (buckets.size >= cap) return retry(buckets.values().next().value!.reset);
      buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    }
    return { allowed: true };
  };
  return {
    ip: (ip: string) => consume(ips, ip, config.ipLimit, 10_000),
    source: (documentId: string) => consume(sources, documentId, config.sourceLimit, 1000),
    size: () => { const now = clock(); clean(ips, now); clean(sources, now); return { ip: ips.size, source: sources.size }; },
  };
}
