-- Phase 4.1B: Workspace plans & entitlement overrides
CREATE TABLE IF NOT EXISTS workspace_plans (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id text NOT NULL UNIQUE DEFAULT 'default',
  plan text NOT NULL DEFAULT 'core',
  label text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlement_overrides (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id text NOT NULL DEFAULT 'default',
  feature text NOT NULL,
  enabled boolean NOT NULL,
  reason text,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ent_override_ws_feature_idx ON entitlement_overrides(workspace_id, feature);

-- Seed default workspace plan
INSERT INTO workspace_plans (workspace_id, plan, label) VALUES ('default', 'core', 'Default Workspace')
ON CONFLICT (workspace_id) DO NOTHING;
