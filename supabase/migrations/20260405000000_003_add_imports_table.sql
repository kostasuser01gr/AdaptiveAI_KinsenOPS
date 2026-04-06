-- Chunk 3: imports table for data import pipeline
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading',
  uploaded_by INTEGER NOT NULL,
  records INTEGER NOT NULL DEFAULT 0,
  columns INTEGER NOT NULL DEFAULT 0,
  mappings JSONB,
  diffs JSONB,
  file_type TEXT NOT NULL DEFAULT 'csv',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS imports_uploaded_by_idx ON imports (uploaded_by);
CREATE INDEX IF NOT EXISTS imports_status_idx ON imports (status);
