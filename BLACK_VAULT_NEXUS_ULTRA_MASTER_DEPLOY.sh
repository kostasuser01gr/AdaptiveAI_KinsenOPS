#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

TARGET_REPO="${1:-.}"
DEPLOYMENT_ENV="${2:-development}"
REMOTE_APPLY="${BLACK_VAULT_REMOTE_APPLY:-0}"

echo "BLACK_VAULT_NEXUS_ULTRA MASTER DEPLOYMENT"
echo "========================================"
echo "Repository: $TARGET_REPO"
echo "Environment: $DEPLOYMENT_ENV"
echo "Remote GitHub apply: $REMOTE_APPLY"

echo
echo "[1/6] Initialize local Black Vault state"
BLACK_VAULT_REMOTE_APPLY=0 bash scripts/github-cli/bv-init.sh "$TARGET_REPO"

echo
echo "[2/6] Build inventory"
bash scripts/hardening/build-inventory.sh >/dev/null
echo "Inventory refreshed: .black-vault/Inventory.tsv"

echo
echo "[3/6] Run gate suite"
bash scripts/run-all-gates.sh

echo
echo "[4/6] Record NEXUS ledgers"
bash scripts/ci/record-metrics.sh

echo
echo "[5/6] Generate compliance report"
bash scripts/github-cli/generate-compliance-report.sh

echo
echo "[6/6] Optional GitHub automation"
if [ "$REMOTE_APPLY" = "1" ]; then
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    bash scripts/github-cli/gh-config.sh "$TARGET_REPO"
    bash scripts/github-cli/enforce-branch-protection.sh "$TARGET_REPO"
    bash scripts/github-cli/update-project.sh "$TARGET_REPO"
    bash scripts/github-cli/sync-findings.sh "$TARGET_REPO" || true
    bash scripts/github-cli/create-scan-tasks.sh "$TARGET_REPO" || true
  else
    echo "gh is unavailable or not authenticated; skipped remote GitHub automation"
  fi
else
  echo "Remote GitHub automation disabled. Set BLACK_VAULT_REMOTE_APPLY=1 to enable."
fi

echo
python3 - "$ROOT_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
snapshot = json.loads((root / ".black-vault" / "NexusSnapshot.json").read_text())

print("Deployment summary")
print("------------------")
print(f"Compliance score: {snapshot['compliance_score']}%")
print(
    "Scan coverage: "
    f"{snapshot['scan']['complete']}/{snapshot['scan']['total']} files "
    f"({snapshot['scan']['coverage_pct']}%)"
)
print(f"Open findings: {snapshot['findings']['open']}")
print(f"SLA breaches: {snapshot['sla']['summary']['overdue']}")
print(f"Latest gate run: {snapshot['gate_run_id'] or 'n/a'}")
print("Report: BLACK_VAULT_HARDENING_REPORT.md")
PY
