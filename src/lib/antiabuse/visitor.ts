import { requiredSecret } from '@/lib/env';
import { base64UrlEncode, hmacSha256, randomBytes, verifyHmac } from '@/lib/security/crypto';
import { readCookie, serializeCookie } from '@/lib/security/cookies';

export const VISITOR_COOKIE = '__Host-ccfv_visitor';
const VISITOR_MAX_AGE = 180 * 24 * 60 * 60;

export interface VisitorIdentity {
  visitorId: string;
  voterKeyForRound: (roundId: string) => Promise<string>;
  setCookie: string | null;
}

export async function visitorIdentity(request: Request): Promise<VisitorIdentity> {
  const cookie = readCookie(request, VISITOR_COOKIE);
  let visitorId: string | null = null;
  let setCookie: string | null = null;
  if (cookie) {
    const [id, signature] = cookie.split('.');
    if (id && signature && await verifyHmac(requiredSecret('VISITOR_COOKIE_HMAC_KEY'), `visitor:${id}`, signature)) {
      visitorId = id;
    }
  }
  if (!visitorId) {
    visitorId = base64UrlEncode(randomBytes(32));
    const signature = await hmacSha256(requiredSecret('VISITOR_COOKIE_HMAC_KEY'), `visitor:${visitorId}`);
    setCookie = serializeCookie(VISITOR_COOKIE, `${visitorId}.${signature}`, VISITOR_MAX_AGE);
  }
  return {
    visitorId,
    setCookie,
    voterKeyForRound: (roundId) => hmacSha256(requiredSecret('VISITOR_COOKIE_HMAC_KEY'), `voter:${roundId}:${visitorId}`),
  };
}
