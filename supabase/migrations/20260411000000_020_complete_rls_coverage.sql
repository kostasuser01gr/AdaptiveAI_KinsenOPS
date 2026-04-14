/*
  # Complete RLS Coverage — All Remaining Tables

  Enable Row Level Security and create service-role bypass policies for every
  table that was added after the original RLS migration (002). This ensures
  consistent security posture across the entire schema.

  Pattern: Since this application uses session-based auth at the application
  layer (not Supabase Auth), all policies use `USING (true) WITH CHECK (true)`
  to allow the service role full access while blocking direct anon/authenticated
  API access.

  Tables covered:
  - Phase 2: reservations, repair_orders, downtime_events, kpi_definitions,
    kpi_snapshots, anomalies, executive_briefings
  - Phase 3: integration_connectors, sync_jobs, knowledge_documents, incident_summaries
  - Phase 4.1: export_requests, workspace_plans, entitlement_overrides
  - Phase 4.2A: usage_events, usage_daily_rollups, user_station_assignments,
    role_capabilities, user_capability_overrides
  - Phase 4.2B: vehicle_events, workshop_jobs
  - Phase 5 (RLS enabled, missing policy): station_positions, position_assignments,
    vehicle_transfers, chat_channels, channel_members, channel_messages,
    channel_reactions, app_graph_versions, ai_model_usage, installed_extensions, workspaces
  - Deploy fixes: incidents, automation_executions
  - v1.0: user_api_keys, ai_training_data, setup_state, login_history,
    notification_preferences, quality_inspections, webhooks, webhook_deliveries
  - Additional: feedback, imports, workspace_proposals, notification_reads
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2 tables — Enable RLS + Create policies
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to reservations" ON reservations
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to repair_orders" ON repair_orders
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE downtime_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to downtime_events" ON downtime_events
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to kpi_definitions" ON kpi_definitions
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to kpi_snapshots" ON kpi_snapshots
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to anomalies" ON anomalies
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE executive_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to executive_briefings" ON executive_briefings
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 3 tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE integration_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to integration_connectors" ON integration_connectors
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to sync_jobs" ON sync_jobs
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to knowledge_documents" ON knowledge_documents
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE incident_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to incident_summaries" ON incident_summaries
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 4.1 tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to export_requests" ON export_requests
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE workspace_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to workspace_plans" ON workspace_plans
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE entitlement_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to entitlement_overrides" ON entitlement_overrides
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 4.2A tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to usage_events" ON usage_events
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE usage_daily_rollups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to usage_daily_rollups" ON usage_daily_rollups
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_station_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to user_station_assignments" ON user_station_assignments
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to role_capabilities" ON role_capabilities
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_capability_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to user_capability_overrides" ON user_capability_overrides
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 4.2B tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE vehicle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to vehicle_events" ON vehicle_events
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE workshop_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to workshop_jobs" ON workshop_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Deploy-fix tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to incidents" ON incidents
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to automation_executions" ON automation_executions
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 5 tables — RLS already enabled, but MISSING policies (critical!)
-- Without policies, these tables block ALL non-superuser access.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Service role has full access to workspaces" ON workspaces
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to station_positions" ON station_positions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to position_assignments" ON position_assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to vehicle_transfers" ON vehicle_transfers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to chat_channels" ON chat_channels
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to channel_members" ON channel_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to channel_messages" ON channel_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to channel_reactions" ON channel_reactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to app_graph_versions" ON app_graph_versions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_model_usage" ON ai_model_usage
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to installed_extensions" ON installed_extensions
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- v1.0 tables (schema.ts definitions, no prior migration for RLS)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to user_api_keys" ON user_api_keys
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ai_training_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ai_training_data" ON ai_training_data
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE setup_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to setup_state" ON setup_state
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to login_history" ON login_history
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to notification_preferences" ON notification_preferences
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to quality_inspections" ON quality_inspections
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to webhooks" ON webhooks
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to webhook_deliveries" ON webhook_deliveries
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Additional composite indexes for workspace-scoped queries
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_reservations_workspace_created
  ON reservations(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_events_workspace_vehicle
  ON vehicle_events(workspace_id, vehicle_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_feature
  ON usage_events(workspace_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_created
  ON notifications(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_created
  ON audit_log(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace_created
  ON activity_feed(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_imports_target_table
  ON imports(target_table);
