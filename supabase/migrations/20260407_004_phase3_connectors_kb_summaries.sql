-- Phase 3: Integration connectors, sync jobs, knowledge documents, incident summaries
-- Additive migration — no destructive changes to existing tables

-- ─── INTEGRATION CONNECTORS ───
CREATE TABLE IF NOT EXISTS integration_connectors (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS connectors_type_idx ON integration_connectors(type);
CREATE INDEX IF NOT EXISTS connectors_status_idx ON integration_connectors(status);

-- ─── SYNC JOBS ───
CREATE TABLE IF NOT EXISTS sync_jobs (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  connector_id INTEGER NOT NULL REFERENCES integration_connectors(id),
  status TEXT NOT NULL DEFAULT 'pending',
  direction TEXT NOT NULL DEFAULT 'inbound',
  entity_type TEXT NOT NULL DEFAULT 'reservation',
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  error_log JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sync_jobs_connector_idx ON sync_jobs(connector_id);
CREATE INDEX IF NOT EXISTS sync_jobs_status_idx ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS sync_jobs_created_idx ON sync_jobs(created_at);

-- ─── KNOWLEDGE DOCUMENTS ───
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags JSONB,
  uploaded_by INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kb_docs_category_idx ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS kb_docs_uploaded_idx ON knowledge_documents(uploaded_by);

-- ─── INCIDENT SUMMARIES ───
CREATE TABLE IF NOT EXISTS incident_summaries (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  incident_id INTEGER NOT NULL,
  summary TEXT NOT NULL,
  data_sources_used JSONB NOT NULL DEFAULT '[]',
  kpi_impact JSONB,
  generated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_summaries_incident_idx ON incident_summaries(incident_id);
