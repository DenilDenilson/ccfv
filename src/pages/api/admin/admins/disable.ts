import type { APIRoute } from 'astro';
import { currentAdmin, disableAdminPrincipal } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-principals')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const principalId = String(body.get('principalId') || '');
  if (!/^[0-9a-f-]{20,80}$/i.test(principalId)) return errorJson(422, 'invalid_input', 'Administrador inválido.');
  return await disableAdminPrincipal(principalId, admin.id) ? redirectTo('/admin?status=admin-disabled') : errorJson(409, 'conflict', 'No puedes desactivarte a ti mismo o el administrador ya estaba inactivo.');
};
