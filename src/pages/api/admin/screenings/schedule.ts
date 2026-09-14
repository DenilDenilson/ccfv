import type { APIRoute } from 'astro';
import { currentAdmin, scheduleSelectedMovie } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  const roundId = String(body.get('roundId') || '');
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-round:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const movieId = String(body.get('movieId') || '');
  const rawScheduledAt = String(body.get('scheduledAt') || '');
  const scheduledAt = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawScheduledAt) ? `${rawScheduledAt}:00-05:00` : rawScheduledAt);
  const venue = String(body.get('venue') || '').trim().slice(0, 160) || null;
  const notes = String(body.get('notes') || '').trim().slice(0, 500) || null;
  if (!/^[0-9a-f-]{20,80}$/i.test(roundId) || !/^[0-9a-f-]{20,80}$/i.test(movieId) || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) return errorJson(422, 'invalid_input', 'Indica una fecha futura y una película seleccionada.');
  const saved = await scheduleSelectedMovie(roundId, movieId, admin.id, Math.floor(scheduledAt / 1000), venue, notes);
  return saved ? redirectTo('/admin?status=screening-scheduled') : errorJson(409, 'conflict', 'La película debe estar seleccionada y la fecha no debe duplicar otra función.');
};
