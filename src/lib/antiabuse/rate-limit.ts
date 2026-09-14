import { sqlDb } from '@/lib/db/client';
import { requiredSecret } from '@/lib/env';
import { hmacSha256, randomId } from '@/lib/security/crypto';

interface RateLimitOptions {
  bucket: string;
  limit: number;
  periodSeconds: number;
  roundId?: string;
}

/**
 * Small D1-backed safety net for endpoints that can trigger expensive work.
 * The IP is only used as a short-lived HMAC signal; the original value is never stored.
 * A missing platform IP is allowed through because an IP is not an identity.
 */
export async function consumeIpRateLimit(request: Request, options: RateLimitOptions): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip) return true;
  const now = Math.floor(Date.now() / 1000);
  const period = Math.floor(now / options.periodSeconds);
  const ipKeyPeriod = `${options.bucket}:${period}`;
  const ipHmac = await hmacSha256(requiredSecret('VISITOR_COOKIE_HMAC_KEY'), `rate:${ipKeyPeriod}:${ip}`);
  const existing = await sqlDb().prepare(`
    SELECT COUNT(*) AS count FROM abuse_events
    WHERE signal_type = 'request_rate_limit' AND ip_hmac = ? AND ip_key_period = ?
  `).bind(ipHmac, ipKeyPeriod).first<{ count: number }>();
  if (Number(existing?.count ?? 0) >= options.limit) return false;
  await sqlDb().prepare(`
    INSERT INTO abuse_events (id, round_id, signal_type, action_taken, ip_hmac, ip_key_period, request_id, expires_at)
    VALUES (?, ?, 'request_rate_limit', 'allowed', ?, ?, ?, ?)
  `).bind(randomId(), options.roundId ?? null, ipHmac, ipKeyPeriod, randomId(), now + 7 * 24 * 60 * 60).run();
  return true;
}
