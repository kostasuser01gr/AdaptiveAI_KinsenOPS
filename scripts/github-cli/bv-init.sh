#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state

mkdir -p .github/workflows .github/ISSUE_TEMPLATE scripts/ci scripts/github-cli scripts/hardening artifacts coverage

bash scripts/hardening/build-inventory.sh >/dev/null

python3 <<'PY'
import json
from datetime import datetime, timezone
from pathlib import Path

package = json.loads(Path("package.json").read_text())
components = []

for scope in ("dependencies", "devDependencies", "optionalDependencies"):
    for name, version in sorted(package.get(scope, {}).items()):
        components.append({"name": name, "version": version, "scope": scope})

sbom = {
    "format": "black-vault-sbom/v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "package_manager": "npm",
    "source_lockfile": "package-lock.json",
    "package": {
        "name": package.get("name"),
        "version": package.get("version"),
    },
    "components": components,
}

Path(".black-vault/sbom.json").write_text(json.dumps(sbom, indent=2) + "\n")
PY

if [ "${BLACK_VAULT_REMOTE_APPLY:-0}" = "1" ] && command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  bash scripts/github-cli/gh-config.sh "${1:-.}"
else
  echo "Remote GitHub configuration skipped (set BLACK_VAULT_REMOTE_APPLY=1 to enable)"
fi

echo "Black Vault baseline initialized"
