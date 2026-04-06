#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

python3 "$ROOT_DIR/scripts/ci/nexus_snapshot.py" record "$ROOT_DIR"
