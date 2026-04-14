-- Workspace proposals table for adaptive workspace review pipeline
CREATE TABLE IF NOT EXISTS workspace_proposals (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  impact TEXT NOT NULL DEFAULT 'low',
  scope TEXT NOT NULL DEFAULT 'personal',
  status TEXT NOT NULL DEFAULT 'proposed',
  payload JSONB NOT NULL,
  previous_value JSONB,
  reviewed_by INTEGER,
  review_note TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_user_idx ON workspace_proposals(user_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON workspace_proposals(status);
