import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sqlDb } from '@/lib/db/client';
import { runtimeEnv } from '@/lib/env';
import { hmacSha256, randomId, verifyHmac } from '@/lib/security/crypto';
import { createMember, revokeMemberSessions, rotateMemberCode } from '@/lib/auth/member';
import { readCookie, serializeCookie, serializeDeleteCookie } from '@/lib/security/cookies';

export interface AdminIdentity {
  id: string;
  subject: string;
  displayName: string;
  issuer: string;
}

export interface PendingProposal {
  id: string;
  round_id: string | null;
  round_title: string | null;
  movie_id: string;
  justification: string | null;
  created_at: number;
  title: string;
  original_title: string;
  release_year: number | null;
  proposer: string;
}

export interface AdminRound {
  id: string;
  slug: string;
  title: string;
  status: string;
  audience: string;
  starts_at: number;
  ends_at: number;
  candidate_count: number;
  results_finalized_at: number | null;
  results_published_at: number | null;
}

export interface ApprovedProposal {
  id: string;
  movie_id: string;
  title: string;
  release_year: number | null;
  round_id: string | null;
  round_title: string | null;
}

export interface AdminCandidate {
  movie_id: string;
  title: string;
  release_year: number | null;
  selected_at: number | null;
}

export interface AdminRoundResult {
  movie_id: string;
  title: string;
  member_count: number;
  public_counted_count: number;
  public_abuse_excluded_count: number;
  public_converted_count: number;
}

export interface AdminScreening {
  id: string;
  movie_id: string;
  round_id: string | null;
  movie_title: string;
  status: string;
  scheduled_at: number;
  screened_at: number | null;
  venue: string | null;
}

export interface AdminMember {
  id: string;
  display_name: string;
  status: string;
  created_at: number;
  code_rotated_at: number | null;
}

export interface AdminPrincipal {
  id: string;
  access_issuer: string;
  access_subject: string;
  display_name: string;
  status: string;
  created_at: number;
}

export const LOCAL_ADMIN_COOKIE = '__Host-ccfv_admin';

let remoteKeys: ReturnType<typeof createRemoteJWKSet> | null = null;
let remoteKeysIssuer = '';

async function localAdmin(request: Request): Promise<AdminIdentity | null> {
  const environment = runtimeEnv();
  if (environment.APP_ENV !== 'local' || !environment.LOCAL_ADMIN_SECRET) return null;
  const headerAccepted = request.headers.get('X-CCFV-Local-Admin') === environment.LOCAL_ADMIN_SECRET;
  const cookie = readCookie(request, LOCAL_ADMIN_COOKIE);
  const cookieAccepted = cookie ? await verifyHmac(environment.LOCAL_ADMIN_SECRET, 'local-admin-session', cookie) : false;
  if (!headerAccepted && !cookieAccepted) return null;
  const subject = 'local-admin';
  const issuer = 'local';
  const id = `local-${subject}`;
  await sqlDb().prepare(`
    INSERT INTO admin_principals (id, access_issuer, access_subject, display_name, status)
    VALUES (?, ?, ?, ?, 'active')
    ON CONFLICT(access_issuer, access_subject) DO UPDATE SET status = 'active', updated_at = unixepoch()
  `).bind(id, issuer, subject, 'Administrador local').run();
  return { id, subject, displayName: 'Administrador local', issuer };
}

export async function issueLocalAdminCookie(secret: string): Promise<string | null> {
  const environment = runtimeEnv();
  if (environment.APP_ENV !== 'local' || !environment.LOCAL_ADMIN_SECRET || secret !== environment.LOCAL_ADMIN_SECRET) return null;
  const signature = await hmacSha256(environment.LOCAL_ADMIN_SECRET, 'local-admin-session');
  return serializeCookie(LOCAL_ADMIN_COOKIE, signature, 8 * 60 * 60);
}

export function clearLocalAdminCookie(): string {
  return serializeDeleteCookie(LOCAL_ADMIN_COOKIE);
}

