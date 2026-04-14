-- Fix: Add missing RLS policies for tables where migration 005 failed on Railway Postgres.
-- Migration 005 used "CREATE POLICY IF NOT EXISTS" (non-standard) and "TO service_role"
-- (Supabase-specific). This migration uses standard PostgreSQL syntax and targets the
-- public role, matching the pattern from migration 002.
--
-- These tables have RLS enabled but no policies, which would block all access for
-- non-superuser connections. The app currently connects as postgres (superuser) so
-- this is a correctness fix, not a runtime fix.

-- workspace_proposals
DROP POLICY IF EXISTS "Service role full access on workspace_proposals" ON workspace_proposals;
CREATE POLICY "Service role full access on workspace_proposals"
  ON workspace_proposals FOR ALL USING (true) WITH CHECK (true);

-- imports
DROP POLICY IF EXISTS "Service role full access on imports" ON imports;
CREATE POLICY "Service role full access on imports"
  ON imports FOR ALL USING (true) WITH CHECK (true);

-- notification_reads
DROP POLICY IF EXISTS "Service role full access on notification_reads" ON notification_reads;
CREATE POLICY "Service role full access on notification_reads"
  ON notification_reads FOR ALL USING (true) WITH CHECK (true);
