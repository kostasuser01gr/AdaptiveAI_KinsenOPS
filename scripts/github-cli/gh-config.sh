#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state
resolve_repo "${1:-.}"

echo "Configuring GitHub for $GH_REPO"

labels=(
  "security:P0|B60205|Critical hardening item"
  "security:P1|D93F0B|High-priority hardening item"
  "security:P2|FBCA04|Medium-priority hardening item"
  "type:finding|5319E7|Finding created by Black Vault automation"
  "type:scan-task|1D76DB|Code scanning task"
  "status:OPEN|D1242F|Open finding"
  "status:IN_FIX|C2A200|Finding is being addressed"
  "status:VERIFIED|0E8A16|Finding verified"
  "automation:bot|6E7781|Automation-managed issue"
  "hardening:metrics|0052CC|Hardening metrics output"
  "design-review|A371F7|Needs architectural review"
  "compliance|1F6FEB|Compliance workflow output"
)

for label in "${labels[@]}"; do
  IFS='|' read -r name color description <<<"$label"
  gh label create "$name" --repo "$GH_REPO" --color "$color" --description "$description" --force >/dev/null
done

for milestone in "Phase 0: Baseline" "Phase 1: Core Scan" "Phase 2: Hardening" "Phase 3: Release"; do
  gh api "repos/$GH_REPO/milestones" --paginate --jq '.[].title' | grep -Fx "$milestone" >/dev/null 2>&1 || \
    gh api --method POST "repos/$GH_REPO/milestones" -f title="$milestone" >/dev/null
done

gh project create --owner "$GH_OWNER" --title "Hardening Sprint" >/dev/null 2>&1 || true

echo "GitHub labels, milestones, and project bootstrap complete"
