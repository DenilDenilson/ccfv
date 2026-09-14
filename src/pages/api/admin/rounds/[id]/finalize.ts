import type { APIRoute } from 'astro';
import { currentAdmin, finalizeRound } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const roundId = params.id || '';
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-round:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  if (!/^[0-9a-f-]{20,80}$/i.test(roundId)) return errorJson(422, 'invalid_input', 'Ronda inválida.');
  return await finalizeRound(roundId) ? redirectTo('/admin?status=results-finalized') : errorJson(409, 'conflict', 'La ronda aún no puede cerrar sus resultados o ya fue finalizada.');
};
