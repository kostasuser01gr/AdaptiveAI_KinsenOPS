-- ============================================================================
-- Phase 4.3 Deploy Fixes
-- 1. Create missing tables: incidents, automation_executions
-- 2. Fix workspace-scoped unique constraint DROP names (_unique → _key)
-- 3. Add missing column: wash_queue.sla_deadline
-- 4. Add missing columns on imports table
-- 5. Create user_sessions table for connect-pg-simple
-- ============================================================================

-- ─── 1. Create incidents table (was missing from all prior migrations) ───

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'general',
  reported_by INTEGER NOT NULL,
  assigned_to INTEGER,
  vehicle_id INTEGER,
  station_id INTEGER,
  room_id INTEGER,
  metadata JSONB,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status);
CREATE INDEX IF NOT EXISTS incidents_severity_idx ON incidents (severity);
CREATE INDEX IF NOT EXISTS incidents_vehicle_idx ON incidents (vehicle_id);
CREATE INDEX IF NOT EXISTS incidents_station_idx ON incidents (station_id);
CREATE INDEX IF NOT EXISTS incidents_assigned_idx ON incidents (assigned_to);
CREATE INDEX IF NOT EXISTS incidents_created_idx ON incidents (created_at);
CREATE INDEX IF NOT EXISTS incidents_ws_idx ON incidents (workspace_id);

-- ─── 2. Create automation_executions table (was missing from all prior migrations) ───

CREATE TABLE IF NOT EXISTS automation_executions (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  rule_id INTEGER NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_entity_type TEXT,
  trigger_entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_exec_rule_idx ON automation_executions (rule_id);
CREATE INDEX IF NOT EXISTS automation_exec_status_idx ON automation_executions (status);
CREATE INDEX IF NOT EXISTS automation_exec_created_idx ON automation_executions (created_at);

-- ─── 3. Fix workspace-scoped unique constraint drops ───
-- PostgreSQL auto-names inline UNIQUE constraints as <table>_<column>_key.
-- The prior migration used _unique suffix which was a no-op.
-- Use ALTER TABLE DROP CONSTRAINT (works for constraint-backed indexes).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_code_key;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_key;
ALTER TABLE module_registry DROP CONSTRAINT IF EXISTS module_registry_slug_key;
ALTER TABLE workspace_config DROP CONSTRAINT IF EXISTS workspace_config_key_key;
ALTER TABLE kpi_definitions DROP CONSTRAINT IF EXISTS kpi_definitions_slug_key;

-- Re-create the per-workspace unique indexes (idempotent, already exist from prior migration)
CREATE UNIQUE INDEX IF NOT EXISTS users_ws_username_idx ON users (workspace_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS stations_ws_code_idx ON stations (workspace_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_ws_plate_idx ON vehicles (workspace_id, plate);
CREATE UNIQUE INDEX IF NOT EXISTS module_registry_ws_slug_idx ON module_registry (workspace_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_config_ws_key_idx ON workspace_config (workspace_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_definitions_ws_slug_idx ON kpi_definitions (workspace_id, slug);

-- ─── 4. Add missing wash_queue.sla_deadline column ───

ALTER TABLE wash_queue ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP;

-- ─── 5. Add missing columns on imports table ───

ALTER TABLE imports ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS target_table TEXT NOT NULL DEFAULT 'vehicles';
ALTER TABLE imports ADD COLUMN IF NOT EXISTS applied_count INTEGER;

-- ─── 6. Create user_sessions table for connect-pg-simple ───

CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions (expire);
