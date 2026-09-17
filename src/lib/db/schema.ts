import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const now = () => sql`(unixepoch())`;

export const adminPrincipals = sqliteTable(
  'admin_principals',
  {
    id: text('id').primaryKey(),
    accessIssuer: text('access_issuer').notNull(),
    accessSubject: text('access_subject').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('admin_principals_issuer_subject_uq').on(table.accessIssuer, table.accessSubject),
    index('admin_principals_status_idx').on(table.status),
  ],
);

export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
    codeHash: text('code_hash'),
    codeKeyVersion: integer('code_key_version').notNull().default(1),
    authVersion: integer('auth_version').notNull().default(1),
    codeRotatedAt: integer('code_rotated_at'),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
    disabledAt: integer('disabled_at'),
  },
  (table) => [
    uniqueIndex('members_code_hash_uq').on(table.codeHash),
    index('members_status_name_idx').on(table.status, table.displayName),
    check('members_status_ck', sql`${table.status} in ('active', 'disabled')`),
  ],
);

export const memberSessions = sqliteTable(
  'member_sessions',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    authVersion: integer('auth_version').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
    lastSeenAt: integer('last_seen_at').notNull().default(now()),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    uniqueIndex('member_sessions_token_hash_uq').on(table.tokenHash),
    index('member_sessions_member_idx').on(table.memberId),
    index('member_sessions_expires_idx').on(table.expiresAt),
    foreignKey({ columns: [table.memberId], foreignColumns: [members.id] }).onDelete('cascade'),
  ],
);

export const movies = sqliteTable(
  'movies',
  {
    id: text('id').primaryKey(),
    // Regional films can be entered without either external identifier.
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),
    manualKey: text('manual_key'),
    title: text('title').notNull(),
    originalTitle: text('original_title').notNull(),
    releaseDate: text('release_date'),
    releaseYear: integer('release_year'),
    posterPath: text('poster_path'),
    overview: text('overview'),
    runtimeMinutes: integer('runtime_minutes'),
    directorsJson: text('directors_json'),
    metadataLanguage: text('metadata_language').notNull().default('es-PE'),
    metadataFetchedAt: integer('metadata_fetched_at').notNull().default(now()),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('movies_tmdb_id_uq').on(table.tmdbId),
    uniqueIndex('movies_imdb_id_uq').on(table.imdbId),
    uniqueIndex('movies_manual_key_uq').on(table.manualKey),
    check('movies_runtime_ck', sql`${table.runtimeMinutes} is null or ${table.runtimeMinutes} > 0`),
  ],
);

export const proposals = sqliteTable(
  'proposals',
  {
    id: text('id').primaryKey(),
    // Nullable only for legacy proposals created before proposals were tied to a round.
    roundId: text('round_id'),
    movieId: text('movie_id').notNull(),
    memberId: text('member_id').notNull(),
    justification: text('justification'),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at'),
    reviewReason: text('review_reason'),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('proposals_round_movie_uq').on(table.roundId, table.movieId),
    index('proposals_round_status_idx').on(table.roundId, table.status, table.createdAt),
    index('proposals_status_created_idx').on(table.status, table.createdAt),
    index('proposals_member_created_idx').on(table.memberId, table.createdAt),
    foreignKey({ columns: [table.movieId], foreignColumns: [movies.id] }),
    foreignKey({ columns: [table.memberId], foreignColumns: [members.id] }),
    foreignKey({ columns: [table.reviewedBy], foreignColumns: [adminPrincipals.id] }),
    check('proposals_status_ck', sql`${table.status} in ('pending', 'approved', 'rejected')`),
  ],
);

