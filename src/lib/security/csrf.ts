import { appOrigin, requiredSecret } from '@/lib/env';
import { hmacSha256, randomBytes, base64UrlEncode, verifyHmac } from '@/lib/security/crypto';

const TOKEN_TTL_SECONDS = 2 * 60 * 60;

export async function issueCsrfToken(scope: string): Promise<string> {
  const nonce = base64UrlEncode(randomBytes(18));
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${scope}.${expires}.${nonce}`;
  const signature = await hmacSha256(requiredSecret('CSRF_HMAC_KEY'), payload);
  return `${payload}.${signature}`;
}

export async function verifyCsrfToken(request: Request, token: string | null, scope: string): Promise<boolean> {
  if (!token) return false;
  const origin = request.headers.get('Origin');
  if (origin && origin !== appOrigin()) return false;
  const referer = request.headers.get('Referer');
  if (!origin && referer && !referer.startsWith(`${appOrigin()}/`)) return false;
  if (!origin && !referer) return false;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== scope) return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  return verifyHmac(requiredSecret('CSRF_HMAC_KEY'), parts.slice(0, 3).join('.'), parts[3]);
}
