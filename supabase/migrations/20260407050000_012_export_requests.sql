-- Phase 4.1A: Export requests table
CREATE TABLE IF NOT EXISTS export_requests (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  export_type text NOT NULL,
  format text NOT NULL DEFAULT 'csv',
  scope text,
  filters jsonb,
  status text NOT NULL DEFAULT 'requested',
  requested_by integer NOT NULL,
  approved_by integer,
  approval_note text,
  storage_key text,
  filename text,
  mime_type text,
  row_count integer,
  error text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_req_status_idx ON export_requests(status);
CREATE INDEX IF NOT EXISTS export_req_requested_by_idx ON export_requests(requested_by);
CREATE INDEX IF NOT EXISTS export_req_type_idx ON export_requests(export_type);
CREATE INDEX IF NOT EXISTS export_req_expires_idx ON export_requests(expires_at);
