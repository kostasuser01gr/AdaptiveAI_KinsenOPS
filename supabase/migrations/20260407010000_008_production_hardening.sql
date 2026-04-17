-- Production hardening: indexes, RLS, and foreign key safety for recent tables
-- All operations are idempotent (DROP IF EXISTS + CREATE guards)

-- Workspace proposals: add RLS and foreign key indexes
ALTER TABLE workspace_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on workspace_proposals" ON workspace_proposals;
CREATE POLICY "Service role full access on workspace_proposals"
  ON workspace_proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Imports: add foreign key index and RLS
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on imports" ON imports;
CREATE POLICY "Service role full access on imports"
  ON imports FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_imports_uploaded_by ON imports(uploaded_by);

-- Notification reads: add RLS
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on notification_reads" ON notification_reads;
CREATE POLICY "Service role full access on notification_reads"
  ON notification_reads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit log: add index on action for retention queries
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
