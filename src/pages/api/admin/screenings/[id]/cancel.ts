import type { APIRoute } from 'astro';
import { cancelScreening, currentAdmin } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const screeningId = params.id || '';
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-screening:${screeningId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const reason = String(body.get('reason') || '').trim().slice(0, 500) || null;
  if (!/^[0-9a-f-]{20,80}$/i.test(screeningId)) return errorJson(422, 'invalid_input', 'Función inválida.');
  return await cancelScreening(screeningId, admin.id, reason) ? redirectTo('/admin?status=screening-cancelled') : errorJson(409, 'conflict', 'La función ya no está programada.');
};
