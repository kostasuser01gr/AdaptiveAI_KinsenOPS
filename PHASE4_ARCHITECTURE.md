# Phase 4 Architecture Report

**Date:** 2026-04-07
**Baseline:** Phase 1+2+3 hardened — 0 type errors, 547/547 tests, clean build
**Codebase:** ~766 lines schema (41 tables), ~1264 lines storage (IStorage + DatabaseStorage), ~3904 lines routes, ~14.4k total server+client code

---

## 1. Current-State Readiness

### 1.1 Telematics Connector

**What exists:**
- `integrationConnectors` table with type/direction/config/status fields — already supports typed connectors
- `syncJobs` table with full lifecycle (pending → running → success/failed/partial), dedup tracking, error log
- Webhook ingestion endpoint (`POST /api/webhooks/reservations`) with connector token auth and externalId dedup
- `vehicles` table with `mileage`, `fuelLevel`, `status`, `stationId` — core fields a telematics feed would update
- `downtimeEvents` table for vehicle state transitions
- Redaction infrastructure for connector secrets

**What is missing:**
- No `telematicsEvents` table (GPS, odometer, fuel, engine codes, ignition state)
- No vehicle-matching logic beyond plate — no VIN column on `vehicles`
- No event normalization layer (telematics providers have wildly different schemas)
- No streaming/batch ingestion pipeline — current webhook endpoint is synchronous per-request
- No rate control for high-frequency telemetry (GPS pings every 30s × hundreds of vehicles)
- No concept of "auto-update" vs "human-review" for vehicle state changes

**Ready now?** Partially. The connector + sync job framework is solid. But the ingestion volume and event normalization are fundamentally different from PMS sync. This needs its own pipeline.

---

### 1.2 Multi-Tenant Workspace Isolation

**What exists:**
- `stations` table — provides physical location grouping (closest analog to "sub-tenant")
- `getStationScope()` function — role-based station scoping on 6 keyed endpoints
- `workspaceConfig` table — tenant-level key/value settings
- `moduleRegistry` table — per-workspace module enable/disable
- Single Passport.js session store keyed to `user_sessions` table
- All queries go through `DatabaseStorage` — single point of data access

**What is missing:**
- No `workspaceId` column on any table — currently single-tenant
- No tenant resolution middleware (subdomain, header, or path-based)
- No cross-tenant data isolation at query level
- Session store is shared — no tenant-aware session scoping
- No tenant provisioning, deprovisioning, or admin-of-admins concept
- All RLS policies use `service_role` bypass — application-level only

**Ready now?** No. This is the most invasive change in Phase 4. Every table needs a `workspaceId` column. Every query needs a workspace filter. Session serialization needs workspace context. This is a multi-week migration.

---

### 1.3 Feature Tier Gating

**What exists:**
- `moduleRegistry` with `enabled` boolean and `requiredRole` — can already disable entire modules
- `workspaceConfig` — can store tier configuration
- `systemPolicies` — can define feature rules with enforcement levels (warn/block)

**What is missing:**
- No tier definitions (free/starter/pro/enterprise)
- No feature catalog mapping features → tiers
- No middleware that checks tier before allowing route access
- No UI for tier state, upgrade prompts, or feature locks
- No concept of "trial" or "grace period"

**Ready now?** Close. The `moduleRegistry` + `workspaceConfig` infrastructure is 80% of what's needed. Adding tier-aware middleware is straightforward. This is low-risk.

---

### 1.4 Usage Metering

**What exists:**
- `metricsCollector` — in-memory request counters with path-based categorization (authFailures, aiRequestFailures, etc.)
- `syncJobs` tracks records processed/failed/skipped per job
- `auditLog` records all CRUD operations with userId, timestamp, entityType
- Rate limiters on AI chat (10/min), search (30/min), auth (20/15min)

**What is missing:**
- No persistent usage counters — `metricsCollector` is in-memory and resets on restart
- No aggregation pipeline (daily/monthly rollups)
- No storage usage tracking (KB documents, file attachments, imports)
- No per-tenant metering (requires multi-tenant first)
- No billing integration or usage threshold enforcement

**Ready now?** Foundation is there (audit log + rate limiters). The main gap is persistent counters and aggregation. This is moderately invasive because it touches every metered path.

---

### 1.5 Fine-Grained Permission Matrix

**What exists:**
- 5 RBAC roles: admin, supervisor, coordinator, agent, washer
- `requireRole()` middleware — checks role allowlist
- `getStationScope()` — returns station-filtered or full access based on role
- Command palette respects station scope
- Static permission matrix in Trust Console (view_fleet, manage_users, etc.)
- `SHIFT_MANAGERS` constant for shift-specific role gating

**What is missing:**
- Permissions are hardcoded in routes — not configurable per deployment
- No capability-based permissions (e.g., "can_export_incidents" separate from role)
- No per-connector permission (who can trigger which sync)
- No simulation permission
- No delegated admin concept (supervisor A owns stations 1-3, supervisor B owns 4-6)
- Station assignment is a single `text` field on `users` — not multi-station

**Ready now?** Partially. The RBAC foundation is solid for operation. But evolving to capability-based requires a `permissions` table and enforcement middleware replacement. Medium invasion.

---

### 1.6 Digital Twin Simulation / What-If

**What exists:**
- `digitalTwinSnapshots` table — stores station-level data snapshots with jsonb `data` field
- `DigitalTwin.tsx` UI — displays station metrics, vehicle breakdowns, staff counts, queue lengths
- `StationCard` component with ready/washing/maintenance/rented vehicle breakdown
- KPI compute engine (`/api/kpi/compute`) — calculates fleet utilization, SLA attainment, turnaround
- Staffing recommendations engine — formula-based, per-day

**What is missing:**
- No simulation engine — all data is live/historical, no hypothetical scenarios
- No "what if I add 5 vehicles" or "what if demand increases 20%" capability
- No scenario storage or comparison
- No time-series projection beyond the staffing 7-day window
- No separation between "observed state" and "simulated state"

**Ready now?** The data model and UI shell exist. But simulation is a new computation layer. The staffing engine is the closest thing to a predictive model, and it's a static formula. Real simulation needs at minimum: input parameters, assumption sets, a compute function, and output comparison. This is medium complexity but high fantasy risk.

---

### 1.7 Performance Hardening

**What exists:**
- Indexes on all major FK columns, status fields, dates
- Rate limiters on AI, auth, search endpoints
- WebSocket heartbeat with unresponsive client termination
- Connection pool: `max: 20`, idle timeout 30s

