#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ROOT_DIR

ensure_black_vault_state() {
  mkdir -p "$ROOT_DIR/.black-vault"

  [ -f "$ROOT_DIR/.black-vault/Inventory.tsv" ] || printf 'filepath\ttotal_lines\tclassification\texclusion_reason\trisk_level\n' > "$ROOT_DIR/.black-vault/Inventory.tsv"

  for ledger in \
    ScanLedger \
    FindingsRegister \
    ArtifactsLedger \
    MetricsLedger \
    ComplianceLedger \
    CostLedger \
    ProofLedger \
    DecisionLog \
    RiskRegister
  do
    [ -f "$ROOT_DIR/.black-vault/${ledger}.json" ] || printf '[]\n' > "$ROOT_DIR/.black-vault/${ledger}.json"
  done

  if [ ! -f "$ROOT_DIR/.black-vault/sbom.json" ]; then
    printf '{\n  "format": "black-vault-sbom/v1",\n  "generated_at": "",\n  "package_manager": "npm",\n  "source_lockfile": "package-lock.json",\n  "components": []\n}\n' > "$ROOT_DIR/.black-vault/sbom.json"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "$1 is required" >&2
    exit 1
  }
}

require_gh() {
  require_command gh
  gh auth status >/dev/null 2>&1 || {
    echo "gh is not authenticated. Run: gh auth login" >&2
    exit 1
  }
}

resolve_repo() {
  local repo_input="${1:-.}"

  require_gh

  if [ "$repo_input" = "." ]; then
    GH_REPO="$(gh repo view --json nameWithOwner -q '.nameWithOwner')"
  else
    GH_REPO="$(gh repo view "$repo_input" --json nameWithOwner -q '.nameWithOwner')"
  fi

  GH_OWNER="${GH_REPO%/*}"
  GH_NAME="${GH_REPO#*/}"

  export GH_REPO GH_OWNER GH_NAME
}
