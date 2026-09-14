import type { APIRoute } from 'astro';
import { currentAdmin, disableMember } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-members')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const memberId = String(body.get('memberId') || '');
  if (!/^[0-9a-f-]{20,80}$/i.test(memberId)) return errorJson(422, 'invalid_input', 'Miembro inválido.');
  return await disableMember(memberId, admin.id) ? redirectTo('/admin?status=member-disabled') : errorJson(409, 'conflict', 'El miembro ya estaba desactivado.');
};
