import type { APIRoute } from 'astro';
import { currentAdmin, rotateAdminMemberCode } from '@/lib/auth/admin';
import { errorJson, formBody, json } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-members')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const memberId = String(body.get('memberId') || '');
  if (!/^[0-9a-f-]{20,80}$/i.test(memberId)) return errorJson(422, 'invalid_input', 'Miembro inválido.');
  try {
    const code = await rotateAdminMemberCode(memberId);
    return json({ memberId, code, message: 'El código anterior quedó revocado.' });
  } catch {
    return errorJson(409, 'conflict', 'No se pudo regenerar el código.');
  }
};