export async function currentAdmin(request: Request): Promise<AdminIdentity | null> {
  const local = await localAdmin(request);
  if (local) return local;
  const environment = runtimeEnv();
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const issuer = environment.CF_ACCESS_ISSUER?.replace(/\/$/, '');
  const audience = environment.CF_ACCESS_AUDIENCE;
  if (!token || !issuer || !audience) return null;
  try {
    if (!remoteKeys || remoteKeysIssuer !== issuer) {
      remoteKeys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      remoteKeysIssuer = issuer;
    }
    const verified = await jwtVerify(token, remoteKeys, { issuer, audience });
    const subject = typeof verified.payload.sub === 'string' ? verified.payload.sub : null;
    if (!subject) return null;
    const row = await sqlDb().prepare(`
      SELECT id, access_subject, display_name, access_issuer
      FROM admin_principals WHERE access_issuer = ? AND access_subject = ? AND status = 'active' LIMIT 1
    `).bind(issuer, subject).first<{ id: string; access_subject: string; display_name: string; access_issuer: string }>();
    return row ? { id: row.id, subject: row.access_subject, displayName: row.display_name, issuer: row.access_issuer } : null;
  } catch {
    return null;
  }
}

export async function listPendingProposals(): Promise<PendingProposal[]> {
  const result = await sqlDb().prepare(`
    SELECT p.id, p.round_id, r.title AS round_title, p.movie_id, p.justification, p.created_at, m.title, m.original_title, m.release_year, me.display_name AS proposer
    FROM proposals p JOIN movies m ON m.id = p.movie_id JOIN members me ON me.id = p.member_id LEFT JOIN voting_rounds r ON r.id = p.round_id
    WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 100
  `).all<PendingProposal>();
  return result.results ?? [];
}

export async function listApprovedProposals(): Promise<ApprovedProposal[]> {
  const result = await sqlDb().prepare(`
    SELECT p.id, p.movie_id, p.round_id, r.title AS round_title, m.title, m.release_year
    FROM proposals p JOIN movies m ON m.id = p.movie_id LEFT JOIN voting_rounds r ON r.id = p.round_id
    WHERE p.status = 'approved' ORDER BY m.title ASC LIMIT 100
  `).all<ApprovedProposal>();
  return result.results ?? [];
}

export async function reviewProposal(proposalId: string, adminId: string, decision: 'approved' | 'rejected', reason: string | null): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE proposals SET status = ?, reviewed_by = ?, reviewed_at = unixepoch(), review_reason = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'pending'
  `).bind(decision, adminId, reason, proposalId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function createRound(adminId: string, input: { title: string; slug: string; description: string; startsAt: number; endsAt: number; audience: 'members' | 'members_and_public' }): Promise<string> {
  const id = randomId();
  await sqlDb().prepare(`
    INSERT INTO voting_rounds (id, slug, title, description, status, audience, starts_at, ends_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).bind(id, input.slug, input.title, input.description, input.audience, input.startsAt, input.endsAt, adminId, adminId).run();
  return id;
}

export async function listAdminRounds(): Promise<AdminRound[]> {
  const result = await sqlDb().prepare(`
    SELECT r.id, r.slug, r.title, r.status, r.audience, r.starts_at, r.ends_at, r.results_finalized_at, r.results_published_at, COUNT(rm.movie_id) AS candidate_count
    FROM voting_rounds r LEFT JOIN round_movies rm ON rm.round_id = r.id
    GROUP BY r.id ORDER BY r.starts_at DESC LIMIT 50
  `).all<AdminRound>();
  return result.results ?? [];
}

export async function listRoundResults(roundId: string): Promise<AdminRoundResult[]> {
  const result = await sqlDb().prepare(`
    SELECT rmr.movie_id, m.title, rmr.member_count, rmr.public_counted_count, rmr.public_abuse_excluded_count, rmr.public_converted_count
    FROM round_movie_results rmr JOIN movies m ON m.id = rmr.movie_id
    WHERE rmr.round_id = ? ORDER BY rmr.member_count DESC, rmr.public_counted_count DESC, m.title ASC
  `).bind(roundId).all<AdminRoundResult>();
  return result.results ?? [];
}

export async function listRoundCandidates(roundId: string): Promise<AdminCandidate[]> {
  const result = await sqlDb().prepare(`
    SELECT rm.movie_id, m.title, m.release_year, rm.selected_at
    FROM round_movies rm JOIN movies m ON m.id = rm.movie_id
    WHERE rm.round_id = ? ORDER BY rm.position ASC
  `).bind(roundId).all<AdminCandidate>();
  return result.results ?? [];
}

