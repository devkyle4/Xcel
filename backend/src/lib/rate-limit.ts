import { lt, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import type { Db } from '../db/client';
import { rateLimits } from '../db/schema';
import { getEnv } from '../env';

export interface RateLimit {
  limit: number;
  windowSeconds: number;
}

/**
 * Rate-limit key for an identifier such as an IP address or email. HMAC with
 * the app secret so raw identifiers are never stored and cannot be recovered.
 */
export function rateLimitKey(scope: string, identifier: string): string {
  const digest = createHmac('sha256', getEnv().APP_SECRET)
    .update(identifier.toLowerCase())
    .digest('base64url');
  return `${scope}:${digest}`;
}

/**
 * Counts one request against `key` in the current fixed window. Atomic, so
 * concurrent serverless instances share the count.
 */
export async function hitRateLimit(
  db: Db,
  key: string,
  { limit, windowSeconds }: RateLimit,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Occasionally clear out old windows; no scheduled job is needed.
  if (Math.random() < 0.01) {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, new Date(now.getTime() - 86_400_000)));
  }

  return {
    allowed: row!.count <= limit,
    retryAfterSeconds: Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
  };
}

/** Client IP as reported by Vercel's proxy; "unknown" locally. */
export function clientIp(headers: { get(name: string): string | null | undefined }): string {
  return (
    headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  );
}
