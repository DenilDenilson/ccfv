import { z } from 'zod';
import { runtimeEnv } from '@/lib/env';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const imdbIdSchema = z.string().regex(/^tt\d{4,12}$/);

const findResponseSchema = z.object({
  movie_results: z.array(z.object({ id: z.number().int().positive(), imdb_id: z.string().optional() })).default([]),
});

const detailSchema = z.object({
  id: z.number().int().positive(),
  imdb_id: z.string().optional(),
  title: z.string().default(''),
  original_title: z.string().default(''),
  release_date: z.string().optional().nullable(),
  poster_path: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  runtime: z.number().int().positive().optional().nullable(),
  credits: z.object({ crew: z.array(z.object({ job: z.string(), name: z.string() })).default([]) }).optional(),
});

export interface MoviePreview {
  tmdbId: number;
  imdbId: string;
  title: string;
  originalTitle: string;
  releaseDate: string | null;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  directors: string[];
}

export function parseImdbId(input: string): string | null {
  try {
    const value = input.trim();
    const direct = imdbIdSchema.safeParse(value.toLowerCase());
    if (direct.success) return direct.data;
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['imdb.com', 'www.imdb.com', 'm.imdb.com'].includes(url.hostname)) return null;
    // IMDb serves localized URLs such as /es/title/... and /de/title/....
    // Accept one locale segment while still requiring the canonical title path.
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(tt\d{4,12})(?:[/?]|$)/i);
    if (!match) return null;
    const id = match[1].toLowerCase();
    return imdbIdSchema.safeParse(id).success ? id : null;
  } catch {
    return null;
  }
}

function apiHeaders(): HeadersInit {
  const token = runtimeEnv().TMDB_API_TOKEN;
  if (!token) throw new Error('TMDB_API_TOKEN is not configured');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function tmdbFetch(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${TMDB_BASE_URL}${path}`, { headers: apiHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMoviePreview(imdbId: string): Promise<MoviePreview | null> {
  const parsedId = imdbIdSchema.parse(imdbId);
  const find = findResponseSchema.parse(await tmdbFetch(`/find/${encodeURIComponent(parsedId)}?external_source=imdb_id&language=es-PE`));
  const match = find.movie_results[0];
  if (!match) return null;
  const detail = detailSchema.parse(await tmdbFetch(`/movie/${match.id}?language=es-PE&append_to_response=credits`));
  const releaseDate = detail.release_date || null;
  const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) || null : null;
  const directors = [...new Set((detail.credits?.crew ?? []).filter((person) => person.job === 'Director').map((person) => person.name).filter(Boolean))];
  return {
    tmdbId: detail.id,
    imdbId: detail.imdb_id || parsedId,
    title: detail.title || detail.original_title,
    originalTitle: detail.original_title || detail.title,
    releaseDate,
    releaseYear,
    posterPath: detail.poster_path || null,
    overview: detail.overview || null,
    runtimeMinutes: detail.runtime || null,
    directors,
  };
}

export function posterUrl(path: string | null, size = 'w500'): string | null {
  if (!path) return null;
  // Manual proposals may provide a hosted HTTPS poster URL. TMDB paths are
  // still validated strictly before being expanded to the image CDN.
  if (/^https:\/\/[^\s]+$/i.test(path)) return path;
  if (!/^\/[A-Za-z0-9._/-]+$/.test(path)) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