export async function addApprovedMovieToRound(roundId: string, movieId: string, adminId: string, position: number): Promise<boolean> {
  const result = await sqlDb().prepare(`
    INSERT INTO round_movies (round_id, movie_id, added_by, position)
    SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM proposals WHERE movie_id = ? AND status = 'approved' AND (round_id = ? OR round_id IS NULL))
    ON CONFLICT(round_id, movie_id) DO NOTHING
  `).bind(roundId, movieId, adminId, position, movieId, roundId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function addApprovedProposalToRound(roundId: string, proposalId: string, adminId: string, position: number): Promise<boolean> {
  const result = await sqlDb().prepare(`
    INSERT INTO round_movies (round_id, movie_id, added_by, position)
    SELECT ?, p.movie_id, ?, ? FROM proposals p
    JOIN voting_rounds r ON r.id = ?
    WHERE p.id = ? AND p.status = 'approved' AND (p.round_id = r.id OR p.round_id IS NULL) AND r.status = 'draft'
    ON CONFLICT(round_id, movie_id) DO NOTHING
  `).bind(roundId, adminId, position, roundId, proposalId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function publishRound(roundId: string, adminId: string): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE voting_rounds SET status = 'published', published_at = unixepoch(), updated_by = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'draft' AND (SELECT COUNT(*) FROM round_movies WHERE round_id = voting_rounds.id) BETWEEN 2 AND 12
  `).bind(adminId, roundId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function closeRound(roundId: string, adminId: string): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE voting_rounds SET status = 'closed', closed_at = unixepoch(), updated_by = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'published'
  `).bind(adminId, roundId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export interface AdminResultRow {
  movie_id: string;
  title: string;
  member_count: number;
  public_received_count: number;
  public_counted_count: number;
  public_excluded_count: number;
  public_converted_count: number;
}

export async function finalizeRound(roundId: string): Promise<boolean> {
  const round = await sqlDb().prepare('SELECT status, ends_at, results_finalized_at FROM voting_rounds WHERE id = ? LIMIT 1').bind(roundId).first<{ status: string; ends_at: number; results_finalized_at: number | null }>();
  if (!round || round.results_finalized_at || (round.status !== 'closed' && round.ends_at > Math.floor(Date.now() / 1000))) return false;
  const rows = await sqlDb().prepare(`
    SELECT rm.movie_id, m.title,
      (SELECT COUNT(*) FROM member_votes mv WHERE mv.round_id = rm.round_id AND mv.movie_id = rm.movie_id) AS member_count,
      (SELECT COUNT(*) FROM public_votes pv WHERE pv.round_id = rm.round_id AND pv.movie_id = rm.movie_id) AS public_received_count,
      (SELECT COUNT(*) FROM public_votes pv WHERE pv.round_id = rm.round_id AND pv.movie_id = rm.movie_id AND pv.status = 'counted') AS public_counted_count,
      (SELECT COUNT(*) FROM public_votes pv WHERE pv.round_id = rm.round_id AND pv.movie_id = rm.movie_id AND pv.status = 'excluded' AND COALESCE(pv.exclusion_reason, '') <> 'member_conversion') AS public_excluded_count,
      (SELECT COUNT(*) FROM public_votes pv WHERE pv.round_id = rm.round_id AND pv.movie_id = rm.movie_id AND pv.status = 'excluded' AND pv.exclusion_reason = 'member_conversion') AS public_converted_count
    FROM round_movies rm JOIN movies m ON m.id = rm.movie_id WHERE rm.round_id = ? ORDER BY rm.position
  `).bind(roundId).all<AdminResultRow>();
  const statements = [sqlDb().prepare('DELETE FROM round_movie_results WHERE round_id = ?').bind(roundId)];
  for (const row of rows.results ?? []) {
    statements.push(sqlDb().prepare(`
      INSERT INTO round_movie_results (round_id, movie_id, member_count, public_received_count, public_counted_count, public_abuse_excluded_count, public_converted_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(roundId, row.movie_id, row.member_count, row.public_received_count, row.public_counted_count, row.public_excluded_count, row.public_converted_count));
  }
  statements.push(sqlDb().prepare('UPDATE voting_rounds SET results_finalized_at = unixepoch(), status = \'closed\', closed_at = COALESCE(closed_at, unixepoch()) WHERE id = ? AND results_finalized_at IS NULL').bind(roundId));
  await sqlDb().batch(statements);
  return true;
}

export async function publishResults(roundId: string): Promise<boolean> {
  const result = await sqlDb().prepare('UPDATE voting_rounds SET results_published_at = unixepoch(), updated_at = unixepoch() WHERE id = ? AND results_finalized_at IS NOT NULL AND results_published_at IS NULL').bind(roundId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function selectRoundMovie(roundId: string, movieId: string, adminId: string, reason: string): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE round_movies SET selected_at = unixepoch(), selected_by = ?, selection_reason = ?
    WHERE round_id = ? AND movie_id = ? AND EXISTS (
      SELECT 1 FROM voting_rounds WHERE id = ? AND status = 'closed' AND results_finalized_at IS NOT NULL
    ) AND NOT EXISTS (SELECT 1 FROM round_movies WHERE round_id = ? AND selected_at IS NOT NULL)
  `).bind(adminId, reason, roundId, movieId, roundId, roundId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function scheduleSelectedMovie(roundId: string, movieId: string, adminId: string, scheduledAt: number, venue: string | null, notes: string | null): Promise<boolean> {
  const id = randomId();
  try {
    await sqlDb().prepare(`
      INSERT INTO screenings (id, movie_id, source_round_id, status, scheduled_at, venue, notes, created_by, updated_by)
      SELECT ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM round_movies rm JOIN voting_rounds r ON r.id = rm.round_id
        WHERE rm.round_id = ? AND rm.movie_id = ? AND rm.selected_at IS NOT NULL AND r.results_finalized_at IS NOT NULL
      )
    `).bind(id, movieId, roundId, scheduledAt, venue, notes, adminId, adminId, roundId, movieId).run();
    const row = await sqlDb().prepare('SELECT id FROM screenings WHERE id = ?').bind(id).first<{ id: string }>();
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function listAdminScreenings(): Promise<AdminScreening[]> {
  const result = await sqlDb().prepare(`
    SELECT s.id, s.movie_id, s.source_round_id AS round_id, m.title AS movie_title, s.status, s.scheduled_at, s.screened_at, s.venue
    FROM screenings s JOIN movies m ON m.id = s.movie_id
    ORDER BY s.scheduled_at DESC LIMIT 50
  `).all<AdminScreening>();
  return result.results ?? [];
}

export async function markScreeningScreened(screeningId: string, adminId: string, screenedAt: number): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE screenings SET status = 'screened', screened_at = ?, updated_by = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'scheduled'
  `).bind(screenedAt, adminId, screeningId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function cancelScreening(screeningId: string, adminId: string, reason: string | null): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE screenings SET status = 'cancelled', notes = COALESCE(?, notes), updated_by = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'scheduled'
  `).bind(reason, adminId, screeningId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function listAdminMembers(): Promise<AdminMember[]> {
  const result = await sqlDb().prepare(`
    SELECT id, display_name, status, created_at, code_rotated_at
    FROM members ORDER BY status ASC, display_name ASC LIMIT 200
  `).all<AdminMember>();
  return result.results ?? [];
}

export async function disableMember(memberId: string, adminId: string): Promise<boolean> {
  const result = await sqlDb().prepare(`
    UPDATE members SET status = 'disabled', disabled_at = unixepoch(), updated_at = unixepoch() WHERE id = ? AND status = 'active'
  `).bind(memberId).run();
  if (Number(result.meta?.changes ?? 0) !== 1) return false;
  await revokeMemberSessions(memberId);
  await sqlDb().prepare(`INSERT INTO audit_events (id, admin_id, actor_type, event_type, entity_type, entity_id, request_id) VALUES (?, ?, 'admin', 'member_disabled', 'member', ?, 'admin')`).bind(randomId(), adminId, memberId).run();
  return true;
}

export async function createAdminMember(displayName: string): Promise<{ memberId: string; code: string }> {
  return createMember(displayName);
}

export async function rotateAdminMemberCode(memberId: string): Promise<string> {
  return rotateMemberCode(memberId);
}

export async function listAdminPrincipals(): Promise<AdminPrincipal[]> {
  const result = await sqlDb().prepare(`
    SELECT id, access_issuer, access_subject, display_name, status, created_at
    FROM admin_principals ORDER BY status ASC, display_name ASC LIMIT 100
  `).all<AdminPrincipal>();
  return result.results ?? [];
}

export async function createAdminPrincipal(input: { issuer: string; subject: string; displayName: string }): Promise<boolean> {
  try {
    const result = await sqlDb().prepare(`
      INSERT INTO admin_principals (id, access_issuer, access_subject, display_name, status)
      VALUES (?, ?, ?, ?, 'active')
    `).bind(randomId(), input.issuer, input.subject, input.displayName).run();
    return Number(result.meta?.changes ?? 0) === 1;
  } catch {
    return false;
  }
}

export async function disableAdminPrincipal(principalId: string, currentAdminId: string): Promise<boolean> {
  if (principalId === currentAdminId) return false;
  const result = await sqlDb().prepare(`
    UPDATE admin_principals SET status = 'disabled', updated_at = unixepoch()
    WHERE id = ? AND status = 'active'
  `).bind(principalId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}
