#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state
resolve_repo "${1:-.}"

if [ ! -f .black-vault/Inventory.tsv ] || [ "$(wc -l < .black-vault/Inventory.tsv)" -le 1 ]; then
  bash scripts/hardening/build-inventory.sh >/dev/null
fi

existing_titles="$(gh issue list --repo "$GH_REPO" --label "type:scan-task" --state open --limit 200 --json title)"

python3 - "$GH_REPO" "$existing_titles" <<'PY'
import csv
import json
import math
import subprocess
import sys
from pathlib import Path

repo = sys.argv[1]
existing = {item["title"] for item in json.loads(sys.argv[2])}

inventory_path = Path(".black-vault/Inventory.tsv")
scan_ledger_path = Path(".black-vault/ScanLedger.json")

with inventory_path.open() as handle:
    inventory = list(csv.DictReader(handle, delimiter="\t"))

try:
    scan_ledger = json.loads(scan_ledger_path.read_text())
except Exception:
    scan_ledger = []

completed = {item.get("file") for item in scan_ledger if item.get("status") == "COMPLETE"}
created = 0

for row in inventory:
    if row["risk_level"] != "P0":
        continue

    filepath = row["filepath"]
    if filepath in completed:
        continue

    total_lines = int(row["total_lines"] or 0)
    block_size = 50
    blocks = max(math.ceil(total_lines / block_size), 1)
    title = f"SCAN: {filepath} ({blocks} blocks)"

    if title in existing:
        continue

    body_lines = [
        f"## Scan Task: {filepath}",
        "",
        f"- File: `{filepath}`",
        f"- Lines: {total_lines}",
        f"- Risk: {row['risk_level']}",
        f"- Blocks: {blocks} x {block_size} lines",
        "",
        "### Instructions",
        "1. Run `bash scripts/hardening/scan-file.sh <file>`.",
        "2. Review using the seven-lens checklist.",
        "3. Update `.black-vault/FindingsRegister.json` for any findings.",
        "4. Run `bash scripts/run-all-gates.sh` before opening a PR.",
        "",
        "### Blocks",
    ]

    for index in range(blocks):
        start = index * block_size + 1
        end = min((index + 1) * block_size, total_lines)
        body_lines.append(f"- [ ] Block {index + 1}: lines {start}-{end}")

    subprocess.run(
        [
            "gh", "issue", "create",
            "--repo", repo,
            "--title", title,
            "--body", "\n".join(body_lines),
            "--label", "type:scan-task",
            "--label", "security:P0",
            "--milestone", "Phase 1: Core Scan",
        ],
        check=True,
    )
    created += 1

print(f"Created {created} scan task issue(s)")
PY
