import { defineMiddleware } from 'astro:middleware';
import { randomId } from '@/lib/security/crypto';
import { runtimeEnv } from '@/lib/env';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.requestId = randomId();
  const response = await next();
  response.headers.set('X-Request-ID', context.locals.requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const connectSources = ["'self'", 'https://challenges.cloudflare.com'];
  const accessIssuer = runtimeEnv().CF_ACCESS_ISSUER?.trim();
  if (accessIssuer) {
    try { connectSources.push(new URL(accessIssuer).origin); } catch { /* Ignore invalid optional issuer here; JWT validation handles it. */ }
  }
  response.headers.set('Content-Security-Policy', `default-src 'self'; img-src 'self' https://image.tmdb.org data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src ${connectSources.join(' ')}`);
  if (context.request.method !== 'GET' || context.url.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
});