**What is missing (identified hotspots):**
- `/api/kpi/compute` loads 5 full tables per request (vehicles, wash_queue, incidents, downtime, reservations) — no date filtering at DB level
- Same 5-table scan pattern duplicated in KPI snapshot and executive briefing generation — 3 routes with identical cost
- `workspace_memory` full scan on every AI chat request
- `getVehicles()` returns all vehicles (including soft-deleted) on every fleet/analytics/palette call
- No pagination on any list endpoint
- `searchKnowledgeDocuments()` does in-memory text matching (full table load + JS filter)
- No caching layer — every identical request re-queries Postgres
- Analytics page makes 6 parallel queries on mount

**Ready now?** Ready and overdue. These are all fixable without schema changes. Indexes, SQL aggregates, pagination, and light Redis caching would solve 90% of identified hotspots.

---

### 1.8 Export Framework

**What exists:**
- `AUDIT_ACTIONS.EXPORT` action type defined in audit middleware
- `/api/analytics/export` — generates CSV in-memory from analytics data (admin/supervisor only)
- `auditLog` tracks all export actions
- `fileAttachments` table — could store generated export files
- `metricsCollector.week1.exportFailures` — already counted

**What is missing:**
- No background export generation — current export is synchronous and in-memory
- No export entity model (incident pack, compliance pack, reservation CSV)
- No approval workflow for sensitive exports
- No export access control beyond role check
- No export storage/download management
- No scheduled exports

**Ready now?** Infrastructure partially exists. The audit trail and role gating are solid. What's needed is an `exports` table, background job processing, and typed export templates.

---

### 1.9 Maintenance/Workshop Integration

**What exists:**
- `repairOrders` table with full lifecycle (open → in_progress → awaiting_parts → completed → cancelled)
- State machine transitions enforced in routes
- Auto-creation of downtime events when repair order is opened
- Auto-restoration of vehicle status when repair order completes
- `downtimeEvents` table with reason categories (maintenance, repair, incident, etc.)
- Vehicle status includes `maintenance` state

**What is missing:**
- No external workshop system connector
- No parts inventory tracking
- No service schedule / preventive maintenance calendar
- No technician assignment beyond `assignedTo` integer
- No labor time tracking
- No cost breakdown categories (parts, labor, external)
- No workshop-specific views or dashboards

**Ready now?** The repair order + downtime model is solid. Workshop integration is an extension of the existing connector framework. This is additive, not invasive.

---

### 1.10 Operator Onboarding Wizard

**What exists:**
- `workspaceConfig` — stores setup state
- `moduleRegistry` — can be populated with initial modules
- `stations` CRUD — can create stations
- `users` CRUD with password hashing
- `systemPolicies` — can define initial governance rules
- `seed.ts` — exists and populates demo data

**What is missing:**
- No first-run detection
- No guided setup flow
- No minimum-viable configuration check
- No "is this workspace ready?" health check
- No onboarding UI (wizard component)
- No first connector/import guided path

**Ready now?** All the backend building blocks exist. The onboarding wizard is primarily a UI concern with thin backend health-check endpoints. Low risk, high user value.

---

## 2. Risk Ranking

| # | Theme | Arch Invasiveness | Data Model Risk | Rollout Risk | Business Value | Impl Order |
|---|---|---|---|---|---|---|
| 2 | Multi-Tenant | **CRITICAL** | **CRITICAL** | **HIGH** | HIGH | Last |
| 5 | Fine-Grained Permissions | **HIGH** | MEDIUM | MEDIUM | HIGH | Mid |
| 1 | Telematics Connector | MEDIUM | MEDIUM | MEDIUM | **HIGH** | Mid |
| 4 | Usage Metering | MEDIUM | LOW | LOW | HIGH | Mid |
| 6 | Digital Twin Simulation | MEDIUM | LOW | LOW | MEDIUM | Mid |
| 7 | Performance Hardening | **LOW** | **NONE** | **LOW** | **HIGH** | First |
| 3 | Feature Tier Gating | LOW | LOW | LOW | HIGH | First |
| 8 | Export Framework | LOW | LOW | LOW | HIGH | First |
| 10 | Onboarding Wizard | LOW | NONE | LOW | HIGH | First |
| 9 | Maintenance/Workshop | LOW | LOW | LOW | MEDIUM | Mid |

**Key insight:** Multi-tenant is the only item that touches every table and every query. It should be done last, after all other subsystems are stable, so the `workspaceId` migration is a single coordinated effort rather than a moving target.

---

## 3. Sub-Phase Split

### Phase 4.1 — Safe High-Value Work (no schema invasion)

| Item | Why here |
|---|---|
| **Performance hardening** | Zero schema changes. Fixes known hotspots. Reduces risk for everything else. Must happen first because other Phase 4 work adds more routes/data. |
| **Export framework** | Additive (new `exports` table only). Uses existing audit and file infrastructure. High user demand. |
| **Feature tier gating** | Leverages existing `moduleRegistry` + `workspaceConfig`. Adds `featureTiers` table and middleware. Non-breaking. |
| **Onboarding wizard** | Purely additive UI + 2-3 health-check endpoints. No schema risk. Improves first-use experience before multi-tenant brings new operators. |

### Phase 4.2 — Medium-Risk Foundation

| Item | Why here |
|---|---|
| **Telematics connector** | New `telematicsEvents` table + VIN column on vehicles. Uses existing connector framework. Needs careful ingestion design but doesn't touch existing tables' structure. |
| **Usage metering** | New `usageMeter` table + aggregation job. Touches AI chat, sync, and export paths with lightweight counter inserts. |
| **Fine-grained permissions** | Replaces hardcoded `requireRole()` checks with capability lookups. Requires `capabilities` table and migration of all route guards. Medium blast radius because every route is touched, but each change is mechanical. |
| **Maintenance/workshop** | Extends repair orders with parts/labor tracking. New tables only. Uses connector framework for external workshop systems. |
| **Digital Twin simulation** | New `simulationScenarios` + `simulationRuns` tables. Isolated compute — doesn't modify live data. Risk is in fake precision, not in architecture. |

### Phase 4.3 — Highest Risk / Most Invasive

| Item | Why here |
|---|---|
| **Multi-tenant workspace isolation** | Touches every table (add `workspaceId`), every query (add filter), session management, and deployment model. Must be done after all Phase 4.1/4.2 tables exist so the migration is comprehensive. Doing it earlier means re-migrating every new table added in 4.1/4.2. |

---

## 4. Multi-Tenant Architecture Options

### Option A: Single Database + `workspace_id` Row Scoping

