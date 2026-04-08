-- Phase 4.2A: Usage metering, capability permissions, multi-station assignments

-- ─── Usage events (append-only raw event log) ───
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  feature TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  idempotency_key TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_evt_ws_feature_idx ON usage_events (workspace_id, feature);
CREATE INDEX IF NOT EXISTS usage_evt_created_idx ON usage_events (created_at);
CREATE INDEX IF NOT EXISTS usage_evt_user_idx ON usage_events (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS usage_evt_idempotency_idx ON usage_events (idempotency_key);

-- ─── Usage daily rollups (materialized for reporting) ───
CREATE TABLE IF NOT EXISTS usage_daily_rollups (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  feature TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_rollup_ws_feature_date_idx ON usage_daily_rollups (workspace_id, feature, date);
CREATE INDEX IF NOT EXISTS usage_rollup_date_idx ON usage_daily_rollups (date);

-- ─── User station assignments (multi-station) ───
CREATE TABLE IF NOT EXISTS user_station_assignments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_by INTEGER,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_station_assign_idx ON user_station_assignments (user_id, station_id);
CREATE INDEX IF NOT EXISTS user_station_user_idx ON user_station_assignments (user_id);
CREATE INDEX IF NOT EXISTS user_station_station_idx ON user_station_assignments (station_id);

-- ─── Role capabilities (role → capability default grants) ───
CREATE TABLE IF NOT EXISTS role_capabilities (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role TEXT NOT NULL,
  capability TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_cap_role_cap_idx ON role_capabilities (role, capability);

-- ─── User capability overrides (sparse per-user) ───
CREATE TABLE IF NOT EXISTS user_capability_overrides (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL,
  capability TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  reason TEXT,
  granted_by INTEGER,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_cap_user_cap_idx ON user_capability_overrides (user_id, capability);
CREATE INDEX IF NOT EXISTS user_cap_user_idx ON user_capability_overrides (user_id);

-- ─── Seed default role capabilities ───
-- Admin gets everything
INSERT INTO role_capabilities (role, capability) VALUES
  ('admin', 'trust_export'),
  ('admin', 'export_approve'),
  ('admin', 'connector_manage'),
  ('admin', 'entitlement_manage'),
  ('admin', 'automation_execute'),
  ('admin', 'ai_draft'),
  ('admin', 'briefing_generate'),
  ('admin', 'incident_resolve'),
  ('admin', 'document_ingest')
ON CONFLICT DO NOTHING;

-- Supervisor gets operational capabilities
INSERT INTO role_capabilities (role, capability) VALUES
  ('supervisor', 'export_approve'),
  ('supervisor', 'automation_execute'),
  ('supervisor', 'ai_draft'),
  ('supervisor', 'briefing_generate'),
  ('supervisor', 'incident_resolve'),
  ('supervisor', 'document_ingest')
ON CONFLICT DO NOTHING;

-- Coordinator gets limited capabilities
INSERT INTO role_capabilities (role, capability) VALUES
  ('coordinator', 'automation_execute'),
  ('coordinator', 'incident_resolve'),
  ('coordinator', 'document_ingest')
ON CONFLICT DO NOTHING;