export const votingRounds = sqliteTable(
  'voting_rounds',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['draft', 'published', 'closed', 'cancelled'] }).notNull().default('draft'),
    audience: text('audience', { enum: ['members', 'members_and_public'] }).notNull().default('members'),
    startsAt: integer('starts_at').notNull(),
    endsAt: integer('ends_at').notNull(),
    publishedAt: integer('published_at'),
    closedAt: integer('closed_at'),
    publicKeyVersion: integer('public_key_version').notNull().default(1),
    resultsFinalizedAt: integer('results_finalized_at'),
    resultsPublishedAt: integer('results_published_at'),
    autoApproveProposals: integer('auto_approve_proposals').notNull().default(0),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('voting_rounds_slug_uq').on(table.slug),
    index('voting_rounds_status_dates_idx').on(table.status, table.startsAt, table.endsAt),
    index('voting_rounds_audience_status_idx').on(table.audience, table.status),
    foreignKey({ columns: [table.createdBy], foreignColumns: [adminPrincipals.id] }),
    foreignKey({ columns: [table.updatedBy], foreignColumns: [adminPrincipals.id] }),
    check('voting_rounds_dates_ck', sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const roundMovies = sqliteTable(
  'round_movies',
  {
    roundId: text('round_id').notNull(),
    movieId: text('movie_id').notNull(),
    addedBy: text('added_by').notNull(),
    addedAt: integer('added_at').notNull().default(now()),
    position: integer('position').notNull(),
    selectedAt: integer('selected_at'),
    selectedBy: text('selected_by'),
    selectionReason: text('selection_reason'),
  },
  (table) => [
    primaryKey({ columns: [table.roundId, table.movieId] }),
    index('round_movies_position_idx').on(table.roundId, table.position),
    foreignKey({ columns: [table.roundId], foreignColumns: [votingRounds.id] }),
    foreignKey({ columns: [table.movieId], foreignColumns: [movies.id] }),
    foreignKey({ columns: [table.addedBy], foreignColumns: [adminPrincipals.id] }),
    foreignKey({ columns: [table.selectedBy], foreignColumns: [adminPrincipals.id] }),
  ],
);

export const memberVotes = sqliteTable(
  'member_votes',
  {
    id: text('id').primaryKey(),
    roundId: text('round_id').notNull(),
    memberId: text('member_id').notNull(),
    movieId: text('movie_id').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('member_votes_round_member_uq').on(table.roundId, table.memberId),
    index('member_votes_round_movie_idx').on(table.roundId, table.movieId),
    foreignKey({ columns: [table.roundId, table.movieId], foreignColumns: [roundMovies.roundId, roundMovies.movieId] }),
    foreignKey({ columns: [table.memberId], foreignColumns: [members.id] }),
  ],
);

export const publicVotes = sqliteTable(
  'public_votes',
  {
    id: text('id').primaryKey(),
    roundId: text('round_id').notNull(),
    voterKey: text('voter_key').notNull(),
    movieId: text('movie_id').notNull(),
    status: text('status', { enum: ['counted', 'excluded'] }).notNull().default('counted'),
    exclusionReason: text('exclusion_reason'),
    flaggedAt: integer('flagged_at'),
    flagReason: text('flag_reason'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at'),
    reviewReason: text('review_reason'),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('public_votes_round_voter_uq').on(table.roundId, table.voterKey),
    index('public_votes_round_movie_status_idx').on(table.roundId, table.movieId, table.status),
    index('public_votes_round_flagged_idx').on(table.roundId, table.flaggedAt),
    foreignKey({ columns: [table.roundId, table.movieId], foreignColumns: [roundMovies.roundId, roundMovies.movieId] }),
    foreignKey({ columns: [table.reviewedBy], foreignColumns: [adminPrincipals.id] }),
    check('public_votes_status_ck', sql`${table.status} in ('counted', 'excluded')`),
  ],
);

export const roundMovieResults = sqliteTable(
  'round_movie_results',
  {
    roundId: text('round_id').notNull(),
    movieId: text('movie_id').notNull(),
    memberCount: integer('member_count').notNull().default(0),
    publicReceivedCount: integer('public_received_count').notNull().default(0),
    publicCountedCount: integer('public_counted_count').notNull().default(0),
    publicAbuseExcludedCount: integer('public_abuse_excluded_count').notNull().default(0),
    publicConvertedCount: integer('public_converted_count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.roundId, table.movieId] }),
    foreignKey({ columns: [table.roundId, table.movieId], foreignColumns: [roundMovies.roundId, roundMovies.movieId] }),
    check('round_movie_results_counts_ck', sql`${table.memberCount} >= 0 and ${table.publicReceivedCount} >= 0 and ${table.publicCountedCount} >= 0`),
  ],
);

export const screenings = sqliteTable(
  'screenings',
  {
    id: text('id').primaryKey(),
    movieId: text('movie_id').notNull(),
    sourceRoundId: text('source_round_id'),
    status: text('status', { enum: ['scheduled', 'screened', 'cancelled'] }).notNull().default('scheduled'),
    scheduledAt: integer('scheduled_at').notNull(),
    screenedAt: integer('screened_at'),
    venue: text('venue'),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
    updatedAt: integer('updated_at').notNull().default(now()),
  },
  (table) => [
    uniqueIndex('screenings_movie_date_uq').on(table.movieId, table.scheduledAt),
    index('screenings_status_date_idx').on(table.status, table.scheduledAt),
    foreignKey({ columns: [table.movieId], foreignColumns: [movies.id] }),
    foreignKey({ columns: [table.sourceRoundId, table.movieId], foreignColumns: [roundMovies.roundId, roundMovies.movieId] }),
    foreignKey({ columns: [table.createdBy], foreignColumns: [adminPrincipals.id] }),
    foreignKey({ columns: [table.updatedBy], foreignColumns: [adminPrincipals.id] }),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id'),
    actorType: text('actor_type', { enum: ['admin', 'system'] }).notNull(),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    reason: text('reason'),
    safeMetadataJson: text('safe_metadata_json'),
    requestId: text('request_id').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
  },
  (table) => [
    index('audit_events_entity_idx').on(table.entityType, table.entityId, table.createdAt),
    index('audit_events_created_idx').on(table.createdAt),
    foreignKey({ columns: [table.adminId], foreignColumns: [adminPrincipals.id] }),
  ],
);

export const abuseEvents = sqliteTable(
  'abuse_events',
  {
    id: text('id').primaryKey(),
    roundId: text('round_id'),
    publicVoteId: text('public_vote_id'),
    signalType: text('signal_type').notNull(),
    actionTaken: text('action_taken').notNull(),
    ipHmac: text('ip_hmac'),
    ipKeyPeriod: text('ip_key_period'),
    requestId: text('request_id').notNull(),
    createdAt: integer('created_at').notNull().default(now()),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('abuse_events_round_created_idx').on(table.roundId, table.createdAt),
    index('abuse_events_ip_created_idx').on(table.ipHmac, table.createdAt),
    index('abuse_events_expires_idx').on(table.expiresAt),
    foreignKey({ columns: [table.roundId], foreignColumns: [votingRounds.id] }),
    foreignKey({ columns: [table.publicVoteId], foreignColumns: [publicVotes.id] }),
  ],
);

export type Member = typeof members.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type VotingRound = typeof votingRounds.$inferSelect;