**How it works:** Add `workspaceId integer NOT NULL` to every table. Add a composite index on `(workspaceId, ...)` for every existing index. Resolve workspace from session/subdomain. Filter every query.

**Migration complexity:** HIGH — 41 tables need a new column + data backfill + index recreation. Every Drizzle query gets a `.where(eq(table.workspaceId, ctx.workspaceId))` clause. The IStorage interface either gains a `workspaceId` parameter on every method or uses a request-scoped context.

**RBAC interaction:** getStationScope() gains a workspace dimension: `station` is unique within a workspace — `station.code` uniqueness becomes `(workspaceId, code)`. User roles are per-workspace.

**Query safety:** Every query must include the workspace filter. A missed filter = data leak. Can be mitigated by:
1. Drizzle middleware/wrapper that auto-injects the filter
2. Failing open (log + alarm) vs failing closed (deny if no workspace set)
3. RLS at Postgres level as defense-in-depth

**Operational burden:** LOW — single database, single deployment, single migration path. Standard PG operations (backup, restore, vacuum) work normally.

**Cost:** LOW — shared connection pool, no per-tenant overhead. Railway single-service model continues working.

**Fit with Railway/Postgres:** EXCELLENT — Railway gives you one PG instance. Row-scoped multi-tenancy is exactly what works here. No need for multiple databases or schemas.

**Fit with Drizzle/Express:** GOOD — Drizzle supports `.where()` chaining. Can create a `withWorkspace(query, workspaceId)` utility or use Drizzle's `$with` for reusable filters. Express middleware sets `req.workspaceId` early in the chain.

### Option B: Schema-Per-Tenant

**How it works:** Each tenant gets a Postgres schema (`ws_001.vehicles`, `ws_002.vehicles`). Set `search_path` per request.

**Migration complexity:** EXTREME — every migration must run against every schema. Drizzle doesn't natively support runtime schema switching. Would need to rebuild the `db` instance per request or use raw SQL.

**Query safety:** Good isolation by default — wrong schema = no data, not wrong data.

**Operational burden:** HIGH — `N` schemas to migrate, vacuum, monitor. Schema count grows linearly with tenants.

**Cost:** MEDIUM — connection pool can be shared but schema switching adds overhead.

**Fit with Railway/Postgres:** POOR — Railway Postgres is a managed single-instance. Schema management adds significant operational complexity without the tooling to automate it.

**Fit with Drizzle/Express:** POOR — Drizzle's schema is compile-time. Runtime schema switching requires bypassing the ORM or creating per-request Drizzle instances (expensive).

### Option C: Database-Per-Tenant

**How it works:** Each tenant gets a separate Postgres database. Route requests to the correct database based on tenant resolution.

**Migration complexity:** EXTREME — separate connection pools, separate migrations per database. Complete rewrite of db.ts and storage layer.

**Query safety:** Best isolation — complete physical separation.

**Operational burden:** EXTREME — `N` databases to manage, back up, monitor. Railway would need `N` Postgres services.

**Cost:** HIGH — `N × $5+/month` for Railway Postgres. Not viable until significant revenue per tenant.

**Fit with Railway/Postgres:** TERRIBLE — Railway charges per database service. 100 tenants = 100 database bills. No shared infrastructure.

**Fit with Drizzle/Express:** POOR — requires dynamic connection pool selection per request.

### **RECOMMENDATION: Option A — Single Database + workspace_id Row Scoping**

**Rationale:**
1. Railway gives us one Postgres instance — Option A is the only one that works without operational explosion
2. Drizzle's query builder supports the pattern naturally with `.where()` chains
3. The existing `IStorage` interface is the perfect place to inject workspace filtering — create a `WorkspaceScopedStorage` that wraps `DatabaseStorage`
4. RLS can be added as defense-in-depth (already enabled on all tables, just needs workspace-aware policies)
5. The `workspaceConfig` table already exists and is conceptually per-workspace — it just needs the column
6. Migration is mechanical: add column with default value for existing data → create workspace #1 → backfill all rows → make NOT NULL → add composite indexes

**Implementation sketch:**
```
// Middleware
app.use((req, res, next) => {
  const workspaceId = resolveWorkspace(req); // from session, subdomain, or header
  req.workspaceId = workspaceId;
  next();
});

// Storage wrapper
class WorkspaceScopedStorage {
  constructor(private inner: DatabaseStorage, private workspaceId: number) {}
  async getVehicles() {
    return db.select().from(vehicles)
      .where(and(eq(vehicles.workspaceId, this.workspaceId), isNull(vehicles.deletedAt)));
  }
  // ... every method gets workspace filter
}
```

**Risk mitigation:** Add a test that grep-scans all storage methods for workspace filter presence. Any method missing the filter fails CI.

---

## 5. Permission Model Evolution

### Current State
```
Role (5 values) → hardcoded route checks (requireRole("admin", "supervisor"))
Station (text) → getStationScope() → per-request station filtering
```

### Target State
```
Role → base capabilities (starter set)
 + Capability overrides (per-user additions/removals)
 + Station scope (multi-station assignment)
 + Workspace scope (tenant boundary) [Phase 4.3]
 + Feature tier (workspace-level feature availability)
```

### Permission Model Shape

```typescript
// Capability definitions (seeded, not user-editable)
interface Capability {
  slug: string;           // "fleet.view", "fleet.edit", "connectors.manage", "exports.incidents"
  category: string;       // "fleet", "operations", "admin", "integrations", "exports", "simulation"
  description: string;
  defaultRoles: string[]; // which roles get this by default
}

// Role-capability mapping (configurable by admin)
interface RoleCapability {
  role: string;
  capabilitySlug: string;
  granted: boolean;       // true = grant, false = explicit deny
}

// Per-user overrides (sparse — only stores exceptions)
interface UserCapabilityOverride {
  userId: number;
  capabilitySlug: string;
  granted: boolean;
}

// Station assignments (multi-station)
interface UserStationAssignment {
  userId: number;
  stationId: number;
  role: string;           // role can vary per station (coordinator at station 1, agent at station 5)
}
```

### Resolution Order
1. Check feature tier — if feature is not in the workspace's tier, deny (403 with upgrade hint)
2. Check user capability — resolve from: role defaults ← role overrides ← user-level overrides
3. Check station scope — user must have a station assignment that covers the entity's station
4. Check workspace scope — entity must belong to user's workspace [Phase 4.3]

