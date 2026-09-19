import { sqlDb } from '@/lib/db/client';
import { randomId } from '@/lib/security/crypto';
import type { Audience, Candidate, MovieSummary, RoundSummary, VoteCounts } from '@/lib/types';

interface RoundRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: RoundSummary['status'];
  audience: Audience;
  starts_at: number;
  ends_at: number;
  results_published_at: number | null;
}

interface CandidateRow {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  original_title: string;
  release_year: number | null;
  poster_path: string | null;
  overview: string | null;
  runtime_minutes: number | null;
  directors_json: string | null;
  position: number;
}

export interface RoundWithCandidates {
  round: RoundSummary;
  candidates: Candidate[];
}

function mapRound(row: RoundRow): RoundSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    audience: row.audience,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    resultsPublishedAt: row.results_published_at,
  };
}

function mapCandidate(row: CandidateRow): Candidate {
  let directors: string[] = [];
  try {
    const parsed = row.directors_json ? JSON.parse(row.directors_json) : [];
    directors = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    directors = [];
  }
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    title: row.title,
    originalTitle: row.original_title,
    releaseYear: row.release_year,
    posterPath: row.poster_path,
    overview: row.overview,
    runtimeMinutes: row.runtime_minutes,
    directors,
    position: row.position,
  };
}

export function isRoundOpen(round: RoundSummary, now = Math.floor(Date.now() / 1000)): boolean {
  return round.status === 'published' && round.startsAt <= now && now < round.endsAt;
}

export async function listPublicRounds(): Promise<RoundSummary[]> {
  const result = await sqlDb().prepare(`
    SELECT id, slug, title, description, status, audience, starts_at, ends_at, results_published_at
    FROM voting_rounds
    WHERE audience = 'members_and_public' AND status IN ('published', 'closed')
    ORDER BY starts_at DESC
    LIMIT 20
  `).all<RoundRow>();
  return (result.results ?? []).map(mapRound);
}

export async function listMemberRounds(): Promise<RoundSummary[]> {
  const result = await sqlDb().prepare(`
    SELECT id, slug, title, description, status, audience, starts_at, ends_at, results_published_at
    FROM voting_rounds
    -- Members need to see draft rounds so they can submit proposals before
    -- the administrator opens voting. Cancelled rounds remain hidden.
    WHERE status IN ('draft', 'published', 'closed')
    ORDER BY starts_at DESC
    LIMIT 20
  `).all<RoundRow>();
  return (result.results ?? []).map(mapRound);
}

export async function getRoundBySlug(slug: string): Promise<RoundSummary | null> {
  const row = await sqlDb().prepare(`
    SELECT id, slug, title, description, status, audience, starts_at, ends_at, results_published_at
    FROM voting_rounds WHERE slug = ? LIMIT 1
  `).bind(slug).first<RoundRow>();
  return row ? mapRound(row) : null;
}

export async function getRoundById(id: string): Promise<RoundSummary | null> {
  const row = await sqlDb().prepare(`
    SELECT id, slug, title, description, status, audience, starts_at, ends_at, results_published_at
    FROM voting_rounds WHERE id = ? LIMIT 1
  `).bind(id).first<RoundRow>();
  return row ? mapRound(row) : null;
}

export async function getRoundWithCandidates(slug: string): Promise<RoundWithCandidates | null> {
  const round = await getRoundBySlug(slug);
  if (!round) return null;
  const result = await sqlDb().prepare(`
    SELECT m.id, m.tmdb_id, m.imdb_id, m.title, m.original_title, m.release_year,
      m.poster_path, m.overview, m.runtime_minutes, m.directors_json, rm.position
    FROM round_movies rm JOIN movies m ON m.id = rm.movie_id
    WHERE rm.round_id = ? ORDER BY rm.position ASC
  `).bind(round.id).all<CandidateRow>();
  return { round, candidates: (result.results ?? []).map(mapCandidate) };
}

