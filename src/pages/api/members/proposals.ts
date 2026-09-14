import type { APIRoute } from 'astro';
import { currentMember } from '@/lib/auth/member';
import { countMemberProposalsSince, createProposal, saveMovie } from '@/lib/db/repositories';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { fetchMoviePreview, parseImdbId } from '@/lib/tmdb';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const member = await currentMember(request);
  if (!member) return redirectTo('/miembros/ingresar?status=expired');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'member-proposal')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const rawUrl = String(body.get('imdbUrl') || '').trim();
  const imdbId = parseImdbId(rawUrl);
  const confirmedImdbId = parseImdbId(String(body.get('confirmedImdbId') || '').trim());
  const justification = String(body.get('justification') || '').trim().slice(0, 500) || null;
  if (!imdbId) return redirectTo('/miembros/proponer?status=invalid');
  if (!confirmedImdbId || confirmedImdbId !== imdbId) return redirectTo('/miembros/proponer?status=confirm-required');
  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  if (await countMemberProposalsSince(member.id, since) >= 5) return redirectTo('/miembros/proponer?status=limit');
  try {
    const preview = await fetchMoviePreview(imdbId);
    if (!preview) return redirectTo('/miembros/proponer?status=not-found');
    const movie = await saveMovie(preview);
    const result = await createProposal(member.id, movie.id, justification);
    return redirectTo(`/miembros/proponer?status=${result.duplicate ? 'duplicate' : 'created'}`);
  } catch {
    return redirectTo('/miembros/proponer?status=provider');
  }
};