### Where Enforcement Lives
- **Feature tier:** Express middleware (`requireTier("pro")`) — runs early, before any data access
- **Capabilities:** Express middleware (`requireCapability("exports.incidents")`) — replaces current `requireRole()`
- **Station scope:** Keep existing `getStationScope()` pattern but expand to multi-station (returns `number[]` instead of `number | null | 'none'`)
- **Workspace scope:** Storage layer (WorkspaceScopedStorage wrapper) — automatic, invisible to route handlers

### What Stays Role-Based vs Becomes Capability-Based
- **Keep role-based:** UI navigation (sidebar visibility), default dashboard view, session-level context
- **Move to capability-based:** every write operation, every export, every admin action, connector management, simulation access, Trust Console access, user management
- **Station scope stays separate:** it's a data filter, not a permission — orthogonal to capabilities

### Migration Path
Phase 4.2 adds capability tables and `requireCapability()` middleware. Existing `requireRole()` calls are mechanically replaced:
```
requireRole("admin", "supervisor")  →  requireCapability("connectors.manage")
requireRole("admin")                →  requireCapability("users.manage")
requireAuth                         →  requireCapability("fleet.view")  // or stays as-is for basic access
```

The Trust Console's static permission matrix becomes the source of truth for the capability seed data.

---

## 6. Usage Metering Architecture

### What Gets Measured

| Metric | Source | Type |
|---|---|---|
| AI chat requests | `/api/ai/chat` | Billable |
| AI automation drafts | `/api/automations/draft` | Billable |
| Incident summary generations | `/api/incidents/:id/summary` | Billable |
| Executive briefing generations | `/api/executive-briefings/generate` | Billable |
| Connector sync jobs | Sync job completion | Billable |
| Webhook ingestion events | `/api/webhooks/*` | Operational |
| Export generations | Export framework | Billable |
| Simulation runs | Simulation engine | Billable |
| KB document storage (bytes) | Knowledge document uploads | Billable |
| File attachment storage (bytes) | File attachment uploads | Billable |
| Active vehicles | Vehicle count snapshot | Billable |
| Active users | User count snapshot | Billable |
| API requests (total) | All routes | Operational |

### Storage Model

```sql
-- Individual usage events (write-heavy, append-only)
CREATE TABLE usage_events (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id integer NOT NULL,
  category text NOT NULL,        -- 'ai_request', 'sync_job', 'export', 'simulation', 'storage'
  metric text NOT NULL,          -- 'ai_chat', 'ai_draft', 'connector_sync', etc.
  quantity integer NOT NULL DEFAULT 1,
  metadata jsonb,                -- { model: 'claude-sonnet-4-20250514', tokens_in: 500, tokens_out: 1200 }
  user_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_workspace_idx ON usage_events(workspace_id, created_at);
CREATE INDEX usage_events_category_idx ON usage_events(category, created_at);

-- Aggregated daily rollups (read-optimized, computed by cron/job)
CREATE TABLE usage_daily (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id integer NOT NULL,
  date text NOT NULL,            -- YYYY-MM-DD
  metric text NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0,
  total_cost_micros integer,     -- cost in micro-dollars (e.g., 1500 = $0.0015)
  UNIQUE(workspace_id, date, metric)
);
CREATE INDEX usage_daily_workspace_date_idx ON usage_daily(workspace_id, date);
```

### Aggregation Cadence
- **Real-time:** Each metered action inserts a row into `usage_events` (cheap append)
- **Hourly:** Background job rolls up `usage_events` → `usage_daily` for the current hour's window
- **On-demand:** Dashboard queries `usage_daily` for display; falls back to `usage_events` for same-day data

### Anti-Abuse Considerations
- Rate limiters remain the first line of defense (already exist for AI chat, search)
- Usage metering adds a **second line**: if `usage_daily.total_quantity` for a metric exceeds the tier limit, deny with 429 + upgrade hint
- Tier limits are defined in `workspaceConfig` (e.g., `ai_chat_monthly_limit: 1000`)
- **Hard ceiling enforcement:** check limit before processing, not after (prevents a burst from blowing past limits)
- Storage metrics sampled daily via `SELECT SUM(size) FROM knowledge_documents WHERE workspace_id = ?` — not per-request

### Billable vs Operational
- **Billable:** AI requests, sync jobs, exports, simulations, storage, active vehicles/users — these affect cost and drive tier upgrades
- **Operational only:** API request counts, WebSocket connections, webhook events — used for monitoring dashboards but not billed

---

## 7. Telematics Connector Architecture

### Ingestion Model

Two modes, because telematics providers vary:

1. **Push (webhook):** Provider sends events to `POST /api/webhooks/telematics/:connectorId`. Each payload contains 1-N vehicle events. Uses the existing connector token authentication pattern.

2. **Pull (polling):** A scheduled job (every 60-300s, configurable per connector) calls the provider's API. Uses the existing sync job framework: create job → fetch → process → complete.

Both modes normalize events into a unified `telematicsEvents` table.

### Event Normalization

```sql
CREATE TABLE telematics_events (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id integer NOT NULL,          -- resolved via VIN/plate matching
  connector_id integer NOT NULL,
  event_type text NOT NULL,             -- 'gps', 'odometer', 'fuel', 'engine_code', 'ignition', 'battery', 'speed'
  timestamp timestamp NOT NULL,         -- event time from provider (NOT insert time)
  data jsonb NOT NULL,                  -- normalized: { lat, lng } for gps; { value, unit } for odometer; { code, severity } for engine_code
  raw_payload jsonb,                    -- original provider payload for debugging
  external_id text,                     -- provider's event ID for dedup
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX telematics_vehicle_idx ON telematics_events(vehicle_id, timestamp DESC);
CREATE INDEX telematics_type_idx ON telematics_events(event_type, timestamp DESC);
CREATE INDEX telematics_connector_idx ON telematics_events(connector_id);
CREATE INDEX telematics_external_idx ON telematics_events(external_id);
```

### Dedupe Strategy
- `external_id` uniqueness per connector: `UNIQUE(connector_id, external_id)`
- For providers that don't supply event IDs: generate a deterministic hash from `vehicle_id + event_type + timestamp + data` — prevents duplicate inserts from webhook retries
- Same pattern as Phase 3 webhook dedup: pre-load existing external IDs for the batch, skip known ones

### Vehicle Matching
- **Primary:** VIN match. Add `vin text` column to `vehicles` table (unique, nullable). Telematics providers almost always report by VIN.
- **Fallback:** Plate match. Existing `plate` column is already unique.
- **Failure mode:** If no match, insert event with `vehicle_id = NULL` and flag for manual resolution. Do NOT auto-create vehicles — that's a human decision.

