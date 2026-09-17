-- Allow each draft round to automatically approve and include member proposals.
ALTER TABLE voting_rounds ADD COLUMN auto_approve_proposals INTEGER NOT NULL DEFAULT 0;
