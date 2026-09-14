import type { APIRoute } from 'astro';
import { revokeCurrentMemberSession } from '@/lib/auth/member';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'member-logout')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  return redirectTo('/', 303, [await revokeCurrentMemberSession(request)]);
};