### Update Frequency
- **GPS events:** Every 60s for active vehicles, every 300s for parked. Store in `telematics_events` but DO NOT write to `vehicles` table on every ping — batch-update vehicle location every 5 minutes.
- **Odometer/fuel:** Update `vehicles.mileage` and `vehicles.fuelLevel` on receipt, max once per 5 minutes per vehicle (debounce).
- **Engine codes:** Always store event. If severity is critical, auto-create an incident.
- **Ignition on/off:** Store event. Update vehicle status to `in_use`/`ready` only if no active reservation contradicts it.

### What Telematics Should Auto-Update in AdaptiveAI
- `vehicles.mileage` — from odometer events (debounced)
- `vehicles.fuelLevel` — from fuel events (debounced)
- `kpiSnapshots` — daily mileage deltas for fleet utilization KPIs
- `anomalies` — auto-detect: excessive mileage, low fuel patterns, repeated engine codes
- `downtimeEvents` — auto-create if vehicle reports no ignition for >24h unexpectedly

### What It Should NOT Auto-Update
- `vehicles.status` — too many edge cases. A vehicle in `maintenance` status should not flip to `ready` just because ignition turned on. Status changes remain human-confirmed or triggered by explicit workflows (repair order close, reservation check-in).
- `vehicles.stationId` — GPS-based station reassignment is tempting but dangerous. A vehicle driving between stations doesn't mean it's been reassigned. Keep station assignment manual.
- `reservations` — telematics should never modify reservation data
- `repairOrders` — telematics can trigger incidents, but repair order creation requires human judgment

### Failure Handling
- **Provider down (pull mode):** Sync job fails, connector status set to `error`, retry with exponential backoff (1min, 5min, 15min, 1h). After 3 consecutive failures, pause connector and notify admin.
- **Invalid events:** Log to `syncJob.errorLog`, increment `recordsFailed`, continue processing batch. Never fail the entire batch for one bad event.
- **Vehicle not matched:** Store event with null vehicle_id. Create an anomaly of type `unmatched_telematics` for admin review.
- **Rate overload:** If incoming event rate exceeds 100/second, buffer in memory (bounded queue, max 10k events) and batch-insert every 5 seconds.

---

## 8. Digital Twin Simulation Architecture

### What Is Practical Now vs Fantasy

**Practical (can build in Phase 4.2):**
- Parameter-driven "what-if" projections: "what if fleet grows by 10 vehicles?" / "what if wash demand increases 20%?"
- Staffing sufficiency modeling: extend current formula with configurable parameters
- Queue wait-time estimation: given current backlog + staff, how long until queue clears?
- Cost projection: given repair order trends, project monthly maintenance cost

**Fantasy (do NOT build):**
- Real-time continuous simulation (SimCity-style)
- ML-driven demand prediction (not enough historical data yet)
- Agent-based modeling (vehicles as autonomous agents) — overengineered for this product stage
- Probabilistic Monte Carlo simulations — users will not understand the output

### Inputs

```typescript
interface SimulationInput {
  baselineStationId: number;       // use real data from this station as baseline
  baselineDate: string;            // YYYY-MM-DD — snapshot real data from this date
  adjustments: {
    fleetSizeDelta: number;        // +10, -5, etc.
    demandMultiplier: number;      // 1.0 = no change, 1.2 = +20%
    staffCountOverride?: number;   // override current staff count
    avgWashTimeMinutes?: number;   // override default 45min
    avgRepairDaysOverride?: number;// override avg repair duration
  };
  horizonDays: number;             // how many days to project (max 30)
}
```

### Assumptions (explicitly displayed to user)
Every simulation output must show its assumptions:
- "Based on [station X] data from [date]"
- "Assumes constant demand distribution across days"
- "Does not account for seasonal variation"
- "Wash time assumed at [N] minutes"
- "Staff capacity assumes [8] hour shifts"

### Scenario Models

**Model 1: Queue Throughput**
- Input: current queue size, staff count, avg wash time, new vehicles expected
- Formula: `clearTimeHours = (queueSize + newVehicles * demandMultiplier) * avgWashMinutes / (staffCount * 60)`
- Output: estimated queue clear time, bottleneck identification

**Model 2: Staffing Sufficiency**
- Input: reservation forecast (from current bookings), staff count, wash demand
- Formula: extend existing staffing formula with demand multiplier
- Output: per-day staffing gap, breakeven staff count

**Model 3: Fleet Utilization Projection**
- Input: vehicle count, reservation count, downtime rate
- Formula: `utilization = (activeReservations / (totalVehicles - inMaintenance)) * 100`
- Apply fleet delta and demand multiplier
- Output: projected utilization %, idle vehicle count

**Model 4: Cost Projection**
- Input: repair order history, avg cost per order, fleet size change
- Formula: `monthlyCost = avgOrdersPerVehicle * avgCostPerOrder * (fleetSize + delta)`
- Output: projected monthly maintenance cost, cost per vehicle

### Output Model

```sql
CREATE TABLE simulation_scenarios (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  station_id integer NOT NULL,
  inputs jsonb NOT NULL,           -- SimulationInput
  created_by integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE simulation_runs (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  scenario_id integer NOT NULL,
  outputs jsonb NOT NULL,          -- { models: { queue, staffing, utilization, cost }, assumptions: [...] }
  baseline_snapshot jsonb NOT NULL,-- real data used as baseline (frozen at run time)
  run_at timestamp NOT NULL DEFAULT now()
);
```

### How to Prevent Fake Precision
1. **Round outputs to meaningful precision:** "~3 hours" not "2 hours 47 minutes 12 seconds"
2. **Show confidence bands:** "Estimated 3-5 hours" not "Estimated 4 hours"
3. **Label everything as estimates:** use words like "approximately", "projected", "estimated"
4. **Show what changed:** display delta from baseline, not just absolute numbers
5. **Limit horizon:** max 30 days. Beyond that, too many unknowns accumulate
6. **No decimal places on staff recommendations:** "need 3 more staff" not "need 2.7 more"

### Operator UX Principles
- Start from real data (select a station, select a date)
- Adjust sliders for what-if parameters
- See side-by-side comparison: baseline vs projected
- Every number has a tooltip explaining the assumption
- "This is an estimate" banner on every simulation view
- Save scenarios for comparison
- No auto-action from simulations — they inform decisions, they don't make them

---

## 9. Export Framework Architecture

### Export Entity Model

