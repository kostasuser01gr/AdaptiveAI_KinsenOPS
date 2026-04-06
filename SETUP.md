# Setup Guide

This guide will help you set up and run the Car Rental Operations Platform.

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- (Optional) Anthropic API key for AI features

## Environment Configuration

### Step 1: Get Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project or create a new one
3. Navigate to **Project Settings** > **API**
   - Copy the **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - Copy the **anon/public** API key

### Step 2: Get Database Connection String

1. In Supabase Dashboard, go to **Project Settings** > **Database**
2. Scroll to **Connection String** section
3. Select **Session Pooler** mode (recommended for production)
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your database password

The connection string format:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   SESSION_SECRET=generate-a-secure-random-string
   ```

3. Generate a secure SESSION_SECRET:
   ```bash
   openssl rand -base64 32
   ```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Database Setup

The database tables are automatically created via Supabase migrations. The migrations are already applied if you used the Supabase MCP integration.

If you need to verify or re-apply migrations manually:

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Push migrations:
   ```bash
   supabase db push
   ```

### Step 6: Seed Database (Development Only)

The application will automatically seed the database with demo data in development mode on first run.

Default admin credentials:
- Username: `admin`
- Password: `admin123`

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5000`
- Backend API: `http://localhost:5000/api`
- WebSocket: `ws://localhost:5000/ws`

### Production Build

```bash
npm run build
npm start
```

## Optional: AI Features

To enable AI chat features, add your Anthropic API key to `.env`:

```env
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

Get an API key from [Anthropic Console](https://console.anthropic.com).

## Troubleshooting

### Database Connection Errors

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solution**: Make sure `DATABASE_URL` is set in your `.env` file with the correct Supabase connection string.

### Rate Limiter Errors

**Error**: `ValidationError: Custom keyGenerator appears to use request IP`

**Solution**: This is fixed in the latest version. Pull the latest changes and restart.

### Session Secret Missing

**Error**: `Auth runtime is missing SESSION_SECRET`

**Solution**: Add `SESSION_SECRET` to your `.env` file:
```bash
SESSION_SECRET=$(openssl rand -base64 32)
```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use`

**Solution**: Kill the process using port 5000:
```bash
lsof -ti:5000 | xargs kill -9
```

Or change the port in `server/index.ts`.

## Security Checklist

Before deploying to production:

- [ ] Change default admin password
- [ ] Set secure `SESSION_SECRET` (32+ character random string)
- [ ] Update database password from default
- [ ] Use Supabase connection pooler (not direct connection)
- [ ] Enable Supabase RLS policies (already done)
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates
- [ ] Review security settings in `SECURITY.md`

## Project Structure

```
.
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and hooks
├── server/              # Backend Express application
│   ├── middleware/      # Custom middleware (auth, validation, etc.)
│   ├── observability/   # Logging and metrics
│   └── routes.ts        # API routes
├── shared/              # Shared TypeScript types
│   └── schema.ts        # Database schema (Drizzle ORM)
├── supabase/            # Database migrations
│   └── migrations/
└── tests/               # Test files
```

## Support

For issues and questions:
1. Check `SECURITY.md` for security-related questions
2. Review this setup guide and troubleshooting section
3. Check application logs for error details

## Next Steps

After setup:
1. Log in with admin credentials
2. Create stations and configure locations
3. Add vehicles to the fleet
4. Create user accounts for your team
5. Configure automation rules

## Health & Diagnostics

### Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /healthz` | None | Railway health check — verifies DB connectivity, returns 503 if degraded |
| `GET /api/system-health` | admin, supervisor | Full diagnostics — DB check, memory, metrics, WebSocket stats, error rate |
| `GET /api/metrics` | admin | Raw request metrics (in-memory, resets on restart) |

### Health response

```json
{
  "status": "ok | degraded",
  "uptime": 12345,
  "checks": { "database": "connected | unreachable" },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Railway uses `/healthz` with a 120s timeout. If the database is unreachable, the endpoint returns 503 so Railway can trigger a restart (ON_FAILURE policy, max 10 retries).

## Deployment

### Railway (Backend)

```bash
# Railway reads railway.json for build/start/healthcheck config
# Environment variables to set in Railway dashboard:
DATABASE_URL=<supabase-connection-string>
SESSION_SECRET=<32-char-random>
NODE_ENV=production
```

### Vercel (Frontend)

The frontend is deployed via Vercel. `vercel.json` rewrites `/api/*` to the Railway backend.

```bash
# No special config needed — connect the repo to Vercel
# The build command (npm run build) and output directory (dist/public) are configured
```

## Migration Workflow

Migrations live in `supabase/migrations/` and are numbered sequentially:

| # | File | Purpose |
|---|---|---|
| 001 | `20260324155108_001_initial_schema_simple.sql` | Core tables (users, vehicles, stations, etc.) |
| 002 | `20260324160235_002_add_foreign_key_indexes_and_rls.sql` | FK indexes + RLS on all core tables |
| 003 | `20260405000000_003_add_imports_table.sql` | imports table for data pipeline |
| 003b | `20260405_003_notifications_reads_and_recipients.sql` | Notification targeting + per-user reads |
| 004 | `20260406_004_workspace_proposals.sql` | Workspace proposals |
| 005 | `20260407_005_production_hardening.sql` | RLS for proposals/imports/reads, audit index |

All migrations use `CREATE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` and are safe to re-run.

### Applying migrations

```bash
supabase db push       # Push all pending migrations
# OR
npm run db:push        # Uses drizzle-kit to sync schema
```

### Rollback

Migrations are additive — there are no destructive operations. To undo a change, create a new migration that reverses it (e.g., `DROP INDEX IF EXISTS ...`).

## Operator Runbook

### Import Pipeline States

```
uploading → mapping → reviewing → completed
                ↘ failed ↗ (retry resets to uploading)
```

| API | From State | To State |
|---|---|---|
| `POST /api/imports/:id/process` | uploading | reviewing |
| `POST /api/imports/:id/confirm` | reviewing | completed |
| `POST /api/imports/:id/fail` | any active | failed |
| `POST /api/imports/:id/retry` | failed | uploading |

### Policy Execution

Policies stored via `POST /api/system-policies` can be evaluated:

```bash
# Dry run (preview what would happen)
POST /api/system-policies/:id/evaluate?dryRun=true

# Execute (e.g., delete stale audit log entries)
POST /api/system-policies/:id/evaluate
```

Retention policies use `rule.maxAgeDays` and `rule.entityType` to target data for cleanup. All executions are audit-logged.

### Exports

| Endpoint | Format | Content |
|---|---|---|
| `GET /api/analytics/export` | CSV | Daily trends + summary metrics |
| `GET /api/audit-log/export` | CSV | Full audit log (up to 10,000 entries) |
6. Customize workspace settings
