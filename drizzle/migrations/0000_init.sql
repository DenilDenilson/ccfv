PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_principals (
  id TEXT PRIMARY KEY NOT NULL,
  access_issuer TEXT NOT NULL,
  access_subject TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (access_issuer, access_subject)
);
CREATE INDEX IF NOT EXISTS admin_principals_status_idx ON admin_principals(status);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  code_hash TEXT UNIQUE,
  code_key_version INTEGER NOT NULL DEFAULT 1,
  auth_version INTEGER NOT NULL DEFAULT 1,
  code_rotated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  disabled_at INTEGER
);
CREATE INDEX IF NOT EXISTS members_status_name_idx ON members(status, display_name);

CREATE TABLE IF NOT EXISTS member_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  auth_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS member_sessions_member_idx ON member_sessions(member_id);
CREATE INDEX IF NOT EXISTS member_sessions_expires_idx ON member_sessions(expires_at);

CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY NOT NULL,
  tmdb_id INTEGER NOT NULL UNIQUE,
  imdb_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  original_title TEXT NOT NULL,
  release_date TEXT,
  release_year INTEGER,
  poster_path TEXT,
  overview TEXT,
  runtime_minutes INTEGER CHECK (runtime_minutes IS NULL OR runtime_minutes > 0),
  directors_json TEXT,
  metadata_language TEXT NOT NULL DEFAULT 'es-PE',
  metadata_fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY NOT NULL,
  movie_id TEXT NOT NULL REFERENCES movies(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES admin_principals(id),
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (movie_id)
);
CREATE INDEX IF NOT EXISTS proposals_status_created_idx ON proposals(status, created_at);
CREATE INDEX IF NOT EXISTS proposals_member_created_idx ON proposals(member_id, created_at);

CREATE TABLE IF NOT EXISTS voting_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'cancelled')),
  audience TEXT NOT NULL DEFAULT 'members' CHECK (audience IN ('members', 'members_and_public')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
  published_at INTEGER,
  closed_at INTEGER,
  public_key_version INTEGER NOT NULL DEFAULT 1,
  results_finalized_at INTEGER,
  results_published_at INTEGER,
  created_by TEXT NOT NULL REFERENCES admin_principals(id),
  updated_by TEXT NOT NULL REFERENCES admin_principals(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS voting_rounds_status_dates_idx ON voting_rounds(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS voting_rounds_audience_status_idx ON voting_rounds(audience, status);

CREATE TABLE IF NOT EXISTS round_movies (
  round_id TEXT NOT NULL REFERENCES voting_rounds(id),
  movie_id TEXT NOT NULL REFERENCES movies(id),
  added_by TEXT NOT NULL REFERENCES admin_principals(id),
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  position INTEGER NOT NULL,
  selected_at INTEGER,
  selected_by TEXT REFERENCES admin_principals(id),
  selection_reason TEXT,
  PRIMARY KEY (round_id, movie_id)
);
CREATE INDEX IF NOT EXISTS round_movies_position_idx ON round_movies(round_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS round_movies_one_selected_uq ON round_movies(round_id) WHERE selected_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_votes (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  movie_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (round_id, member_id),
  FOREIGN KEY (round_id, movie_id) REFERENCES round_movies(round_id, movie_id)
);
CREATE INDEX IF NOT EXISTS member_votes_round_movie_idx ON member_votes(round_id, movie_id);

CREATE TABLE IF NOT EXISTS public_votes (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'counted' CHECK (status IN ('counted', 'excluded')),
  exclusion_reason TEXT,
  flagged_at INTEGER,
  flag_reason TEXT,
  reviewed_by TEXT REFERENCES admin_principals(id),
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (round_id, voter_key),
  FOREIGN KEY (round_id, movie_id) REFERENCES round_movies(round_id, movie_id)
);
CREATE INDEX IF NOT EXISTS public_votes_round_movie_status_idx ON public_votes(round_id, movie_id, status);
CREATE INDEX IF NOT EXISTS public_votes_round_flagged_idx ON public_votes(round_id, flagged_at);

CREATE TABLE IF NOT EXISTS round_movie_results (
  round_id TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  public_received_count INTEGER NOT NULL DEFAULT 0 CHECK (public_received_count >= 0),
  public_counted_count INTEGER NOT NULL DEFAULT 0 CHECK (public_counted_count >= 0),
  public_abuse_excluded_count INTEGER NOT NULL DEFAULT 0 CHECK (public_abuse_excluded_count >= 0),
  public_converted_count INTEGER NOT NULL DEFAULT 0 CHECK (public_converted_count >= 0),
  PRIMARY KEY (round_id, movie_id),
  FOREIGN KEY (round_id, movie_id) REFERENCES round_movies(round_id, movie_id)
);

CREATE TABLE IF NOT EXISTS screenings (
  id TEXT PRIMARY KEY NOT NULL,
  movie_id TEXT NOT NULL REFERENCES movies(id),
  source_round_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'screened', 'cancelled')),
  scheduled_at INTEGER NOT NULL,
  screened_at INTEGER,
  venue TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES admin_principals(id),
  updated_by TEXT NOT NULL REFERENCES admin_principals(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (movie_id, scheduled_at),
  FOREIGN KEY (source_round_id, movie_id) REFERENCES round_movies(round_id, movie_id)
);
CREATE INDEX IF NOT EXISTS screenings_status_date_idx ON screenings(status, scheduled_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  admin_id TEXT REFERENCES admin_principals(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system')),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  safe_metadata_json TEXT,
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS abuse_events (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT REFERENCES voting_rounds(id),
  public_vote_id TEXT REFERENCES public_votes(id),
  signal_type TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  ip_hmac TEXT,
  ip_key_period TEXT,
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS abuse_events_round_created_idx ON abuse_events(round_id, created_at);
CREATE INDEX IF NOT EXISTS abuse_events_ip_created_idx ON abuse_events(ip_hmac, created_at);
CREATE INDEX IF NOT EXISTS abuse_events_expires_idx ON abuse_events(expires_at);
