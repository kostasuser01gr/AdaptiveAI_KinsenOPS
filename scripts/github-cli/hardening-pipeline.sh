#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STAGE="${1:-all}"
REPO="${2:-.}"

run_stage() {
  case "$1" in
    init)
      bash scripts/github-cli/bv-init.sh "$REPO"
      ;;
    config)
      bash scripts/github-cli/gh-config.sh "$REPO"
      bash scripts/github-cli/enforce-branch-protection.sh "$REPO"
      ;;
    tasks)
      bash scripts/github-cli/create-scan-tasks.sh "$REPO"
      ;;
    sync)
      bash scripts/github-cli/sync-findings.sh "$REPO"
      ;;
    update)
      bash scripts/github-cli/update-project.sh "$REPO"
      ;;
    escalate)
      bash scripts/github-cli/escalate-stuck.sh "$REPO"
      ;;
    report)
      bash scripts/github-cli/generate-compliance-report.sh
      ;;
    *)
      echo "Unknown stage: $1" >&2
      exit 1
      ;;
  esac
}

if [ "$STAGE" = "all" ]; then
  for step in init config tasks sync update escalate report; do
    run_stage "$step"
  done
else
  run_stage "$STAGE"
fi
