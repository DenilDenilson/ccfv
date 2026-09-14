import type { APIRoute } from 'astro';
import { createAdminPrincipal, currentAdmin } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-principals')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const issuer = String(body.get('issuer') || '').trim().replace(/\/$/, '').slice(0, 300);
  const subject = String(body.get('subject') || '').trim().slice(0, 300);
  const displayName = String(body.get('displayName') || '').trim().slice(0, 120);
  if (!/^https:\/\//.test(issuer) || subject.length < 2 || displayName.length < 2) return errorJson(422, 'invalid_input', 'Issuer, subject y nombre son obligatorios.');
  return await createAdminPrincipal({ issuer, subject, displayName }) ? redirectTo('/admin?status=admin-created') : errorJson(409, 'conflict', 'Ese administrador ya existe o no se pudo crear.');
};