```sql
CREATE TABLE exports (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type text NOT NULL,              -- 'incident_pack', 'kpi_report', 'compliance_export', 'reservation_csv', 'fleet_snapshot', 'audit_log'
  status text NOT NULL DEFAULT 'pending',  -- pending | approved | generating | ready | failed | expired
  requested_by integer NOT NULL,
  approved_by integer,
  station_id integer,              -- scope to station, or null for all
  date_from text,                  -- YYYY-MM-DD
  date_to text,
  filters jsonb,                   -- type-specific filters
  output_format text NOT NULL DEFAULT 'csv',  -- csv | pdf | json | xlsx
  file_key text,                   -- storage path after generation
  file_size integer,
  download_count integer NOT NULL DEFAULT 0,
  expires_at timestamp,            -- auto-expire after 7 days
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX exports_status_idx ON exports(status);
CREATE INDEX exports_requested_idx ON exports(requested_by);
CREATE INDEX exports_type_idx ON exports(type);
```

### Approval Flow

| Export Type | Approval Required? | Who Can Approve? |
|---|---|---|
| `reservation_csv` | No — self-service for admin/supervisor | — |
| `fleet_snapshot` | No — self-service for admin/supervisor | — |
| `kpi_report` | No — self-service for admin/supervisor | — |
| `incident_pack` | **Yes** — contains sensitive data | admin only |
| `compliance_export` | **Yes** — regulatory, must be audited | admin only |
| `audit_log` | **Yes** — security-sensitive | admin only |

Flow:
1. User requests export → status = `pending` (or `approved` if no approval needed)
2. If approval required → admin reviews → approves/rejects
3. Approved → background job generates file → status = `generating` → `ready`
4. User downloads → `download_count++`, audit entry created
5. After 7 days → status = `expired`, file deleted

### Background Generation

Use Node.js `setTimeout`/`setImmediate` for now (not a full job queue). Reasoning:
- Railway has no built-in job queue
- Adding Redis/BullMQ increases operational complexity
- Export generation is infrequent (10-50/day) and most complete in <30s
- If export volume grows, Phase 5 can add a proper queue

Pattern:
```typescript
// On approval
setImmediate(async () => {
  try {
    await updateExport(id, { status: 'generating' });
    const data = await generateExportData(export);
    const fileKey = await writeExportFile(data, export.outputFormat);
    await updateExport(id, { status: 'ready', fileKey, fileSize, completedAt: new Date() });
  } catch (e) {
    await updateExport(id, { status: 'failed', metadata: { error: e.message } });
  }
});
```

### Storage
- Store generated files in the existing `LOCAL_UPLOAD_DIR` (same as KB documents and file attachments)
- `file_key` is the relative path within the upload directory
- Serve via `GET /api/exports/:id/download` with auth + audit

### Access Control
- Requesting an export: requires `requireCapability("exports." + type)` [Phase 4.2] or `requireRole("admin", "supervisor")` [Phase 4.1]
- Downloading: requester can download their own exports. Admins can download any export.
- Approving: admin only. Supervisor cannot approve their own export of sensitive types.

### Audit Requirements
- Every export request logged with `AUDIT_ACTIONS.EXPORT`
- Every download logged with `AUDIT_ACTIONS.VIEW` + entityType = 'export'
- Every approval/rejection logged with `AUDIT_ACTIONS.UPDATE`
- Compliance exports include a hash of the exported data for tamper detection

### Export Types Detail

**Incident Pack:** All data for a single incident — incident record, war room messages, repair orders, downtime events, vehicle evidence, incident summary. Output as PDF or JSON.

**KPI Report:** KPI snapshots for a date range, optionally scoped to a station. Includes trend charts as CSV data. Output as CSV or PDF.

**Compliance Export:** Audit log + all incidents + all downtime for a date range. Includes data hash. Output as JSON (machine-readable, for regulators).

**Reservation CSV:** All reservations for a date range. Includes customer name, dates, vehicle, status. Output as CSV.

**Fleet Snapshot:** Current state of all vehicles — plate, model, status, mileage, fuel, station. Output as CSV.

**Audit Log Export:** Filtered audit log for a date range. Output as CSV or JSON.

---

## 10. Performance Hardening Plan

### Identified Hotspots (Priority Order)

#### CRITICAL: KPI Compute 5-Table Full Scan

**Current:** `/api/kpi/compute`, `/api/kpi/snapshot`, `/api/executive-briefings/generate` each load all rows from 5 tables into memory (`vehicles`, `wash_queue`, `incidents`, `downtime_events`, `reservations`).

**Fix:**
1. Push date filtering to SQL: `getReservations({ from, to })`, `getDowntimeEvents({ from, to })` — use `pickupDate`/`startedAt` columns respectively. Already indexed.
2. Replace in-JS aggregation with SQL aggregates for simple counts:
   ```sql
   SELECT COUNT(*) FILTER (WHERE status = 'ready') as ready,
          COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
   FROM vehicles WHERE deleted_at IS NULL;
   ```
3. Create a dedicated `computeKpiAggregates(from, to, stationId?)` storage method that runs 3-5 targeted SQL queries instead of 5 full table dumps.
4. Cache the result for 5 minutes (in-memory Map with TTL). KPI data doesn't change per-second.

**Impact:** 5 × full table scan → 5 × indexed aggregate queries + 5-min cache = ~100× improvement.

#### HIGH: Workspace Memory Full Scan per AI Chat

**Current:** Every AI chat request loads ALL workspace memory entries, then scores them in JS.

**Fix:**
1. Add `tsvector` column to `workspace_memory` with GIN index
2. Use `ts_rank()` in SQL to filter+score, returning only top 10 relevant entries
3. Fallback: if tsvector is too complex, at least filter by category in SQL before the in-memory scoring

**Impact:** Full table scan → indexed text search. Scales from O(N) to O(log N).

#### HIGH: Analytics Page 6 Parallel Queries

**Current:** Analytics page fires queries for vehicles, wash_queue, shifts, notifications, analytics_summary, and kpi_compute on mount.

**Fix:**
1. Create a single `/api/analytics/dashboard` endpoint that returns all 6 data sets in one response (reduces round trips from 6 to 1)
2. Cache the dashboard response for 2 minutes
3. Use SQL aggregates instead of full table dumps for counts

#### MEDIUM: Command Palette Search

**Current:** Searches 6 entity types by loading full tables and filtering in JS.

**Fix:**
1. Add `LIMIT 5` per entity type at the SQL level (already limited in results, but all rows are loaded first)
2. Use `ILIKE` in SQL instead of JS `.toLowerCase().includes()`:
   ```sql
   SELECT * FROM vehicles WHERE plate ILIKE '%query%' OR model ILIKE '%query%' LIMIT 5;
   ```
3. Parallelize the 6 SQL queries with `Promise.all()`

