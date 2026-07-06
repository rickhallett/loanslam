export type ConciergeRateLimitKind = "sessions" | "messages";

const RATE_WINDOW_MS = 5 * 60_000;

function rateLimitFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMITS: Record<ConciergeRateLimitKind, number> = {
  sessions: rateLimitFromEnv("CONCIERGE_RATE_SESSIONS", 40),
  messages: rateLimitFromEnv("CONCIERGE_RATE_MESSAGES", 120),
};

const rateBuckets = new Map<string, { windowStart: number; count: number }>();

export function conciergeRateLimitExceeded(
  kind: ConciergeRateLimitKind,
  ip: string,
): boolean {
  const now = Date.now();
  if (rateBuckets.size > 1000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const key = `${kind}:${ip}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMITS[kind];
}
