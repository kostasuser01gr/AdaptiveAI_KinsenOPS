-- Phase 5: Fleet Positions, Vehicle Transfers, Chat Channels, App Graph, AI Usage, Extensions
-- Migration 005

-- ─── STATION POSITIONS ───
CREATE TABLE IF NOT EXISTS station_positions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  station_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'parking',
  capacity INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS station_pos_ws_station_code_idx ON station_positions (workspace_id, station_id, code);
CREATE INDEX IF NOT EXISTS station_pos_station_idx ON station_positions (station_id);
CREATE INDEX IF NOT EXISTS station_pos_type_idx ON station_positions (type);

-- ─── POSITION ASSIGNMENTS ───
CREATE TABLE IF NOT EXISTS position_assignments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  position_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pos_assign_position_idx ON position_assignments (position_id);
CREATE INDEX IF NOT EXISTS pos_assign_vehicle_idx ON position_assignments (vehicle_id);
CREATE INDEX IF NOT EXISTS pos_assign_active_idx ON position_assignments (position_id, released_at);

-- ─── VEHICLE TRANSFERS ───
CREATE TABLE IF NOT EXISTS vehicle_transfers (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  vehicle_id INTEGER NOT NULL,
  from_station_id INTEGER NOT NULL,
  to_station_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_by INTEGER NOT NULL,
  driver_name TEXT,
  reason TEXT,
  notes TEXT,
  estimated_arrival TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transfers_vehicle_idx ON vehicle_transfers (vehicle_id);
CREATE INDEX IF NOT EXISTS transfers_from_idx ON vehicle_transfers (from_station_id);
CREATE INDEX IF NOT EXISTS transfers_to_idx ON vehicle_transfers (to_station_id);
CREATE INDEX IF NOT EXISTS transfers_status_idx ON vehicle_transfers (status);
CREATE INDEX IF NOT EXISTS transfers_created_idx ON vehicle_transfers (created_at);

-- ─── CHAT CHANNELS ───
CREATE TABLE IF NOT EXISTS chat_channels (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'public',
  station_id INTEGER,
  created_by INTEGER NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS channels_ws_slug_idx ON chat_channels (workspace_id, slug);
CREATE INDEX IF NOT EXISTS channels_type_idx ON chat_channels (type);
CREATE INDEX IF NOT EXISTS channels_station_idx ON chat_channels (station_id);

-- ─── CHANNEL MEMBERS ───
CREATE TABLE IF NOT EXISTS channel_members (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_member_uniq_idx ON channel_members (channel_id, user_id);
CREATE INDEX IF NOT EXISTS channel_member_user_idx ON channel_members (user_id);

-- ─── CHANNEL MESSAGES ───
CREATE TABLE IF NOT EXISTS channel_messages (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  reply_to_id INTEGER,
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ch_msg_channel_idx ON channel_messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS ch_msg_user_idx ON channel_messages (user_id);
CREATE INDEX IF NOT EXISTS ch_msg_reply_idx ON channel_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS ch_msg_pinned_idx ON channel_messages (channel_id, pinned);

-- ─── CHANNEL REACTIONS ───
CREATE TABLE IF NOT EXISTS channel_reactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ch_reaction_uniq_idx ON channel_reactions (message_id, user_id, emoji);
CREATE INDEX IF NOT EXISTS ch_reaction_message_idx ON channel_reactions (message_id);

-- ─── APP GRAPH VERSIONS ───
CREATE TABLE IF NOT EXISTS app_graph_versions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  version INTEGER NOT NULL,
  label TEXT,
  graph JSONB NOT NULL,
  diff JSONB,
  created_by INTEGER NOT NULL,
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_graph_ws_version_idx ON app_graph_versions (workspace_id, version);
CREATE INDEX IF NOT EXISTS app_graph_created_idx ON app_graph_versions (created_at);

-- ─── AI MODEL USAGE ───
CREATE TABLE IF NOT EXISTS ai_model_usage (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  user_id INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents REAL,
  latency_ms INTEGER,
  feature TEXT NOT NULL DEFAULT 'chat',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_usage_ws_provider_idx ON ai_model_usage (workspace_id, provider);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_model_usage (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON ai_model_usage (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx ON ai_model_usage (feature);

-- ─── INSTALLED EXTENSIONS ───
CREATE TABLE IF NOT EXISTS installed_extensions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  author TEXT,
  manifest JSONB NOT NULL,
  permissions JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB,
  installed_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ext_ws_slug_idx ON installed_extensions (workspace_id, slug);
CREATE INDEX IF NOT EXISTS ext_enabled_idx ON installed_extensions (enabled);

-- ─── RLS POLICIES ───
ALTER TABLE station_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_graph_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_extensions ENABLE ROW LEVEL SECURITY;
