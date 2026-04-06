/*
  # Add Missing Foreign Key Indexes and Enable RLS

  1. Performance Improvements
    - Add indexes for all foreign key columns to optimize JOIN queries
    - Covers 14 unindexed foreign key relationships

  2. Security Enhancements
    - Enable Row Level Security (RLS) on all tables
    - Add service role bypass policies for application-layer authentication
    - Protect sensitive data (passwords) from direct API access

  3. Important Notes
    - This application uses session-based authentication at the application layer
    - RLS is enabled with service role bypass to allow the application to manage security
    - Direct API access is restricted; all data access goes through the application
*/

-- Add missing indexes for foreign key columns
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_station_id ON activity_feed(station_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_station_id ON digital_twin_snapshots(station_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by ON file_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON file_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_user_id ON room_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_reviewed_by ON shift_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_shift_requests_shift_id ON shift_requests(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_published_by ON shifts(published_by);
CREATE INDEX IF NOT EXISTS idx_shifts_station_id ON shifts(station_id);
CREATE INDEX IF NOT EXISTS idx_system_policies_created_by ON system_policies(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicle_evidence_vehicle_id ON vehicle_evidence(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_wash_queue_station_id ON wash_queue(station_id);
CREATE INDEX IF NOT EXISTS idx_workspace_config_updated_by ON workspace_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_actions_user_id ON custom_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_twin_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

-- Create bypass policies for service role (application-layer authentication)
-- This allows the application backend to access all data while blocking direct client access

-- Users table - block direct access to passwords
CREATE POLICY "Service role has full access to users" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to user_preferences" ON user_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to stations" ON stations
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to vehicles" ON vehicles
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to vehicle_evidence" ON vehicle_evidence
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to wash_queue" ON wash_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to shifts" ON shifts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to shift_requests" ON shift_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to notifications" ON notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to chat_conversations" ON chat_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to chat_messages" ON chat_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to custom_actions" ON custom_actions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to automation_rules" ON automation_rules
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to audit_log" ON audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to entity_rooms" ON entity_rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to room_messages" ON room_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to workspace_memory" ON workspace_memory
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to digital_twin_snapshots" ON digital_twin_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to system_policies" ON system_policies
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to activity_feed" ON activity_feed
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to module_registry" ON module_registry
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to workspace_config" ON workspace_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to file_attachments" ON file_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Block all anon access (no direct API access allowed)
-- The application backend uses service role and handles all authentication

-- Additional security: Revoke public schema privileges from anon role
-- This ensures no direct table access bypassing RLS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant only to authenticated role (which won't be used, but safer than public)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;