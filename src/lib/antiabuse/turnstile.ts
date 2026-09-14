import { runtimeEnv } from '@/lib/env';

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  hostname?: string;
}

export function turnstileSiteKey(): string | null {
  const value = runtimeEnv().PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return value || null;
}

export function turnstileConfigured(): boolean {
  return Boolean(turnstileSiteKey() && runtimeEnv().TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string, request: Request, expectedAction: string): Promise<boolean> {
  const secret = runtimeEnv().TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const form = new URLSearchParams({ secret, response: token });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    if (!response.ok) return false;
    const result = await response.json() as SiteverifyResponse;
    const expectedHostname = new URL(runtimeEnv().PUBLIC_APP_ORIGIN || request.url).hostname;
    const actionValid = !result.action || result.action === expectedAction;
    const hostnameValid = !result.hostname || result.hostname === expectedHostname;
    return result.success === true && actionValid && hostnameValid;
  } catch {
    return false;
  }
}
