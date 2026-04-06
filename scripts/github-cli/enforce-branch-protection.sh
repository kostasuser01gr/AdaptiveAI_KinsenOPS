#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "$ROOT_DIR"
resolve_repo "${1:-.}"

BRANCH="${2:-main}"

gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$GH_REPO/branches/$BRANCH/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Black Vault Gates (PR) / Gate Summary"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_conversation_resolution": true
}
JSON

echo "Branch protection enforced for $GH_REPO:$BRANCH"
