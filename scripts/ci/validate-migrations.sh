#!/usr/bin/env zsh
# Validate that migration files are in strict sequential order and have no
# duplicate sequence numbers. Exits non-zero on violation — suitable for CI.

set -euo pipefail
setopt REMATCH_PCRE 2>/dev/null || true

MIGRATION_DIR="${1:-supabase/migrations}"

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "❌ Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

errors=0
prev_ts=""
prev_seq=""
prev_file=""
typeset -A seen_seqs

for f in "$MIGRATION_DIR"/*.sql; do
  base=$(basename "$f")

  # Extract timestamp and sequence number: YYYYMMDDHHMMSS_NNN_description.sql
  ts=$(echo "$base" | sed -E 's/^([0-9]+)_([0-9]+)_.*/\1/')
  seq=$(echo "$base" | sed -E 's/^([0-9]+)_([0-9]+)_.*/\2/')

  if [[ "$ts" == "$base" || "$seq" == "$base" ]]; then
    echo "❌ Invalid migration filename format: $base"
    errors=$((errors + 1))
    continue
  fi

  # Check for duplicate sequence numbers
  if [[ -n "${seen_seqs[$seq]:-}" ]]; then
    echo "❌ Duplicate sequence number $seq:"
    echo "   - ${seen_seqs[$seq]}"
    echo "   - $base"
    errors=$((errors + 1))
  fi
  seen_seqs[$seq]="$base"

  # Check timestamp ordering (filename sort = timestamp order)
  if [[ -n "$prev_ts" && "$ts" < "$prev_ts" ]]; then
    echo "❌ Timestamp out of order:"
    echo "   - $prev_file ($prev_ts)"
    echo "   - $base ($ts)"
    errors=$((errors + 1))
  fi

  # Check sequence number ordering
  if [[ -n "$prev_seq" ]]; then
    prev_num=$((10#$prev_seq))
    curr_num=$((10#$seq))
    if [[ $curr_num -le $prev_num ]]; then
      echo "❌ Sequence number not strictly increasing:"
      echo "   - $prev_file (seq $prev_seq)"
      echo "   - $base (seq $seq)"
      errors=$((errors + 1))
    fi
  fi

  prev_ts="$ts"
  prev_seq="$seq"
  prev_file="$base"
done

total=${#seen_seqs[@]}
if [[ $errors -eq 0 ]]; then
  echo "✅ All $total migrations are in valid sequential order."
  exit 0
else
  echo ""
  echo "❌ Found $errors migration ordering violation(s) across $total files."
  exit 1
fi
