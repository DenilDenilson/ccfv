import type { APIRoute } from 'astro';
import { currentAdmin, selectRoundMovie } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const roundId = params.id || '';
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-round:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const movieId = String(body.get('movieId') || '');
  const reason = String(body.get('reason') || '').trim().slice(0, 500);
  if (!/^[0-9a-f-]{20,80}$/i.test(roundId) || !/^[0-9a-f-]{20,80}$/i.test(movieId) || !reason) return errorJson(422, 'invalid_input', 'Indica la película y el motivo de selección.');
  return await selectRoundMovie(roundId, movieId, admin.id, reason) ? redirectTo('/admin?status=movie-selected') : errorJson(409, 'conflict', 'La ronda debe tener resultados finalizados y no puede tener otra película seleccionada.');
};
