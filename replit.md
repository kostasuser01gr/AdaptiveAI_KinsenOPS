# DriveAI Workspace

## Overview
AI-native operating system for car rental operations. Chat-first, multi-tool, installable PWA with staff operations, two isolated satellite apps (washer kiosk, customer portal), and a comprehensive AI intelligence layer.

## Architecture
- **Frontend**: React 19 + Vite + TailwindCSS v4 + shadcn/ui + wouter routing
- **Backend**: Express 5 + TypeScript + PostgreSQL + Drizzle ORM
- **Auth**: Passport.js with local strategy, session-based with `connect-pg-simple`
- **State**: TanStack React Query for server state, React Context for UI state

## Database Schema (23 tables)
- `users` - Staff accounts with roles (admin, coordinator, supervisor, agent), station assignment
- `user_preferences` - Personal workspace isolation (userId, scope, category, key, jsonb value)
- `stations` - Physical station locations with timezone, code, address
- `chat_conversations` / `chat_messages` - Chat threads and messages per user
- `vehicles` - Fleet with plate, model, category, station, mileage, fuel, soft-delete via `deleted_at`
- `vehicle_evidence` - Photos, damage, voice notes, inspections linked to vehicles
- `wash_queue` - Washer operations queue with proof photos, SLA tracking
- `shifts` - Weekly schedules with fairness/fatigue scores, `published_by`/`published_at` tracking
- `shift_requests` - Employee shift change/swap/time-off requests with review workflow
- `notifications` - Ops inbox alerts/approvals with severity
- `custom_actions` - AI-generated UI elements with versioning
- `automation_rules` - Event-driven rules with triggers, conditions, actions, `scope` (personal/shared)
- `audit_log` - Immutable action log for compliance
- `entity_rooms` / `room_messages` - Collaboration rooms per entity
- `workspace_memory` - Organizational genome (policies, SOPs, preferences)
- `digital_twin_snapshots` - Live operational state snapshots per station
- `system_policies` - Governance policy engine (rules, enforcement levels, scoping)
- `activity_feed` - Real-time event distribution (actor, action, entity, station)
- `module_registry` - Plug-and-unplug module architecture (slug, route, role gate, ordering)
- `workspace_config` - Tenant-level configuration (key-value, categories)
- `file_attachments` - Evidence & file pipeline (entity linking, metadata)

## Role-Based Access Control
- **admin**: Full access, user management, vehicle restore, all shift operations, system policies, workspace config, module management
- **coordinator**: Shift create/edit/publish, vehicle delete, station management, executive intelligence
- **supervisor**: Shift create/edit/publish, audit log access, workspace memory write, vehicle delete, user list view, trust console, system policies read
- **agent**: View published shifts, submit shift requests, standard fleet/wash operations

## Sidebar Role-Based Visibility
- Operations section: visible to all roles
- Intelligence section: Executive Intel hidden below coordinator level
- Platform section: AI Memory hidden below coordinator level
- Governance section (Trust Console, Users): visible only to supervisor+ roles
- Module counts/badges on sidebar items from dashboard stats API (live refresh)
- User menu shows role badge with color coding and station assignment

## Chat Slash Commands
- `/fleet` - Fleet status overview with live stats
- `/wash` - Wash queue summary
- `/shifts` - Shift coverage check with pending requests
- `/stats` - Full platform statistics aggregate
- `/navigate <module>` - Direct navigation to any module
- `/warroom` - Active incident overview
- `/memory` - Query workspace knowledge
- Entity mentions with `@entity` syntax (e.g., @YHA-1234)
- Tool call visualization with status indicators

## Notification Drawer
- Slide-out notification panel from bell icon
- Mark individual/all as read
- Severity-based icons (critical=red, warning=amber, info=blue)
- Activity feed integration showing recent platform events
- Auto-refresh every 15 seconds

## Command Palette (⌘K)
- Live entity search (vehicles by plate, users by name, stations by code)
- Search results with type-appropriate icons and navigation
- Quick actions, operations, intelligence, governance, settings groups
- Custom AI-generated actions integration

## Shift Management
- Only admin/coordinator/supervisor can create, edit, publish shifts
- Agents/washers see only published schedules
- Shift request workflow: agents submit requests → supervisors approve/deny
- Publish endpoint: `POST /api/shifts/:id/publish` tracks who published and when

## Personal Workspace Isolation
- `user_preferences` table stores per-user settings (layout, AI language, notifications, widgets)
- Upsert logic: same userId+category+key = update existing
- Settings → "My Workspace" tab for personal preferences

## Automation Rules Scope
- `scope: "shared"` visible to all users
- `scope: "personal"` visible only to creator
- API returns shared + user's own personal rules

## Vehicles
- Soft-delete via `deleted_at` column; `getVehicles()` filters out deleted
- Restore endpoint: `POST /api/vehicles/:id/restore` (admin only)
- Vehicle Intelligence: damage heatmap body diagram, predictive readiness scoring, utilization forecast

## Pages & Modules
### Staff Main App (requires auth)
- **Chat**: ChatGPT-style with adaptive AI Builder, slash commands, entity mentions, tool call visualization, model selector
- **Fleet Ops**: Vehicle CRUD, search, status, SLA, soft-delete/restore
- **Washers Queue**: Real-time assign/complete workflow
- **Shifts**: Weekly grid with role-gated controls, publish workflow, shift requests
- **Ops Inbox**: Notifications with severity
- **Digital Twin**: Mission control, station cards, risk forecasts, AI insights
- **Executive Intelligence**: Weekly briefs, KPIs, risk taxonomy, patterns (coordinator+)
- **Vehicle Intelligence**: Evidence timeline, damage heatmap with body diagram, predictive readiness, vehicle memory with confidence scores
- **War Room**: Entity rooms, crisis mode, real-time collaboration
- **Automation Builder**: Event-driven rules CRUD, personal/shared scope
- **Workspace Memory**: Organizational genome, AI learning, SOPs
- **Trust Console**: Audit trail, privacy zones, access control, retention (supervisor+)
- **Data Imports**: Drag-drop upload, AI column mapping with confidence, diff viewer, templates
- **Analytics, Calendar, Shortcuts, Knowledge Base, Users, Settings**

### Satellite Apps (no staff auth)
- **Washer Kiosk** (`/washer`): Ultra-fast queue registration, numeric pad, large touch targets
- **Customer Portal** (`/customer`): QR/reservation entry → guided photo capture, evidence submission

## API Routes (all prefixed `/api`)
- Auth: register, login, logout, me
- CRUD: vehicles (with soft-delete/restore), wash-queue, shifts (with publish), notifications, conversations, messages, custom-actions
- Extended: stations, automation-rules, audit-log, entity-rooms, room-messages, workspace-memory, digital-twin, vehicle evidence, users, user-preferences, shift-requests
- Platform: system-policies, activity-feed, module-registry, workspace-config, file-attachments, dashboard-stats, search, system-health

## Demo Credentials
- `admin` / `admin123` (admin role)
- `maria` / `maria123` (coordinator, ATH-MAIN)
- `john` / `john123` (agent, ATH-MAIN)
- `giorgos` / `giorgos123` (supervisor, ATH-MAIN)
- `elena` / `elena123` (supervisor, SKG-01)
- `nikos` / `nikos123` (agent, ATH-MAIN)
- `costas` / `costas123` (agent, SKG-01)

## Design Tokens
- Background: `270 6% 6%`, Primary: `262 65% 60%`
- Fonts: Inter + JetBrains Mono, Radius: `0.75rem`
- Default theme: DARK
- Role badge colors: admin=red, supervisor=amber, coordinator=blue, agent=green