#### MEDIUM: Knowledge Document Search

**Current:** `searchKnowledgeDocuments()` loads all documents, then filters `title`/`filename` in JS.

**Fix:** Use `ILIKE` or `tsvector` in SQL. Add GIN index on `title` if needed.

#### MEDIUM: Missing Pagination

**Current:** No list endpoint supports pagination. `getVehicles()`, `getWashQueue()`, `getShifts()`, `getReservations()` all return all rows.

**Fix:**
1. Add `limit` and `offset` parameters to all list storage methods
2. Add `?page=1&pageSize=50` query params to list endpoints
3. Return `{ data: [...], total: number, page: number, pageSize: number }` pagination envelope
4. **Priority endpoints:** vehicles, reservations, audit log, activity feed, wash queue

#### LOW: Soft-Delete Vehicle Filter

**Current:** `getVehicles()` returns soft-deleted vehicles (WHERE deleted_at IS NULL is not always applied).

**Fix:** Ensure `getVehicles()` defaults to excluding soft-deleted. Add explicit `includeDeleted` parameter for admin views.

### Recommended Additions

**Indexes to add:**
- `workspace_memory(category)` — already used as filter in multiple queries
- `reservations(external_id)` — used for dedup in sync; add if not already present
- Composite index on `kpi_snapshots(kpi_slug, date, station_id)` — covers the most common KPI query pattern

**Caching strategy:**
- In-memory TTL cache (no Redis needed yet): `Map<string, { data, expiry }>`
- Cache keys: `kpi:${stationId}:${from}:${to}`, `dashboard:${stationId}`, `modules`
- TTL: 2-5 minutes for dashboards, 60 minutes for module registry
- Invalidate on writes (busted by the relevant POST/PATCH handler)

**Response shaping:**
- List endpoints should support `?fields=id,plate,status` to reduce payload size
- Nested includes should be opt-in (`?include=evidence,repairOrders`) not default

---

## 11. Operator Onboarding Wizard

### First-Run Detection
Add a workspace config key: `onboarding.completed = false`. The frontend checks this on app load. If false, redirect to `/onboarding`.

### Minimum Required Setup (ordered steps)

**Step 1: Organization Profile**
- Workspace name, timezone, language
- Writes to `workspaceConfig`

**Step 2: Create First Station**
- Name, code, address, timezone
- Cannot proceed without at least one station

**Step 3: Create Admin User** (if not seeded)
- Username, display name, password
- Role = admin, assigned to the station created in Step 2
- Skip if an admin user already exists (e.g., from seed)

**Step 4: Add Vehicles** (optional but recommended)
- Quick-add form: plate, model, category
- Or skip: "I'll add vehicles later"
- Or import: "Upload a CSV" → routes to import flow

**Step 5: First Connector** (optional)
- "Do you use a PMS/reservation system?"
- If yes → guided connector setup (type, credentials, test connection)
- If no → skip

**Step 6: Review & Activate**
- Summary of what was configured
- "Activate workspace" button
- Sets `onboarding.completed = true`
- Redirects to dashboard

### Safe Defaults
| Setting | Default Value |
|---|---|
| Timezone | UTC (overridden in Step 1) |
| Language | English |
| Theme | Dark |
| Modules enabled | All core modules (fleet, wash, calendar, shifts, incidents, analytics) |
| Modules disabled | Executive Intelligence, Digital Twin, Knowledge Base (advanced features) |
| Notification audience | broadcast (everyone sees everything) |
| Shift default | draft status, no auto-publish |
| SLA thresholds | 45min wash, 4h incident response |

### Health Checks
`GET /api/health/onboarding` returns:
```json
{
  "stationsCreated": true,
  "adminUserExists": true,
  "vehiclesLoaded": false,
  "connectorConfigured": false,
  "firstImportComplete": false,
  "automationRulesCreated": false,
  "overallReady": false,
  "missingSteps": ["Add at least 5 vehicles", "Configure a connector or import data"]
}
```

This powers a "Setup Progress" card on the dashboard for the first 30 days.

---

## 12. Pre-Implementation Blockers

### Real Blockers (must fix before Phase 4 coding)

1. **`routes.ts` is 3904 lines.** Phase 4 will add ~1500-2000 more. The file must be split into route modules before adding more routes. Recommended split:
   - `routes/auth.ts` — login, logout, register, user management
   - `routes/fleet.ts` — vehicles, evidence, wash queue
   - `routes/operations.ts` — shifts, incidents, reservations, repair orders, downtime
   - `routes/analytics.ts` — dashboard, KPI, anomalies, briefings
   - `routes/integrations.ts` — connectors, sync jobs, webhooks
   - `routes/ai.ts` — chat, automation draft, incident summary
   - `routes/admin.ts` — trust console, audit, settings, modules, exports
   - `routes/index.ts` — imports all sub-routers, applies global middleware

2. **`storage.ts` is 1264 lines with a 90-method interface.** Same problem — must be split into domain modules before Phase 4 adds ~20-30 more methods. Split mirrors the route split.

3. **No background job infrastructure.** Phase 4 needs it for: export generation, telematics batch processing, usage aggregation, KPI cache refresh. Don't add BullMQ/Redis — build a simple in-process task runner that can be upgraded later.

4. **`user.station` is a single text field.** Phase 4.2's fine-grained permissions need multi-station assignment. This requires a `user_station_assignments` table and migration of the station value from the users table. This must be designed before permission work starts.

### Not Blockers (acceptable as-is)

- `workspaceConfig.key` unique constraint works for single-tenant. Multi-tenant changes it to `(workspaceId, key)` — that's Phase 4.3's job.
- RLS policies use `service_role` bypass — acceptable because auth is app-level. Multi-tenant will eventually add workspace-aware RLS policies.
- No Redis — acceptable for Phase 4.1/4.2 load levels. In-memory TTL cache is sufficient.

---

## 13. Recommended Implementation Order

### Phase 4.0 — Structural Prep (pre-implementation, no features)
1. **Split routes.ts into modules** — 0 feature changes, pure refactor. Run full test suite after.
2. **Split storage.ts into modules** — same.
3. **Add simple in-process task runner** — `TaskRunner.schedule(name, fn, delayMs)` with error handling and logging. Used by exports, telematics, aggregation.

### Phase 4.1 — Safe High-Value *(estimated: 4 items)*