export async function getVoteCounts(roundId: string): Promise<Map<string, VoteCounts>> {
  const counts = new Map<string, VoteCounts>();
  const candidateRows = await sqlDb().prepare('SELECT movie_id FROM round_movies WHERE round_id = ? ORDER BY position').bind(roundId).all<{ movie_id: string }>();
  for (const row of candidateRows.results ?? []) counts.set(row.movie_id, { member: 0, public: 0 });
  const members = await sqlDb().prepare('SELECT movie_id, COUNT(*) AS count FROM member_votes WHERE round_id = ? GROUP BY movie_id').bind(roundId).all<{ movie_id: string; count: number }>();
  for (const row of members.results ?? []) {
    const count = counts.get(row.movie_id);
    if (count) count.member = Number(row.count);
  }
  const publics = await sqlDb().prepare(`SELECT movie_id, COUNT(*) AS count FROM public_votes WHERE round_id = ? AND status = 'counted' GROUP BY movie_id`).bind(roundId).all<{ movie_id: string; count: number }>();
  for (const row of publics.results ?? []) {
    const count = counts.get(row.movie_id);
    if (count) count.public = Number(row.count);
  }
  return counts;
}

export async function getMemberVote(roundId: string, memberId: string): Promise<string | null> {
  const row = await sqlDb().prepare('SELECT movie_id FROM member_votes WHERE round_id = ? AND member_id = ? LIMIT 1').bind(roundId, memberId).first<{ movie_id: string }>();
  return row?.movie_id ?? null;
}

export async function getPublicVote(roundId: string, voterKey: string): Promise<string | null> {
  const row = await sqlDb().prepare('SELECT movie_id FROM public_votes WHERE round_id = ? AND voter_key = ? LIMIT 1').bind(roundId, voterKey).first<{ movie_id: string }>();
  return row?.movie_id ?? null;
}

