import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, address TEXT,
      timezone TEXT NOT NULL DEFAULT 'Europe/Athens', active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS vehicle_evidence (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      vehicle_id INTEGER NOT NULL, type TEXT NOT NULL, url TEXT, caption TEXT, severity TEXT,
      source TEXT NOT NULL DEFAULT 'staff', reservation_id TEXT, metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL, description TEXT, trigger TEXT NOT NULL, conditions JSONB, actions JSONB,
      created_by INTEGER NOT NULL, active BOOLEAN NOT NULL DEFAULT true, version INTEGER NOT NULL DEFAULT 1,
      last_triggered TIMESTAMP, trigger_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
      details JSONB, ip_address TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS entity_rooms (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'normal',
      metadata JSONB, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS room_messages (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      room_id INTEGER NOT NULL, user_id INTEGER, role TEXT NOT NULL DEFAULT 'user',
      content TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'message', created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS workspace_memory (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      category TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'system', confidence REAL NOT NULL DEFAULT 1.0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      station_id INTEGER, snapshot_type TEXT NOT NULL DEFAULT 'hourly',
      data JSONB NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS station_id INTEGER;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage INTEGER;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_level INTEGER;
    ALTER TABLE wash_queue ADD COLUMN IF NOT EXISTS station_id INTEGER;
    ALTER TABLE wash_queue ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;
    ALTER TABLE wash_queue ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS station_id INTEGER;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS fairness_score REAL;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS fatigue_score REAL;
    ALTER TABLE custom_actions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE custom_actions ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE custom_actions ADD COLUMN IF NOT EXISTS config JSONB;
    ALTER TABLE custom_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);
  console.log("ALL TABLES CREATED SUCCESSFULLY");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
