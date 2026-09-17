-- Proposals belong to the voting round where a member submitted them. Movies
-- may also be entered manually when TMDB has no matching record.
PRAGMA foreign_keys = OFF;

CREATE TABLE movies_new (
  id TEXT PRIMARY KEY NOT NULL,
  tmdb_id INTEGER,
  imdb_id TEXT,
  manual_key TEXT,
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

INSERT INTO movies_new (
  id, tmdb_id, imdb_id, title, original_title, release_date, release_year,
  poster_path, overview, runtime_minutes, directors_json, metadata_language,
  metadata_fetched_at, created_at, updated_at
)
SELECT id, tmdb_id, imdb_id, title, original_title, release_date, release_year,
  poster_path, overview, runtime_minutes, directors_json, metadata_language,
  metadata_fetched_at, created_at, updated_at
FROM movies;

DROP TABLE movies;
ALTER TABLE movies_new RENAME TO movies;
CREATE UNIQUE INDEX movies_tmdb_id_uq ON movies(tmdb_id);
CREATE UNIQUE INDEX movies_imdb_id_uq ON movies(imdb_id);
CREATE UNIQUE INDEX movies_manual_key_uq ON movies(manual_key);

CREATE TABLE proposals_new (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT REFERENCES voting_rounds(id),
  movie_id TEXT NOT NULL REFERENCES movies(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES admin_principals(id),
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO proposals_new (
  id, round_id, movie_id, member_id, justification, status, reviewed_by,
  reviewed_at, review_reason, created_at, updated_at
)
SELECT id, NULL, movie_id, member_id, justification, status, reviewed_by,
  reviewed_at, review_reason, created_at, updated_at
FROM proposals;

DROP TABLE proposals;
ALTER TABLE proposals_new RENAME TO proposals;
CREATE UNIQUE INDEX proposals_round_movie_uq ON proposals(round_id, movie_id);
CREATE INDEX proposals_status_created_idx ON proposals(status, created_at);
CREATE INDEX proposals_member_created_idx ON proposals(member_id, created_at);
CREATE INDEX proposals_round_status_idx ON proposals(round_id, status, created_at);

PRAGMA foreign_keys = ON;