export async function castMemberVote(roundId: string, memberId: string, movieId: string): Promise<boolean> {
  const id = randomId();
  const result = await sqlDb().prepare(`
    INSERT INTO member_votes (id, round_id, member_id, movie_id, created_at, updated_at)
    SELECT ?, ?, ?, ?, unixepoch(), unixepoch()
    WHERE EXISTS (
      SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = ?
      WHERE r.id = ? AND r.status = 'published' AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
    )
    ON CONFLICT(round_id, member_id) DO UPDATE SET movie_id = excluded.movie_id, updated_at = unixepoch()
    WHERE EXISTS (
      SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = excluded.movie_id
      WHERE r.id = excluded.round_id AND r.status = 'published' AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
    )
  `).bind(id, roundId, memberId, movieId, movieId, roundId).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export async function castMemberVoteWithPublicConversion(roundId: string, memberId: string, movieId: string, voterKey: string): Promise<boolean> {
  const id = randomId();
  const statements = [
    sqlDb().prepare(`
      INSERT INTO member_votes (id, round_id, member_id, movie_id, created_at, updated_at)
      SELECT ?, ?, ?, ?, unixepoch(), unixepoch()
      WHERE EXISTS (
        SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = ?
        WHERE r.id = ? AND r.status = 'published' AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
      )
      ON CONFLICT(round_id, member_id) DO UPDATE SET movie_id = excluded.movie_id, updated_at = unixepoch()
      WHERE EXISTS (
        SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = excluded.movie_id
        WHERE r.id = excluded.round_id AND r.status = 'published' AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
      )
    `).bind(id, roundId, memberId, movieId, movieId, roundId),
    sqlDb().prepare(`
      UPDATE public_votes SET status = 'excluded', exclusion_reason = 'member_conversion', updated_at = unixepoch()
      WHERE round_id = ? AND voter_key = ? AND status = 'counted'
        AND EXISTS (SELECT 1 FROM member_votes WHERE round_id = ? AND member_id = ? AND movie_id = ?)
    `).bind(roundId, voterKey, roundId, memberId, movieId),
  ];
  const [memberResult] = await sqlDb().batch(statements);
  return Number(memberResult.meta?.changes ?? 0) > 0;
}

export async function castPublicVote(roundId: string, voterKey: string, movieId: string): Promise<boolean> {
  const id = randomId();
  const result = await sqlDb().prepare(`
    INSERT INTO public_votes (id, round_id, voter_key, movie_id, status, created_at, updated_at)
    SELECT ?, ?, ?, ?, 'counted', unixepoch(), unixepoch()
    WHERE EXISTS (
      SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = ?
      WHERE r.id = ? AND r.audience = 'members_and_public' AND r.status = 'published'
        AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
    )
    ON CONFLICT(round_id, voter_key) DO UPDATE SET movie_id = excluded.movie_id, updated_at = unixepoch(), status = 'counted', exclusion_reason = NULL
    WHERE EXISTS (
      SELECT 1 FROM voting_rounds r JOIN round_movies rm ON rm.round_id = r.id AND rm.movie_id = excluded.movie_id
      WHERE r.id = excluded.round_id AND r.audience = 'members_and_public' AND r.status = 'published'
        AND r.starts_at <= unixepoch() AND unixepoch() < r.ends_at
    )
  `).bind(id, roundId, voterKey, movieId, movieId, roundId).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export async function convertPublicVoteToMember(roundId: string, voterKey: string): Promise<void> {
  await sqlDb().prepare(`
    UPDATE public_votes
    SET status = 'excluded', exclusion_reason = 'member_conversion', updated_at = unixepoch()
    WHERE round_id = ? AND voter_key = ? AND status = 'counted'
  `).bind(roundId, voterKey).run();
}

export interface MovieRecord extends MovieSummary {
  id: string;
}

export async function findMovieByExternalId(imdbId: string): Promise<MovieRecord | null> {
  const row = await sqlDb().prepare(`
    SELECT id, tmdb_id, imdb_id, title, original_title, release_year, poster_path, overview, runtime_minutes, directors_json
    FROM movies WHERE imdb_id = ? LIMIT 1
  `).bind(imdbId).first<CandidateRow>();
  return row ? mapCandidate({ ...row, position: 0 }) : null;
}

function manualMovieKey(title: string, releaseYear: number | null): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
  return `manual:${normalized}:${releaseYear ?? ''}`;
}

export interface ManualMovieInput {
  title: string;
  originalTitle?: string | null;
  releaseYear?: number | null;
  posterUrl?: string | null;
  overview?: string | null;
  runtimeMinutes?: number | null;
  directors?: string[];
}

export async function saveManualMovie(movie: ManualMovieInput): Promise<MovieRecord> {
  const title = movie.title.trim().slice(0, 200);
  const originalTitle = (movie.originalTitle?.trim() || title).slice(0, 200);
  const releaseYear = movie.releaseYear ?? null;
  const key = manualMovieKey(title, releaseYear);
  const existing = await sqlDb().prepare('SELECT id FROM movies WHERE manual_key = ? LIMIT 1').bind(key).first<{ id: string }>();
  const id = existing?.id ?? randomId();
  const posterPath = movie.posterUrl?.trim() || null;
  const overview = movie.overview?.trim().slice(0, 4000) || null;
  const runtimeMinutes = movie.runtimeMinutes ?? null;
  const directors = (movie.directors ?? []).map((director) => director.trim()).filter(Boolean).slice(0, 10);
  await sqlDb().prepare(`
    INSERT INTO movies (id, tmdb_id, imdb_id, manual_key, title, original_title, release_year, poster_path, overview, runtime_minutes, directors_json, metadata_language, metadata_fetched_at, updated_at)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'es-PE', unixepoch(), unixepoch())
    ON CONFLICT(id) DO UPDATE SET manual_key = excluded.manual_key, title = excluded.title,
      original_title = excluded.original_title, release_year = excluded.release_year,
      poster_path = excluded.poster_path, overview = excluded.overview,
      runtime_minutes = excluded.runtime_minutes, directors_json = excluded.directors_json,
      metadata_fetched_at = unixepoch(), updated_at = unixepoch()
  `).bind(id, key, title, originalTitle, releaseYear, posterPath, overview, runtimeMinutes, JSON.stringify(directors)).run();
  const row = await sqlDb().prepare(`
    SELECT id, tmdb_id, imdb_id, title, original_title, release_year, poster_path, overview, runtime_minutes, directors_json
    FROM movies WHERE id = ? LIMIT 1
  `).bind(id).first<CandidateRow>();
  if (!row) throw new Error('Manual movie was not persisted');
  return mapCandidate({ ...row, position: 0 });
}

export async function saveMovie(movie: {
  tmdbId: number; imdbId: string; title: string; originalTitle: string; releaseDate: string | null;
  releaseYear: number | null; posterPath: string | null; overview: string | null; runtimeMinutes: number | null; directors: string[];
}): Promise<MovieRecord> {
  const existing = await sqlDb().prepare('SELECT id FROM movies WHERE imdb_id = ? OR tmdb_id = ? LIMIT 1').bind(movie.imdbId, movie.tmdbId).first<{ id: string }>();
  const id = existing?.id ?? randomId();
  await sqlDb().prepare(`
    INSERT INTO movies (id, tmdb_id, imdb_id, title, original_title, release_date, release_year, poster_path, overview, runtime_minutes, directors_json, metadata_language, metadata_fetched_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'es-PE', unixepoch(), unixepoch())
    ON CONFLICT(id) DO UPDATE SET tmdb_id = excluded.tmdb_id, imdb_id = excluded.imdb_id, title = excluded.title,
      original_title = excluded.original_title, release_date = excluded.release_date, release_year = excluded.release_year,
      poster_path = excluded.poster_path, overview = excluded.overview, runtime_minutes = excluded.runtime_minutes,
      directors_json = excluded.directors_json, metadata_fetched_at = unixepoch(), updated_at = unixepoch()
  `).bind(id, movie.tmdbId, movie.imdbId, movie.title, movie.originalTitle, movie.releaseDate, movie.releaseYear, movie.posterPath, movie.overview, movie.runtimeMinutes, JSON.stringify(movie.directors)).run();
  const saved = await findMovieByExternalId(movie.imdbId);
  if (!saved) throw new Error('Movie was not persisted');
  return saved;
}

export async function countMemberProposalsSince(memberId: string, since: number): Promise<number> {
  const row = await sqlDb().prepare('SELECT COUNT(*) AS count FROM proposals WHERE member_id = ? AND created_at >= ?').bind(memberId, since).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function createProposal(roundId: string, memberId: string, movieId: string, justification: string | null): Promise<{ id: string; duplicate: boolean; autoApproved: boolean }> {
  const id = randomId();
  try {
    const round = await sqlDb().prepare('SELECT auto_approve_proposals, created_by FROM voting_rounds WHERE id = ? AND status = \'draft\' LIMIT 1').bind(roundId).first<{ auto_approve_proposals: number; created_by: string }>();
    const autoApproved = Number(round?.auto_approve_proposals ?? 0) === 1;
    if (autoApproved) {
      const count = await sqlDb().prepare('SELECT COUNT(*) AS count FROM round_movies WHERE round_id = ?').bind(roundId).first<{ count: number }>();
      if (Number(count?.count ?? 0) >= 12) throw new Error('round-full');
      await sqlDb().batch([
        sqlDb().prepare(`INSERT INTO proposals (id, round_id, movie_id, member_id, justification, status, reviewed_by, reviewed_at)
          VALUES (?, ?, ?, ?, ?, 'approved', ?, unixepoch())`).bind(id, roundId, movieId, memberId, justification, round?.created_by ?? null),
        sqlDb().prepare(`INSERT INTO round_movies (round_id, movie_id, added_by, position)
          SELECT ?, ?, ?, COALESCE(MAX(position), 0) + 1 FROM round_movies WHERE round_id = ?`).bind(roundId, movieId, round?.created_by ?? '', roundId),
      ]);
    } else {
      await sqlDb().prepare('INSERT INTO proposals (id, round_id, movie_id, member_id, justification, status) VALUES (?, ?, ?, ?, ?, \'pending\')').bind(id, roundId, movieId, memberId, justification).run();
    }
    return { id, duplicate: false, autoApproved };
  } catch (error) {
    const existing = await sqlDb().prepare('SELECT id FROM proposals WHERE round_id = ? AND movie_id = ? LIMIT 1').bind(roundId, movieId).first<{ id: string }>();
    if (existing) return { id: existing.id, duplicate: true, autoApproved: false };
    throw error;
  }
}

export async function listMemberProposals(memberId: string): Promise<Array<{ id: string; title: string; posterPath: string | null; roundTitle: string | null; status: string; justification: string | null; createdAt: number }>> {
  const result = await sqlDb().prepare(`
    SELECT p.id, m.title, m.poster_path, r.title AS round_title, p.status, p.justification, p.created_at
    FROM proposals p JOIN movies m ON m.id = p.movie_id LEFT JOIN voting_rounds r ON r.id = p.round_id
    WHERE p.member_id = ? ORDER BY p.created_at DESC LIMIT 50
  `).bind(memberId).all<{ id: string; title: string; poster_path: string | null; round_title: string | null; status: string; justification: string | null; created_at: number }>();
  return (result.results ?? []).map((row) => ({ id: row.id, title: row.title, posterPath: row.poster_path, roundTitle: row.round_title, status: row.status, justification: row.justification, createdAt: row.created_at }));
}
