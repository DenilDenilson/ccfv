import type { APIRoute } from 'astro';
import { createAdminMember, currentAdmin } from '@/lib/auth/admin';
import { normalizeDisplayName } from '@/lib/auth/member';
import { errorJson, formBody, json } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-members')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const displayName = normalizeDisplayName(String(body.get('displayName') || ''));
  if ([...displayName].length < 2 || !/[\p{L}]/u.test(displayName)) return errorJson(422, 'invalid_input', 'Indica un nombre válido.');
  try {
    const issued = await createAdminMember(displayName);
    return json({ memberId: issued.memberId, code: issued.code, message: 'Guarda este código: no volverá a mostrarse.' });
  } catch {
    return errorJson(409, 'conflict', 'No se pudo crear el miembro.');
  }
};
