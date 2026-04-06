#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
ensure_black_vault_state
resolve_repo "${1:-.}"

python3 - "$GH_REPO" <<'PY'
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

repo = sys.argv[1]
findings_path = Path(".black-vault/FindingsRegister.json")

try:
    findings = json.loads(findings_path.read_text())
except Exception:
    findings = []

threshold = datetime.now(timezone.utc) - timedelta(days=3)

existing_titles = set(
    item["title"]
    for item in json.loads(
        subprocess.check_output(
            ["gh", "issue", "list", "--repo", repo, "--label", "design-review", "--state", "open", "--limit", "200", "--json", "title"],
            text=True,
        )
    )
)

created = 0
for finding in findings:
    if finding.get("status") != "OPEN":
      continue

    created_at = finding.get("created_at")
    if not created_at:
      continue

    created_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if created_time >= threshold:
      continue

    title = f"DESIGN REVIEW: {finding['id']} is stuck"
    if title in existing_titles:
      continue

    body = "\n".join([
        "## Escalation",
        "",
        f"- Finding: {finding['id']}",
        f"- GitHub issue: #{finding.get('github_issue', 'n/a')}",
        "- Reason: OPEN for more than 3 days.",
        "",
        "### Required actions",
        "1. Assign an owner.",
        "2. Decide whether to fix, mitigate, or accept the risk.",
        "3. Update `.black-vault/FindingsRegister.json` and the linked GitHub issue.",
    ])

    subprocess.run(
        [
            "gh", "issue", "create",
            "--repo", repo,
            "--title", title,
            "--body", body,
            "--label", "design-review",
        ],
        check=True,
    )
    created += 1

print(f"Created {created} escalation issue(s)")
PY
