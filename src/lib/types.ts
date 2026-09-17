export type RoundStatus = 'draft' | 'published' | 'closed' | 'cancelled';
export type Audience = 'members' | 'members_and_public';

export interface RoundSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: RoundStatus;
  audience: Audience;
  startsAt: number;
  endsAt: number;
  resultsPublishedAt: number | null;
}

export interface MovieSummary {
  id: string;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  directors: string[];
}

export interface Candidate extends MovieSummary {
  position: number;
}

export interface VoteCounts {
  member: number;
  public: number;
}
