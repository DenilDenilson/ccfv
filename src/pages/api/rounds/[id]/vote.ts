import type { APIRoute } from 'astro';
import { currentMember } from '@/lib/auth/member';
import { visitorIdentity } from '@/lib/antiabuse/visitor';
import { castMemberVote, castMemberVoteWithPublicConversion, castPublicVote, getRoundById, isRoundOpen } from '@/lib/db/repositories';
import { isPublicVotingEnabled } from '@/lib/env';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { readCookie } from '@/lib/security/cookies';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { VISITOR_COOKIE } from '@/lib/antiabuse/visitor';
import { turnstileConfigured, verifyTurnstileToken } from '@/lib/antiabuse/turnstile';
import { consumeIpRateLimit } from '@/lib/antiabuse/rate-limit';
import { runtimeEnv } from '@/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const roundId = params.id;
  if (!roundId) return errorJson(404, 'not_found', 'Ronda no encontrada.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `round-vote:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const movieId = String(body.get('movieId') || '');
  if (!/^[0-9a-f-]{20,80}$/i.test(movieId)) return redirectTo('/?status=invalid');
  const round = await getRoundById(roundId);
  if (!round) return errorJson(404, 'not_found', 'Ronda no encontrada.');
  if (!isRoundOpen(round)) return redirectTo(`/rondas/${round.slug}?status=closed`);
  const member = await currentMember(request);
  if (member) {
    const visitorCookieExists = Boolean(readCookie(request, VISITOR_COOKIE));
    let visitor = visitorCookieExists ? await visitorIdentity(request) : null;
    const saved = visitor
      ? await castMemberVoteWithPublicConversion(roundId, member.id, movieId, await visitor.voterKeyForRound(roundId))
      : await castMemberVote(roundId, member.id, movieId);
    return saved ? redirectTo(`/rondas/${round.slug}?status=saved`) : redirectTo(`/rondas/${round.slug}?status=invalid`);
  }
  if (!isPublicVotingEnabled() || round.audience !== 'members_and_public') return errorJson(403, 'member_required', 'Esta ronda requiere acceso de miembro.');
  if (!await consumeIpRateLimit(request, { bucket: 'public-vote', limit: 30, periodSeconds: 60, roundId })) return errorJson(429, 'rate_limited', 'Demasiados intentos desde esta red. Espera un minuto e inténtalo nuevamente.');
  if (runtimeEnv().APP_ENV === 'production' && !turnstileConfigured()) return errorJson(503, 'antiabuse_unconfigured', 'La protección anti-bots no está configurada.');
  if (turnstileConfigured() && !await verifyTurnstileToken(String(body.get('cf-turnstile-response') || ''), request, 'public-vote')) return errorJson(403, 'turnstile', 'No se pudo validar la protección anti-bots.');
  const visitor = await visitorIdentity(request);
  const voterKey = await visitor.voterKeyForRound(roundId);
  const saved = await castPublicVote(roundId, voterKey, movieId);
  if (!saved) return redirectTo(`/rondas/${round.slug}?status=invalid`);
  return redirectTo(`/rondas/${round.slug}?status=saved`, 303, visitor.setCookie ? [visitor.setCookie] : []);
};
