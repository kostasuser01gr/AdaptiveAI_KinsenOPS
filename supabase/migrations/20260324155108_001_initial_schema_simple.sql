/*
  # Initial Database Schema for Car Rental Operations Platform

  1. New Tables
    - All tables from the application schema with proper structure
    
  2. Security
    - Tables created with proper constraints
    - Indexes added for performance
    - Note: This application uses custom session-based authentication
      handled at the application layer, not Supabase Auth

  3. Important Notes
    - Authentication is handled via Express sessions with PostgreSQL storage
    - Authorization enforced in application middleware
    - Database serves as storage layer without RLS (app-level security model)
*/

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'agent',
  station text,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'dark'
);

CREATE TABLE IF NOT EXISTS stations (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  timezone text NOT NULL DEFAULT 'Europe/Athens',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'personal',
  category text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  plate text NOT NULL UNIQUE,
  model text NOT NULL,
  category text NOT NULL DEFAULT 'B',
  station_id integer REFERENCES stations(id),
  status text NOT NULL DEFAULT 'ready',
  sla text NOT NULL DEFAULT 'normal',
  mileage integer,
  fuel_level integer,
  next_booking text,
  timer_info text,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS vehicle_evidence (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id integer NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text,
  caption text,
  severity text,
  source text NOT NULL DEFAULT 'staff',
  reservation_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wash_queue (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_plate text NOT NULL,
  wash_type text NOT NULL DEFAULT 'Quick Wash',
  priority text NOT NULL DEFAULT 'Normal',
  assigned_to text,
  status text NOT NULL DEFAULT 'pending',
  sla_info text,
  station_id integer REFERENCES stations(id),
  proof_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS shifts (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  employee_name text NOT NULL,
  employee_role text NOT NULL,
  week_start text NOT NULL,
  schedule jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  station_id integer REFERENCES stations(id),
  fairness_score real,
  fatigue_score real,
  published_by integer REFERENCES users(id),
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS shift_requests (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id integer REFERENCES shifts(id),
  request_type text NOT NULL,
  details jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by integer REFERENCES users(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS notifications (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type text NOT NULL DEFAULT 'system',
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  conversation_id integer NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_actions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'Zap',
  target text NOT NULL,
  placement text NOT NULL DEFAULT 'header',
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  description text,
  trigger text NOT NULL,
  conditions jsonb,
  actions jsonb,
  created_by integer NOT NULL REFERENCES users(id),
  scope text NOT NULL DEFAULT 'shared',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  last_triggered timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entity_rooms (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_messages (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  room_id integer NOT NULL REFERENCES entity_rooms(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id),
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  type text NOT NULL DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memory (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  category text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  confidence real NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  station_id integer REFERENCES stations(id),
  snapshot_type text NOT NULL DEFAULT 'hourly',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_policies (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  category text NOT NULL,
  rule jsonb NOT NULL,
  enforcement text NOT NULL DEFAULT 'warn',
  scope text NOT NULL DEFAULT 'global',
  active boolean NOT NULL DEFAULT true,
  created_by integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id integer REFERENCES users(id),
  actor_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_label text,
  station_id integer REFERENCES stations(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_registry (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'operations',
  icon text NOT NULL DEFAULT 'Box',
  route text NOT NULL,
  required_role text NOT NULL DEFAULT 'agent',
  enabled boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  config jsonb
);

CREATE TABLE IF NOT EXISTS workspace_config (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_by integer REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_attachments (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  url text,
  uploaded_by integer REFERENCES users(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_station ON vehicles(station_id);
CREATE INDEX IF NOT EXISTS idx_shifts_week ON shifts(week_start);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_actions_user ON custom_actions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_shift_requests_user ON shift_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_status ON shift_requests(status);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_station ON activity_feed(station_id);