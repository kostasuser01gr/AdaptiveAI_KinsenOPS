#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state
resolve_repo "${1:-.}"

issues_json="$(gh issue list --repo "$GH_REPO" --label "type:finding" --state all --limit 200 --json number,title,body,labels,state,createdAt,closedAt,url)"

python3 - "$issues_json" <<'PY'
import json
import re
import sys
from pathlib import Path

issues = json.loads(sys.argv[1])
findings_path = Path(".black-vault/FindingsRegister.json")

try:
    existing = {item["id"]: item for item in json.loads(findings_path.read_text()) if item.get("id")}
except Exception:
    existing = {}

synced = []

for issue in issues:
    title = issue.get("title", "")
    match = re.search(r"\b(F\d{3,})\b", title)
    finding_id = match.group(1) if match else f"F{issue['number']:04d}"
    labels = [label["name"] for label in issue.get("labels", [])]
    severity = next((label.split(":")[-1] for label in labels if label.startswith("security:")), "P2")

    status = "VERIFIED" if issue.get("state") == "CLOSED" else "OPEN"
    if "status:IN_FIX" in labels:
        status = "IN_FIX"
    elif "status:VERIFIED" in labels:
        status = "VERIFIED"

    finding = existing.get(finding_id, {})
    finding.update({
        "id": finding_id,
        "title": title,
        "severity": severity,
        "status": status,
        "github_issue": issue["number"],
        "github_url": issue["url"],
        "created_at": issue.get("createdAt"),
        "closed_at": issue.get("closedAt"),
        "body": issue.get("body", ""),
    })
    synced.append(finding)

synced.sort(key=lambda item: item["id"])
findings_path.write_text(json.dumps(synced, indent=2) + "\n")
print(f"Synced {len(synced)} finding(s)")
PY
