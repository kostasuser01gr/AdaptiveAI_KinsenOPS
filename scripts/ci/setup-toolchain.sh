#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STACK="${1:-auto}"

detect_stack() {
  if [ -f package.json ]; then
    echo "nodejs"
    return
  fi
  if [ -f pyproject.toml ] || [ -f setup.py ]; then
    echo "python"
    return
  fi
  if [ -f Cargo.toml ]; then
    echo "rust"
    return
  fi
  if [ -f go.mod ]; then
    echo "go"
    return
  fi
  echo "unknown"
}

if [ "$STACK" = "auto" ]; then
  STACK="$(detect_stack)"
fi

case "$STACK" in
  nodejs)
    command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
    if [ "${CI:-}" = "true" ] || [ ! -d node_modules ]; then
      npm ci
    else
      echo "node_modules already present; skipping npm ci"
    fi
    ;;
  *)
    echo "Unsupported stack: $STACK" >&2
    exit 1
    ;;
esac
