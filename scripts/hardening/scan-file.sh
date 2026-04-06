#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TARGET_FILE="${1:-}"
STATUS="${2:-IN_PROGRESS}"

if [ -z "$TARGET_FILE" ]; then
  echo "Usage: bash scripts/hardening/scan-file.sh <file> [IN_PROGRESS|COMPLETE]" >&2
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "File not found: $TARGET_FILE" >&2
  exit 1
fi

if [ ! -f .black-vault/Inventory.tsv ]; then
  bash scripts/hardening/build-inventory.sh >/dev/null
fi

ROW="$(awk -F '\t' -v file="$TARGET_FILE" '$1 == file { print $2 "\t" $5 }' .black-vault/Inventory.tsv)"
if [ -z "$ROW" ]; then
  echo "File is not present in .black-vault/Inventory.tsv: $TARGET_FILE" >&2
  exit 1
fi

TOTAL_LINES="$(printf '%s' "$ROW" | cut -f1 | awk '{$1=$1; print}')"
RISK_LEVEL="$(printf '%s' "$ROW" | cut -f2)"

case "$RISK_LEVEL" in
  P0) BLOCK_SIZE=50 ;;
  P1) BLOCK_SIZE=150 ;;
  *) BLOCK_SIZE=250 ;;
esac

python3 - "$ROOT_DIR/.black-vault/ScanLedger.json" "$TARGET_FILE" "$TOTAL_LINES" "$RISK_LEVEL" "$BLOCK_SIZE" "$STATUS" <<'PY'
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

ledger_path = Path(sys.argv[1])
target_file = sys.argv[2]
total_lines = int(sys.argv[3])
risk_level = sys.argv[4]
block_size = int(sys.argv[5])
status = sys.argv[6]

try:
    ledger = json.loads(ledger_path.read_text())
except Exception:
    ledger = []

blocks = []
for index in range(math.ceil(total_lines / block_size) or 1):
    start = index * block_size + 1
    end = min((index + 1) * block_size, total_lines)
    blocks.append({
        "index": index + 1,
        "start": start,
        "end": end,
        "status": "COMPLETE" if status == "COMPLETE" else "PENDING",
    })

entry = {
    "file": target_file,
    "status": status,
    "risk": risk_level,
    "total_lines": total_lines,
    "block_size": block_size,
    "blocks": blocks,
    "lenses": [
        "correctness",
        "security",
        "reliability",
        "performance",
        "maintainability",
        "testability",
        "ops-safety",
    ],
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

ledger = [item for item in ledger if item.get("file") != target_file]
ledger.append(entry)
ledger.sort(key=lambda item: item.get("file", ""))
ledger_path.write_text(json.dumps(ledger, indent=2) + "\n")
PY

echo "Scan plan for $TARGET_FILE"
echo "Risk: $RISK_LEVEL"
echo "Total lines: $TOTAL_LINES"
echo "Block size: $BLOCK_SIZE"
echo "Status: $STATUS"
echo "Checklist: correctness, security, reliability, performance, maintainability, testability, ops-safety"

start=1
index=1
while [ "$start" -le "$TOTAL_LINES" ]; do
  end=$((start + BLOCK_SIZE - 1))
  if [ "$end" -gt "$TOTAL_LINES" ]; then
    end="$TOTAL_LINES"
  fi
  echo "  Block $index: lines $start-$end"
  start=$((end + 1))
  index=$((index + 1))
done
