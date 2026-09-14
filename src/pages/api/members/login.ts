import type { APIRoute } from 'astro';
import { authenticateMember } from '@/lib/auth/member';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { consumeIpRateLimit } from '@/lib/antiabuse/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await formBody(request);
    if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'member-login')) return errorJson(403, 'csrf', 'No se pudo validar el formulario. Recarga la página.');
    if (!await consumeIpRateLimit(request, { bucket: 'member-login', limit: 20, periodSeconds: 60 })) return errorJson(429, 'rate_limited', 'Demasiados intentos. Espera un minuto e inténtalo nuevamente.');
    const code = String(body.get('code') || '');
    const member = await authenticateMember(code);
    if (!member?.sessionCookie) return redirectTo('/miembros/ingresar?status=invalid');
    return redirectTo('/miembros', 303, [member.sessionCookie]);
  } catch (error) {
    if (error instanceof Error && error.message === 'request_too_large') return errorJson(413, 'request_too_large', 'La solicitud es demasiado grande.');
    return errorJson(500, 'login_failed', 'No se pudo iniciar sesión.');
  }
};
