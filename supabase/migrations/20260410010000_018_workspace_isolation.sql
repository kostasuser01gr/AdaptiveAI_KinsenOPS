-- ============================================================================
-- Phase 4.3: Multi-Tenant Workspace Isolation
-- Migration: Create workspaces table + add workspace_id to all tenant tables
-- ============================================================================

-- 1. Workspaces master table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Seed the default workspace (existing rows will reference this)
INSERT INTO workspaces (id, name, slug, active)
VALUES ('default', 'Default Workspace', 'default', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Add workspace_id column to all tenant-scoped tables
-- Each ALTER uses NOT NULL DEFAULT 'default' so existing rows are back-filled.
-- The 4 tables that already have workspace_id are skipped.
-- The 4 pure-child tables (chat_messages, notification_reads, room_messages,
-- incident_summaries) and 1 platform-global table (role_capabilities) are skipped.

ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE vehicle_evidence ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE wash_queue ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE custom_actions ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE entity_rooms ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workspace_memory ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE digital_twin_snapshots ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE system_policies ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE module_registry ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workspace_config ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workspace_proposals ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE imports ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE downtime_events ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE kpi_snapshots ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE executive_briefings ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE integration_connectors ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE export_requests ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE user_station_assignments ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE user_capability_overrides ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE vehicle_events ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workshop_jobs ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';

-- 3. Indexes for workspace filtering (on high-traffic independently-queried tables)
CREATE INDEX IF NOT EXISTS users_ws_idx ON users (workspace_id);
CREATE INDEX IF NOT EXISTS stations_ws_idx ON stations (workspace_id);
CREATE INDEX IF NOT EXISTS vehicles_ws_idx ON vehicles (workspace_id);
CREATE INDEX IF NOT EXISTS wash_queue_ws_idx ON wash_queue (workspace_id);
CREATE INDEX IF NOT EXISTS shifts_ws_idx ON shifts (workspace_id);
CREATE INDEX IF NOT EXISTS notifications_ws_idx ON notifications (workspace_id);
CREATE INDEX IF NOT EXISTS automation_rules_ws_idx ON automation_rules (workspace_id);
CREATE INDEX IF NOT EXISTS audit_log_ws_idx ON audit_log (workspace_id);
CREATE INDEX IF NOT EXISTS entity_rooms_ws_idx ON entity_rooms (workspace_id);
CREATE INDEX IF NOT EXISTS activity_feed_ws_idx ON activity_feed (workspace_id);
CREATE INDEX IF NOT EXISTS incidents_ws_idx ON incidents (workspace_id);
CREATE INDEX IF NOT EXISTS reservations_ws_idx ON reservations (workspace_id);
CREATE INDEX IF NOT EXISTS repair_orders_ws_idx ON repair_orders (workspace_id);
CREATE INDEX IF NOT EXISTS downtime_events_ws_idx ON downtime_events (workspace_id);
CREATE INDEX IF NOT EXISTS kpi_snapshots_ws_idx ON kpi_snapshots (workspace_id);
CREATE INDEX IF NOT EXISTS anomalies_ws_idx ON anomalies (workspace_id);
CREATE INDEX IF NOT EXISTS executive_briefings_ws_idx ON executive_briefings (workspace_id);
CREATE INDEX IF NOT EXISTS integration_connectors_ws_idx ON integration_connectors (workspace_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_ws_idx ON knowledge_documents (workspace_id);
CREATE INDEX IF NOT EXISTS export_requests_ws_idx ON export_requests (workspace_id);
CREATE INDEX IF NOT EXISTS vehicle_events_ws_idx ON vehicle_events (workspace_id);
CREATE INDEX IF NOT EXISTS workshop_jobs_ws_idx ON workshop_jobs (workspace_id);

-- 4. workspace_config: update unique constraint to be per-workspace
-- (currently key is globally unique; should be unique per workspace)
DROP INDEX IF EXISTS workspace_config_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_config_ws_key_idx ON workspace_config (workspace_id, key);

-- 5. module_registry: update slug unique constraint to be per-workspace
DROP INDEX IF EXISTS module_registry_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS module_registry_ws_slug_idx ON module_registry (workspace_id, slug);

-- 6. kpi_definitions: update slug unique constraint to be per-workspace
DROP INDEX IF EXISTS kpi_definitions_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS kpi_definitions_ws_slug_idx ON kpi_definitions (workspace_id, slug);

-- 7. Enable RLS on workspaces table
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- 8. Convert remaining global unique constraints to per-workspace
-- users.username: was globally unique, now per-workspace
DROP INDEX IF EXISTS users_username_unique;
CREATE UNIQUE INDEX IF NOT EXISTS users_ws_username_idx ON users (workspace_id, username);

-- stations.code: was globally unique, now per-workspace
DROP INDEX IF EXISTS stations_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS stations_ws_code_idx ON stations (workspace_id, code);

-- vehicles.plate: was globally unique, now per-workspace
DROP INDEX IF EXISTS vehicles_plate_unique;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_ws_plate_idx ON vehicles (workspace_id, plate);

-- vehicle_events dedupe: was (source, external_event_id), now per-workspace
DROP INDEX IF EXISTS ve_external_dedup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS ve_external_dedup_idx ON vehicle_events (workspace_id, source, external_event_id);
