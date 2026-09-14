import type { APIRoute } from 'astro';
import { currentMember } from '@/lib/auth/member';
import { errorJson, formBody, json } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { fetchMoviePreview, parseImdbId } from '@/lib/tmdb';
import { consumeIpRateLimit } from '@/lib/antiabuse/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!await currentMember(request)) return errorJson(401, 'member_required', 'Debes ingresar como miembro.');
  if (!await consumeIpRateLimit(request, { bucket: 'tmdb-preview', limit: 12, periodSeconds: 60 })) return errorJson(429, 'rate_limited', 'Demasiadas consultas. Espera un minuto e inténtalo nuevamente.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'member-proposal')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const imdbId = parseImdbId(String(body.get('imdbUrl') || '').trim());
  if (!imdbId) return errorJson(422, 'invalid_imdb', 'Pega un enlace válido de IMDb.');
  try {
    const preview = await fetchMoviePreview(imdbId);
    return preview ? json({ preview }) : errorJson(404, 'not_found', 'TMDB no encontró una película para ese IMDb ID.');
  } catch {
    return errorJson(502, 'provider_error', 'No se pudo consultar TMDB. Inténtalo nuevamente.');
  }
};
