-- Q-Compare D1 schema (Cloudflare D1)
-- The v1 frontend runs fully client-side with localStorage.
-- This schema provides an optional server-side persistence layer
-- for experiments, datasets, benchmark runs and reports via the Worker API.

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,          -- full Experiment JSON
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  qai REAL,
  recommended_model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiments_updated ON experiments (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_category ON experiments (category);

CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  benchmark_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  qai REAL,
  best_model TEXT,
  ran_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  format TEXT NOT NULL,           -- markdown | json | csv
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);