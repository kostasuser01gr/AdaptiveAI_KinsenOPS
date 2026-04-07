-- Migration 008: Schema alignment and data integrity fixes
-- 1. Make vehicle_evidence.vehicle_id nullable for public evidence submissions
--    (previously required vehicleId:0 which creates orphan records)

ALTER TABLE vehicle_evidence ALTER COLUMN vehicle_id DROP NOT NULL;
