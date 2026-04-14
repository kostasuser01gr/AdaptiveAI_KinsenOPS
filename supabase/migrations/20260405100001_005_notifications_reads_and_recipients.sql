-- Add recipient targeting columns to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'broadcast';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user_id integer;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_role text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_station_id integer;

CREATE INDEX IF NOT EXISTS notifications_audience_idx ON notifications(audience);
CREATE INDEX IF NOT EXISTS notifications_recipient_user_idx ON notifications(recipient_user_id);

-- Per-user read tracking table (replaces the global read boolean)
CREATE TABLE IF NOT EXISTS notification_reads (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  notification_id integer NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_reads_uniq ON notification_reads(notification_id, user_id);
CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads(user_id);
