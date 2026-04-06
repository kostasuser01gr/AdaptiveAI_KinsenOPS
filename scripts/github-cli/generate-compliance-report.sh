#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state

if [ ! -f .black-vault/Inventory.tsv ] || [ "$(wc -l < .black-vault/Inventory.tsv)" -le 1 ]; then
  bash scripts/hardening/build-inventory.sh >/dev/null
fi

python3 "$ROOT_DIR/scripts/ci/nexus_snapshot.py" report "$ROOT_DIR"
echo "Generated $ROOT_DIR/BLACK_VAULT_HARDENING_REPORT.md"
