#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state
resolve_repo "${1:-.}"

dashboard_body="$(python3 <<'PY'
import json
from pathlib import Path

inventory_total = 0
scan_complete = 0
total_findings = 0
open_findings = 0
verified_findings = 0

inventory_path = Path(".black-vault/Inventory.tsv")
if inventory_path.exists():
    inventory_total = max(len(inventory_path.read_text().splitlines()) - 1, 0)

try:
    scan_ledger = json.loads(Path(".black-vault/ScanLedger.json").read_text())
except Exception:
    scan_ledger = []

scan_complete = sum(1 for item in scan_ledger if item.get("status") == "COMPLETE")

try:
    findings = json.loads(Path(".black-vault/FindingsRegister.json").read_text())
except Exception:
    findings = []

total_findings = len(findings)
open_findings = sum(1 for item in findings if item.get("status") == "OPEN")
verified_findings = sum(1 for item in findings if item.get("status") == "VERIFIED")

body = f"""# Black Vault Hardening Dashboard

## Progress

| Metric | Value |
| --- | --- |
| Files inventoried | {inventory_total} |
| Files fully scanned | {scan_complete} |
| Findings total | {total_findings} |
| Findings open | {open_findings} |
| Findings verified | {verified_findings} |

## Next Actions

- Run `bash scripts/github-cli/create-scan-tasks.sh` after inventory changes.
- Run `bash scripts/run-all-gates.sh` before merging scan or remediation PRs.
- Keep `.black-vault/FindingsRegister.json` in sync with GitHub issues.
"""

print(body)
PY
)"

dashboard_number="$(gh issue list --repo "$GH_REPO" --state all --search "\"Black Vault Hardening Dashboard\" in:title" --limit 1 --json number --jq '.[0].number // ""')"

if [ -n "$dashboard_number" ]; then
  gh issue edit "$dashboard_number" --repo "$GH_REPO" --title "Black Vault Hardening Dashboard" --body "$dashboard_body" >/dev/null
else
  gh issue create --repo "$GH_REPO" --title "Black Vault Hardening Dashboard" --body "$dashboard_body" >/dev/null
fi

echo "Dashboard issue updated"
