# Telematics + Workshop Integration — Operations Guide

> Phase 4.2B substrate. Last updated during endpoint hardening pass (4.2B-EH).

## Architecture Overview

```
External Providers         API Clients
      │                        │
      ▼                        ▼
POST /api/webhooks/      POST /api/telematics/events
  telematics               (auth'd batch)
      │                        │
      └──────┬─────────────────┘
             ▼
      Zod schema validation
      Payload size check (64 KB)
      Timestamp bounds (2020 → now+1h)
             │
             ▼
      normalizeEvent() → canonical type + severity
             │
             ▼
      createVehicleEventEx()
      ON CONFLICT DO NOTHING (source, externalEventId)
             │
             ├── inserted=true  → fire-and-forget derivation
             └── inserted=false → counted as "deduped"
```

## Endpoints

### Telematics

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/telematics/events` | requireAuth + admin/supervisor + connector_sync entitlement | Batch event ingestion (≤500 events) |
| POST | `/api/webhooks/telematics` | connectorToken in body | Webhook ingestion from external providers |
| GET | `/api/telematics/events` | requireAuth (station-scoped) | List events with filters |
| GET | `/api/telematics/events/:id` | requireAuth (station-scoped) | Single event by ID |
| GET | `/api/telematics/vehicles/:vehicleId/summary` | requireAuth (station-scoped) | Event count summary by type |

### Workshop

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/workshop-jobs` | requireAuth (station-scoped) | List jobs |
| GET | `/api/workshop-jobs/:id` | requireAuth (station-scoped) | Single job |
| POST | `/api/workshop-jobs` | requireAuth + admin/supervisor | Create job |
| PATCH | `/api/workshop-jobs/:id` | requireAuth + admin/supervisor | Update (non-regressive status) |
| POST | `/api/workshop-jobs/:id/link-repair-order` | requireAuth + admin/supervisor | Idempotent link |
| POST | `/api/webhooks/workshop` | connectorToken in body | Webhook job sync |
| GET | `/api/repair-orders/:id/workshop-jobs` | requireAuth | Jobs for a repair order |

## Dedupe Guarantees

- **Unique constraint**: `(source, externalEventId)` on `vehicle_events` table.
- **Mechanism**: `ON CONFLICT DO NOTHING` + fallback `SELECT` to return the existing row.
- **Result**: Callers receive `{ row, inserted }` — deterministic, no clock heuristics.
- **Events without externalEventId**: Always inserted (no dedup possible). Providers should include external IDs.

## Workshop Status Lifecycle

```
pending → estimate_received → approved → parts_ordered → in_repair → qa_ready → completed
  │            │                  │            │              │           │
  └────────────┴──────────────────┴────────────┴──────────────┴───────────┘
                              ↓ (any non-terminal)
                          cancelled
```

**Rules:**
- Forward-only transitions (index in WORKSHOP_STATUS_ORDER must increase).
- `cancelled` can be entered from any non-terminal state.
- `completed` and `cancelled` are terminal — no transitions out.
- Unknown statuses (not in the order list) are allowed through (defensive).

### Workshop → Repair Order Status Sync

Workshop status changes automatically sync to linked repair orders via `WORKSHOP_TO_REPAIR_ORDER_STATUS`:

| Workshop | Repair Order |
|----------|-------------|
| pending, estimate_received, approved | open |
| parts_ordered | awaiting_parts |
| in_repair, qa_ready | in_progress |
| completed | completed |
| cancelled | cancelled |

The repair order transition is validated against `REPAIR_ORDER_TRANSITIONS` — invalid transitions are logged but do not fail the webhook.

## Derivation Hooks

Vehicle events are processed through derivation hooks (fire-and-forget from ingestion):

| Event Type | Action | Cooldown |
|-----------|--------|----------|
| odometer_update | Update vehicle mileage (monotonic) | None |
| fuel_update | Update vehicle fuel level (0–100 clamped) | None |
| maintenance_alert | Create notification | 5 min |
| engine_alert (critical) | Create notification + incident | 5 min / 30 min |
| battery_update (≤20%) | Create notification | 5 min |

## Multi-Instance Considerations

### Cooldown Map

The derivation cooldown system uses an **in-memory `Map`** — intentionally best-effort.

**Impact in multi-instance deployments:**
- Each process maintains its own cooldown state.
- Worst case: duplicate notifications/incidents = number of instances.
- Cooldowns reset on process restart.

**Why this is acceptable:**
1. Derivation actions are idempotent (notification dedup is UI-level).
2. Incident creation is append-only (operators close duplicates manually).
3. Volume is low (hundreds of events/minute, not thousands).

**Upgrade path:** Replace `cooldownMap` with Redis `SET key NX EX ttl` if instance count > 3 or if duplicate actions become operationally noisy.

### DB-Backed Protections

These work correctly across any number of instances:
- Event dedupe: `ON CONFLICT DO NOTHING` on unique index.
- Workshop status transitions: Read-then-validate on every write.
- Repair order sync: Reads current state before applying transition.

## Validation Rules

| Check | Limit | Applied To |
|-------|-------|-----------|
| Batch size | 500 events (telematics), 100 jobs (workshop) | All ingestion paths |
| Payload size | 64 KB per event (JSON serialized) | Telematics events |
| Timestamp bounds | ≥ 2020-01-01, ≤ now + 1 hour | Telematics events |
| vehicleId | Must be positive integer | Schema + normalizeEvent |
| connectorToken | Non-empty string, matched against active connectors | Webhooks only |

## Observability

All ingestion endpoints emit structured log lines via the `logger` module:

- `Telematics batch ingested` — source, inserted, deduped, rejected counts
- `Telematics webhook ingested` — connectorId, inserted, deduped, rejected
- `Workshop webhook processed` — connectorId, synced, skipped counts
- `Workshop sync: invalid repair order transition` — repairOrderId, from, to
- `Derivation failed` — eventId + error (fire-and-forget, does not fail ingestion)

## Station Scope

Non-admin/supervisor users are station-scoped:
- **admin/supervisor**: See all data (`getStationScope` returns `null`).
- **Station-assigned user**: See only data for vehicles in their station.
- **No station**: See nothing (`getStationScope` returns `"none"`).
- **Telematics events**: Station-scoped users must provide `vehicleId` filter.
- **Workshop jobs**: Only visible if linked to a repair order for a station vehicle.
