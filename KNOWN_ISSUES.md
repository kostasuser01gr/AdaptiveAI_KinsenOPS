# Known Issues — Release Candidate

Last updated: Post-launch stabilization (Week-1)

## Deferred / Non-Blocking

### 1. Sidebar Imports Visibility vs Module Registry
- **What**: Sidebar shows "Imports" to all roles; module registry seeds it as `coordinator+`.
- **Impact**: **Low** — backend enforces authorization correctly. Agents see the link but data is correctly scoped.
- **Workaround**: None needed — no data leaks.
- **Monitoring signal**: N/A (cosmetic only).
- **Becomes blocking if**: Users report confusion about empty Imports page.
- **Fix**: Align sidebar role gating with module registry `requiredRole`.

### 2. QR Code Scanner (Customer Portal)
- **What**: The "Scan QR Code" button on the customer entry page is rendered but does not invoke a camera/QR library.
- **Impact**: **Low** — manual reservation entry works correctly.
- **Workaround**: Customers type the reservation number manually (e.g. RES-99821).
- **Monitoring signal**: `week1.publicFlowErrors` — watch for 400s on `/api/public/rooms/resolve`.
- **Becomes blocking if**: High volume of customers can't enter reservations manually.
- **Fix**: Integrate `html5-qrcode` in a follow-up.

### 3. Chat AI Responses Are Simulated
- **What**: Chat generates responses locally with simulated delays unless `ANTHROPIC_API_KEY` is set.
- **Impact**: **Expected for MVP** — slash commands, proposals, and tool calls work.
- **Workaround**: Set `ANTHROPIC_API_KEY` in Railway env for real AI.
- **Monitoring signal**: `week1.aiRequestFailures` — if > 0 with API key set, check key validity.
- **Becomes blocking if**: Operator depends on AI for real decision support.
- **Fix**: Wire up Anthropic streaming when AI budget approved.

### 4. File Upload Pipeline Is Metadata-Only
- **What**: Imports page creates import records with metadata but does not stream file bytes to S3/Supabase storage.
- **Impact**: **Medium** — the full import lifecycle UI works end-to-end using metadata.
- **Workaround**: Import records track file info; actual data transformation is manual.
- **Monitoring signal**: `week1.importFailures` — watch for failures on `/process` or `/confirm`.
- **Becomes blocking if**: Operators need bulk CSV ingestion to replace manual data entry.
- **Fix**: Add Supabase Storage bucket + `multer` middleware.

### 5. Digital Twin Data Is Snapshot-Based
- **What**: Digital twin uses seeded snapshot data, not real-time aggregation.
- **Impact**: **Low for demo** — UI renders correctly with realistic data.
- **Workaround**: None needed for demo/pilot.
- **Monitoring signal**: N/A.
- **Becomes blocking if**: Ops team needs real-time fleet health dashboards.
- **Fix**: Add real-time aggregation queries on vehicle/shift/wash tables.

### 6. No Email/SMS Notification Delivery
- **What**: Notifications are in-app only; no email or SMS integration.
- **Impact**: **Expected for MVP** — visible in Ops Inbox and banners.
- **Workaround**: Users check Ops Inbox regularly; unread badge shows count.
- **Monitoring signal**: Check if unread notification count grows unbounded (users never see them).
- **Becomes blocking if**: Critical alerts (vehicle breakdown, shift no-show) are missed.
- **Fix**: Add SendGrid/Twilio integration.

### 7. PWA Offline Mode Is Read-Only
- **What**: Service worker caches assets and shows offline banner, but only Washer Register has a true offline queue.
- **Impact**: **Low** — most staff workflows require connectivity.
- **Workaround**: If offline, ConnectionBanner shows warning. Queued actions sync on reconnect (washer flow only).
- **Monitoring signal**: `week1.wsDisconnects` — elevated count may indicate flaky connectivity at sites.
- **Becomes blocking if**: Field staff frequently lose connectivity during vehicle inspections.
- **Fix**: Add IndexedDB sync for critical write paths.

## Resolved in Prior Releases

- **Public Room Enumeration (Blocker)**: Unauthenticated callers could read/write any room by incrementing IDs. Fixed: `PUBLIC_ROOM_ENTITY_TYPES` whitelist with `z.enum()` on resolve + `isPublicRoomType()` guard. 16 tests added.
- **Import Commit Wrong Endpoint**: Fixed to use `/confirm`, `/fail`, `/retry` state-machine endpoints.
- **No Failed Imports Tab**: Added "Failed" tab with retry button.
- **Not-Found Page Developer Message**: Updated to user-friendly 404 with back button.
- **Seed Data Missing Imports/Proposals/Activity**: Added sample records.
- **Notification Assign Missing Validation**: Added `notificationAssignSchema` with `.strict()`.
- **Missing `.env.example` Production Notes**: Added `NODE_ENV`, `SEED_DATABASE`, `PORT` docs.