| Order | Item | Depends On | Rationale |
|---|---|---|---|
| 4.1.1 | Performance hardening | 4.0 (split files) | Fixes known hotspots before adding more load. Every subsequent feature benefits. |
| 4.1.2 | Export framework | 4.0 (task runner) | High user demand. Simple schema addition. Uses task runner for background generation. |
| 4.1.3 | Feature tier gating | — | Adds `featureTiers` config + middleware. Non-breaking. Needed before onboarding (so new workspaces get a tier). |
| 4.1.4 | Onboarding wizard | 4.1.3 (tier gating) | Needs tiers to know which modules to enable. Primarily frontend work. |

### Phase 4.2 — Medium-Risk Foundation *(estimated: 5 items)*

| Order | Item | Depends On | Rationale |
|---|---|---|---|
| 4.2.1 | Fine-grained permissions | 4.1.3 (tiers) | Replaces `requireRole()` with `requireCapability()`. Must happen before new subsystems are added, so they use the new model from the start. |
| 4.2.2 | Usage metering | 4.2.1 (permissions) | Meters are placed on capability-gated endpoints. Tier limits enforce via metering. |
| 4.2.3 | Telematics connector | 4.2.1 (permissions) | New capability: `telematics.view`, `telematics.manage`. Needs the permission model. |
| 4.2.4 | Maintenance/workshop | 4.2.3 (telematics) | Workshop integration benefits from telematics data (engine codes → auto-create repair suggestions). |
| 4.2.5 | Digital Twin simulation | 4.2.2 (metering) | Simulation runs are metered. Uses existing staffing/KPI formulas as baseline. |

### Phase 4.3 — Multi-Tenant *(single item, high coordination)*

| Order | Item | Depends On | Rationale |
|---|---|---|---|
| 4.3.1 | Multi-tenant workspace isolation | ALL of 4.2 | Every table from 4.1/4.2 exists and is stable. Single coordinated migration adds `workspaceId` to all ~50 tables. Test suite validates no cross-tenant leaks. |

---

## 14. Success Criteria

### Phase 4.1 Gate
- [ ] KPI compute route responds in <200ms for a 500-vehicle fleet (currently unbounded)
- [ ] All list endpoints support pagination with `page` + `pageSize` params
- [ ] Export framework generates incident pack, KPI report, and reservation CSV correctly
- [ ] Approval flow works: sensitive exports require admin sign-off
- [ ] Feature tier middleware blocks gated features with correct 403 response
- [ ] Onboarding wizard completes a full first-run flow: org → station → user → vehicles → activate
- [ ] 0 type errors, all existing 547 + new tests pass, clean build
- [ ] routes.ts is split into ≤8 files, none exceeding 800 lines

### Phase 4.2 Gate
- [ ] `requireCapability()` replaces all `requireRole()` calls in routes
- [ ] Trust Console shows live capability matrix (not static)
- [ ] Usage metering records AI requests, sync jobs, exports, simulations
- [ ] Tier limits are enforced: exceeding monthly AI request limit returns 429
- [ ] Telematics connector ingests vehicle events, matches by VIN, updates mileage/fuel
- [ ] Telematics does NOT auto-update vehicle status or station assignment
- [ ] Simulation runs produce queue throughput + staffing sufficiency + utilization projections
- [ ] Simulation outputs show assumptions and confidence bands, no false precision
- [ ] Workshop integration extends repair orders with parts/labor tracking
- [ ] 0 type errors, all tests pass, clean build

### Phase 4.3 Gate
- [ ] Every table has `workspaceId` column with NOT NULL constraint
- [ ] Every storage method filters by workspace
- [ ] Cross-tenant data access returns empty results (not errors)
- [ ] A test creates 2 workspaces and verifies zero data leakage across 10 entity types
- [ ] Session correctly resolves workspace from subdomain/header
- [ ] Onboarding creates a new workspace with isolated data
- [ ] Existing single-tenant deployment migrates to workspace #1 seamlessly
- [ ] 0 type errors, all tests pass, clean build

### Overall Phase 4 Success
- Product supports 2+ independent operators on the same deployment
- Each operator sees only their data
- AI, sync, and export usage is tracked and enforceable per tier
- Telematics data flows into the system without human babysitting
- Simulations help operators make staffing decisions without fake confidence
- Exports serve compliance and reporting needs
- Performance handles 500+ vehicles per workspace without degradation

---

## 15. Anti-Roadmap for Phase 4

### Explicitly Rejected Ideas

**1. Real-time GPS tracking on a map.**
GPS events should be stored and queryable, but building a live vehicle tracking map is a product unto itself. Leaflet/Mapbox integration, real-time WebSocket streaming of coordinates, and map state management are a Phase 5+ concern. Phase 4 stores the data. Phase 5 visualizes it.

**2. ML-powered demand forecasting.**
The product does not have enough historical data to train meaningful models. Staffing recommendations should remain formula-based with operator-configurable weights. Adding "AI-powered predictions" that are actually linear extrapolations dressed up in ML terminology is dishonest and will erode trust.

**3. Stripe/payment integration.**
Usage metering in Phase 4 tracks consumption. Billing is a Phase 5 concern. Building Stripe integration now couples the codebase to payment infrastructure before the pricing model is validated. Meter first, bill later.

**4. Schema-per-tenant or database-per-tenant.**
Evaluated and rejected in Section 4. Row-level `workspaceId` is the only viable option for Railway/single-Postgres.

**5. Full RBAC admin UI with drag-and-drop permission assignment.**
Phase 4.2 adds capability tables and enforcement. The admin UI should be a simple table view with checkboxes: role × capability. Fancy drag-and-drop permission builders are premature UI investment.

**6. Redis/BullMQ job queue.**
Phase 4 does not have the volume to justify a separate Redis service. In-process task runner with `setImmediate` + error handling is sufficient for <100 background jobs/day. If Phase 5 needs queue persistence across restarts, add Redis then.

**7. GraphQL or API versioning.**
The REST API is internal (consumed by the React frontend only). Adding GraphQL complexity or API versioning (/v1/, /v2/) solves a problem that doesn't exist. The frontend and backend are deployed together — no backward compatibility concern.

**8. Kafka/event streaming for telematics.**
Tempting for telematics event ingestion. Overkill for the expected volume (hundreds of vehicles, not millions). Direct webhook/polling → Postgres is sufficient. Kafka is Phase 6 if the product hits 10k+ vehicles.

**9. Multi-region deployment.**
Railway deploys to a single region. Multi-region replication is an infrastructure concern for when there are customers who need it. Not a Phase 4 coding concern.

**10. White-labeling / custom themes per tenant.**
Multi-tenant isolation (Phase 4.3) is about data separation, not visual customization. Custom logos, colors, and domain names are a Phase 5 premium feature, not a Phase 4 architecture concern.
