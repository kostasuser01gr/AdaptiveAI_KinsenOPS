# Deploy Smoke Checklist — AdaptiveAI

```bash
# Set your deployed base URL (no trailing slash)
export BASE_URL="https://your-app.up.railway.app"
```

---

## 1. Infrastructure

### 1.1 Health Check
```bash
curl -sf "$BASE_URL/healthz" | jq .
```
- **Method:** `GET /healthz`
- **Expected:** `200` (or `503` if DB unreachable)
- **Verify:** `status` is `"ok"`, `checks.database` is `"connected"`, `uptime` > 0

### 1.2 Static Frontend Loads
```bash
curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/"
```
- **Expected:** `200`

---

## 2. Auth

### 2.1 Register
```bash
curl -sf -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -c cookie.txt \
  -d '{"username":"smoke_test_user","password":"SmokeT3st!x","displayName":"Smoke Test"}' | jq .
```
- **Expected:** `201`
- **Verify:** `id`, `username`, `role` (default `"agent"`), no `password` field

### 2.2 Login
```bash
curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookie.txt \
  -d '{"username":"smoke_test_user","password":"SmokeT3st!x"}' | jq .
```
- **Expected:** `200`
- **Verify:** `id`, `username`, `workspaceId`; no `password` field

### 2.3 Session
```bash
curl -sf "$BASE_URL/api/auth/me" -b cookie.txt | jq .
```
- **Expected:** `200`

### 2.4 Unauthenticated Rejection
```bash
curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me"
```
- **Expected:** `401`

### 2.5 Logout
```bash
curl -sf -X POST "$BASE_URL/api/auth/logout" -b cookie.txt | jq .
```
- **Expected:** `200`

---

## 3. Core API

### 3.1 Vehicles
```bash
curl -sf "$BASE_URL/api/vehicles" -b cookie.txt | jq 'length'
```
- **Expected:** `200`, JSON array

### 3.2 Wash Queue (Public)
```bash
curl -sf "$BASE_URL/api/wash-queue" | jq 'length'
```
- **Expected:** `200`, JSON array

### 3.3 Repair Orders
```bash
curl -sf "$BASE_URL/api/repair-orders" -b cookie.txt | jq 'length'
```
- **Expected:** `200`

### 3.4 Dashboard Stats
```bash
curl -sf "$BASE_URL/api/dashboard-stats" -b cookie.txt | jq .
```
- **Expected:** `200`

---

## 4. WebSocket

```bash
curl -sf -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "$BASE_URL/ws"
```
- **Expected:** `101` Switching Protocols

---

## 5. Background Tasks (admin only)

### 5.1 Task States
```bash
curl -sf "$BASE_URL/api/tasks" -b cookie.txt | jq .
```
- **Expected:** `200`
- **Verify:** Task IDs: `sla-breach-check`, `kpi-snapshots`, `anomaly-detection`, `connector-sync`, `export-processor`, `export-cleanup`

### 5.2 Manual Trigger
```bash
curl -sf -X POST "$BASE_URL/api/tasks/export-processor/trigger" -b cookie.txt | jq .
```
- **Expected:** `200`

---

## 6. Observability (admin only)

### 6.1 System Health
```bash
curl -sf "$BASE_URL/api/system-health" -b cookie.txt | jq .
```
- **Expected:** `200`
- **Verify:** `status` is `"operational"`, `checks.database` is `"connected"`

### 6.2 Metrics
```bash
curl -sf "$BASE_URL/api/metrics" -b cookie.txt | jq .
```
- **Expected:** `200`

---

## 7. Quick Pass/Fail Script

```bash
echo "=== SMOKE TEST ==="
echo -n "healthz:       "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/healthz"
echo ""
echo -n "register:      "; curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" -c cookie.txt -d '{"username":"smoke_'$RANDOM'","password":"Sm0kePass!xx","displayName":"Smoker"}'
echo ""
echo -n "me:            "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me" -b cookie.txt
echo ""
echo -n "vehicles:      "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/vehicles" -b cookie.txt
echo ""
echo -n "wash-queue:    "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/wash-queue"
echo ""
echo -n "repair-orders: "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/repair-orders" -b cookie.txt
echo ""
echo -n "dash-stats:    "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/dashboard-stats" -b cookie.txt
echo ""
echo -n "system-health: "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/system-health" -b cookie.txt
echo ""
echo -n "tasks:         "; curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks" -b cookie.txt
echo ""
echo "=== END ==="
```

**Expected:** All lines show `200` (or `201` for register). Any `4xx`/`5xx` = investigate.

---

## 8. Cleanup

After smoke testing, remove the test user to avoid leaving temporary credentials:

```bash
# Delete the smoke test user (requires admin session cookie)
SMOKE_USER_ID=$(curl -sf "$BASE_URL/api/users" -b cookie.txt | jq '.[] | select(.username | startswith("smoke_")) | .id')
if [ -n "$SMOKE_USER_ID" ]; then
  curl -sf -X DELETE "$BASE_URL/api/users/$SMOKE_USER_ID" -b cookie.txt -w "\nDeleted user $SMOKE_USER_ID: %{http_code}\n"
fi
rm -f cookie.txt
```

**Verify:** No `smoke_*` users remain in `/api/users`.
