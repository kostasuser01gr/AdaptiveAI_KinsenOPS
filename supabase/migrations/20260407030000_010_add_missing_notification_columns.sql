-- Migration 007: Add missing notification columns
-- The Drizzle schema defines assigned_to, status, source_entity_type, source_entity_id
-- but no migration ever added them. This caused SELECT * to fail with column-not-found errors.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS assigned_to integer;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_entity_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_entity_id text;

CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);
CREATE INDEX IF NOT EXISTS notifications_assigned_idx ON notifications(assigned_to);
