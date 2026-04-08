-- Phase 2: Reservations, Repair Orders, Downtime Events, KPI Engine, Anomaly Detection, Executive Briefings

-- ─── RESERVATIONS ───
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id INTEGER,
  station_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'manual',
  pickup_date TIMESTAMP NOT NULL,
  return_date TIMESTAMP NOT NULL,
  actual_pickup TIMESTAMP,
  actual_return TIMESTAMP,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reservations_vehicle_idx ON reservations(vehicle_id);
CREATE INDEX IF NOT EXISTS reservations_station_idx ON reservations(station_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations(status);
CREATE INDEX IF NOT EXISTS reservations_pickup_idx ON reservations(pickup_date);
CREATE INDEX IF NOT EXISTS reservations_return_idx ON reservations(return_date);

-- ─── REPAIR ORDERS ───
CREATE TABLE IF NOT EXISTS repair_orders (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id INTEGER NOT NULL,
  incident_id INTEGER,
  station_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to INTEGER,
  estimated_cost REAL,
  actual_cost REAL,
  estimated_completion TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_orders_vehicle_idx ON repair_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS repair_orders_incident_idx ON repair_orders(incident_id);
CREATE INDEX IF NOT EXISTS repair_orders_status_idx ON repair_orders(status);
CREATE INDEX IF NOT EXISTS repair_orders_station_idx ON repair_orders(station_id);

-- ─── DOWNTIME EVENTS ───
CREATE TABLE IF NOT EXISTS downtime_events (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  incident_id INTEGER,
  repair_order_id INTEGER,
  station_id INTEGER,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS downtime_vehicle_idx ON downtime_events(vehicle_id);
CREATE INDEX IF NOT EXISTS downtime_reason_idx ON downtime_events(reason);
CREATE INDEX IF NOT EXISTS downtime_started_idx ON downtime_events(started_at);

-- ─── KPI DEFINITIONS ───
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'operations',
  unit TEXT NOT NULL DEFAULT 'count',
  target_value REAL,
  warning_threshold REAL,
  critical_threshold REAL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── KPI SNAPSHOTS ───
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  kpi_slug TEXT NOT NULL,
  value REAL NOT NULL,
  date TEXT NOT NULL,
  station_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpi_snapshots_slug_idx ON kpi_snapshots(kpi_slug);
CREATE INDEX IF NOT EXISTS kpi_snapshots_date_idx ON kpi_snapshots(date);
CREATE INDEX IF NOT EXISTS kpi_snapshots_station_idx ON kpi_snapshots(station_id);

-- ─── ANOMALIES ───
CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  station_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_by INTEGER,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS anomalies_type_idx ON anomalies(type);
CREATE INDEX IF NOT EXISTS anomalies_status_idx ON anomalies(status);
CREATE INDEX IF NOT EXISTS anomalies_detected_idx ON anomalies(detected_at);

-- ─── EXECUTIVE BRIEFINGS ───
CREATE TABLE IF NOT EXISTS executive_briefings (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  date TEXT NOT NULL,
  kpi_summary JSONB NOT NULL DEFAULT '{}',
  anomaly_summary JSONB,
  recommendations JSONB,
  generated_by TEXT NOT NULL DEFAULT 'system',
  station_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
