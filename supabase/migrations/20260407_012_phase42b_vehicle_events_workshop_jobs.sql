-- Phase 4.2B: Vehicle events (telematics substrate) and workshop jobs

-- ─── Vehicle events (append-only normalized event log) ───
CREATE TABLE IF NOT EXISTS vehicle_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id INTEGER NOT NULL,
  connector_id INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  occurred_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  payload JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP,
  derived_action TEXT,
  derived_entity_type TEXT,
  derived_entity_id TEXT
);

CREATE INDEX IF NOT EXISTS ve_vehicle_time_idx ON vehicle_events (vehicle_id, occurred_at);
CREATE INDEX IF NOT EXISTS ve_vehicle_type_idx ON vehicle_events (vehicle_id, event_type);
CREATE INDEX IF NOT EXISTS ve_type_idx ON vehicle_events (event_type);
CREATE INDEX IF NOT EXISTS ve_connector_idx ON vehicle_events (connector_id);
CREATE INDEX IF NOT EXISTS ve_received_idx ON vehicle_events (received_at);
CREATE UNIQUE INDEX IF NOT EXISTS ve_external_dedup_idx ON vehicle_events (source, external_event_id);

-- ─── Workshop jobs (external workshop linkage) ───
CREATE TABLE IF NOT EXISTS workshop_jobs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repair_order_id INTEGER,
  connector_id INTEGER,
  external_job_id TEXT,
  workshop_name TEXT NOT NULL,
  external_status TEXT,
  normalized_status TEXT NOT NULL DEFAULT 'pending',
  estimate_amount REAL,
  invoice_ref TEXT,
  notes TEXT,
  metadata JSONB,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wj_repair_order_idx ON workshop_jobs (repair_order_id);
CREATE INDEX IF NOT EXISTS wj_connector_idx ON workshop_jobs (connector_id);
CREATE UNIQUE INDEX IF NOT EXISTS wj_external_dedup_idx ON workshop_jobs (connector_id, external_job_id);
CREATE INDEX IF NOT EXISTS wj_normalized_status_idx ON workshop_jobs (normalized_status);
