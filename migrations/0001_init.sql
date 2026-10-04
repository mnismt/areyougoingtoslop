CREATE TABLE score_jobs (job_id TEXT PRIMARY KEY, username_key TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed')), snapshot TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX score_jobs_one_active_per_user ON score_jobs (username_key) WHERE status IN ('queued','running');
CREATE INDEX score_jobs_updated_at ON score_jobs (updated_at);
CREATE TABLE leaderboard (username_key TEXT PRIMARY KEY, username TEXT NOT NULL, slop_score INTEGER NOT NULL, tier TEXT NOT NULL, tier_tagline TEXT, confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')), last_scored_at TEXT NOT NULL);
CREATE INDEX leaderboard_rank ON leaderboard (slop_score DESC, last_scored_at DESC, username);
CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, received_at TEXT NOT NULL, ip TEXT);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
