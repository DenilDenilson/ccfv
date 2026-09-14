import type { APIRoute } from 'astro';
import { currentAdmin, markScreeningScreened } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const screeningId = params.id || '';
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-screening:${screeningId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const rawDate = String(body.get('screenedAt') || '');
  const screenedAt = rawDate ? Date.parse(rawDate) : Date.now();
  if (!/^[0-9a-f-]{20,80}$/i.test(screeningId) || !Number.isFinite(screenedAt)) return errorJson(422, 'invalid_input', 'Fecha de proyección inválida.');
  return await markScreeningScreened(screeningId, admin.id, Math.floor(screenedAt / 1000)) ? redirectTo('/admin?status=screening-recorded') : errorJson(409, 'conflict', 'La función ya no está programada.');
};
