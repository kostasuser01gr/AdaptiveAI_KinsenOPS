# Incident Response Runbook — DriveAI Week-1

## 1. Triage checklist (< 2 min)

| Step | Action |
|------|--------|
| 1 | Open `/healthz` — is DB reachable? (`ok` vs `degraded`) |
| 2 | Check `/api/system-health` (admin) — errorRate, avgResponseTime, `week1` counters |
| 3 | Check Railway logs for `[ERROR]` entries. Use the `requestId` (also in the `X-Request-Id` response header) to correlate user reports to server log lines |
| 4 | Check WebSocket: `system-health → websocket.totalClients`. If 0 on a weekday, WS may be down |

## 2. Common failure modes

### 2a. Database unreachable
**Symptoms:** `/healthz` returns 503 / `degraded`. All API calls fail with 500.  
**Action:**
1. Check Supabase dashboard for connection limits / service status
2. Verify `DATABASE_URL` env var in Railway
3. Railway → Restart service

### 2b. Auth failures spiking
**Signal:** `week1.authFailures` climbing fast in `/api/system-health`  
**Action:**
1. Check if a credential-stuffing attack — look for many distinct IPs in Railway logs
2. Rate limiter (`authLimiter`) is set to 20 req/15 min per IP — confirm it's active
3. If legitimate users locked out: tell them to wait 15 min or restart the service to clear in-memory rate windows

### 2c. Import pipeline stuck
**Signal:** `week1.importFailures` > 0, user reports import stuck in "processing"  
**Action:**
1. Check import record status: `GET /api/imports` (admin)
2. If stuck in `uploading` or `mapping`: POST `/api/imports/{id}/fail` with `{"errorMessage": "Cleared by operator"}`, then ask user to re-upload
3. If commit failed: check DB logs for constraint violations

### 2d. WebSocket disconnects spiking
**Signal:** `week1.wsDisconnects` climbing fast  
**Action:**
1. Check Railway memory usage — OOM can kill WS connections
2. Client auto-reconnects with exponential backoff (1s → 30s). If users still see "Offline", the server process may have crashed
3. Check Railway deployment logs for restart events

### 2e. AI chat errors
**Signal:** `week1.aiRequestFailures` > 0  
**Action:**
1. Check `ANTHROPIC_API_KEY` env var is set in Railway
2. Check Anthropic status page
3. AI is simulated when no API key is set — this is expected in demo mode

### 2f. Public flow (customer/washer) errors
**Signal:** `week1.publicFlowErrors` > 0  
**Action:**
1. Only `reservation` and `washer-ops` entity types are allowed on public endpoints
2. If 403s: someone is trying entity types not in the whitelist — this is working as intended
3. If 400s: check Zod validation errors in logs for malformed requests

## 3. Escalation path

| Severity | Criteria | Response time | Who |
|----------|----------|---------------|-----|
| P1 | Service fully down, DB unreachable | < 15 min | On-call operator |
| P2 | Feature broken for all users (imports, auth) | < 1 hour | On-call operator |
| P3 | Feature degraded, workaround exists | < 4 hours | Engineering |
| P4 | Cosmetic, known issue | Next business day | Engineering |

## 4. Recovery actions

| Action | Command / URL |
|--------|--------------|
| Restart service | Railway dashboard → service → Restart |
| Check DB connectivity | `curl $RAILWAY_URL/healthz` |
| View live metrics | `curl -H "Cookie: ..." $RAILWAY_URL/api/system-health` (admin session) |
| View week-1 counters | Same as above — `week1` field in response |
| Clear stuck import | `POST /api/imports/{id}/fail` with `{"errorMessage":"Cleared by operator"}` |
| View user feedback | `GET /api/feedback` (admin) |
| Force re-seed (dev only) | Set `SEED_DATABASE=true` + restart (NEVER in production with real data) |

## 5. Seed leakage guard

The seed function creates demo users with weak passwords (admin123, etc.).  
**Guard:** Only runs when `NODE_ENV !== "production"` OR `SEED_DATABASE === "true"`.  
**Action:** Verify in Railway that `SEED_DATABASE` is NOT set to `true` in production.  
If it was accidentally set and users were seeded, immediately:
1. Remove `SEED_DATABASE` env var
2. Change passwords for all seeded accounts via DB
3. Rotate the `SESSION_SECRET`
