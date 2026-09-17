import type { APIRoute } from 'astro';
import { currentMember } from '@/lib/auth/member';
import { consumeIpRateLimit } from '@/lib/antiabuse/rate-limit';
import { countMemberProposalsSince, createProposal, getRoundById, saveManualMovie, saveMovie } from '@/lib/db/repositories';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { fetchMoviePreview, parseImdbId } from '@/lib/tmdb';

export const prerender = false;

function redirectStatus(status: string, roundId: string): Response {
  return redirectTo(`/miembros/proponer?round=${encodeURIComponent(roundId)}&status=${encodeURIComponent(status)}`);
}

function parseOptionalYear(value: string): number | null {
  if (!value) return null;
  const year = Number(value);
  const currentYear = new Date().getUTCFullYear();
  return Number.isInteger(year) && year >= 1888 && year <= currentYear + 2 ? year : null;
}

function parseOptionalPositiveInt(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : null;
}

function parsePosterUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString().slice(0, 1000) : null;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const member = await currentMember(request);
  if (!member) return redirectTo('/miembros/ingresar?status=expired');
  if (!await consumeIpRateLimit(request, { bucket: 'member-proposal-create', limit: 10, periodSeconds: 60 })) {
    return errorJson(429, 'rate_limited', 'Demasiadas propuestas. Espera un minuto e inténtalo nuevamente.');
  }
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'member-proposal')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');

  const roundId = String(body.get('roundId') || '').trim();
  const round = roundId ? await getRoundById(roundId) : null;
  if (!round || round.status !== 'draft') return roundId ? redirectStatus('round-closed', roundId) : redirectTo('/miembros/proponer?status=round-required');

  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  if (await countMemberProposalsSince(member.id, since) >= 5) return redirectStatus('limit', roundId);

  const justification = String(body.get('justification') || '').trim().slice(0, 500) || null;
  const mode = String(body.get('submissionMode') || 'tmdb');
  try {
    let movie;
    if (mode === 'manual') {
      const title = String(body.get('manualTitle') || '').trim().slice(0, 200);
      if (title.length < 2) return redirectStatus('manual-invalid', roundId);
      const originalTitle = String(body.get('manualOriginalTitle') || '').trim().slice(0, 200) || null;
      const overview = String(body.get('manualOverview') || '').trim().slice(0, 4000) || null;
      const poster = parsePosterUrl(String(body.get('manualPosterUrl') || '').trim());
      if (!overview || !poster) return redirectStatus('manual-invalid', roundId);
      const releaseYear = parseOptionalYear(String(body.get('manualReleaseYear') || '').trim());
      const runtimeMinutes = parseOptionalPositiveInt(String(body.get('manualRuntimeMinutes') || '').trim());
      const directors = String(body.get('manualDirectors') || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 10);
      movie = await saveManualMovie({ title, originalTitle, overview, posterUrl: poster, releaseYear, runtimeMinutes, directors });
    } else {
      const imdbId = parseImdbId(String(body.get('imdbUrl') || '').trim());
      const confirmedImdbId = parseImdbId(String(body.get('confirmedImdbId') || '').trim());
      if (!imdbId) return redirectStatus('invalid', roundId);
      if (!confirmedImdbId || confirmedImdbId !== imdbId) return redirectStatus('confirm-required', roundId);
      const preview = await fetchMoviePreview(imdbId);
      if (!preview) return redirectStatus('not-found', roundId);
      movie = await saveMovie(preview);
    }
    const result = await createProposal(roundId, member.id, movie.id, justification);
    return redirectStatus(result.duplicate ? 'duplicate' : result.autoApproved ? 'created-auto' : 'created', roundId);
  } catch (error) {
    if (error instanceof Error && error.message === 'round-full') return redirectStatus('round-full', roundId);
    return redirectStatus(mode === 'manual' ? 'manual-error' : 'provider', roundId);
  }
};
