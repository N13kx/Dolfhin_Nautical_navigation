#!/usr/bin/env bash
# verify-checksums.sh — discover and SHA-256 report for all chart-source/*.000 files.
# DOL-013: discovery-driven; no hardcoded cell list or expected hash to compare against.
#
# Reports the SHA-256 of each discovered source file. The SHA is used as the
# incremental build key in build.sh — it is not compared against a static registry.
# Cell identity is verified against DSID metadata during extract-metadata.cjs.
#
# Usage: bash verify-checksums.sh [rootDir]
# Exit codes: 0 = all source files readable and non-empty; 1 = error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
CHART_SOURCE_DIR="$ROOT_DIR/data/nautical/chart-source"

echo "=== verify-checksums.sh ==="

if [ ! -d "$CHART_SOURCE_DIR" ]; then
  echo "ERROR: chart-source directory not found: $CHART_SOURCE_DIR" >&2
  exit 1
fi

FAILED=0
COUNT=0

while IFS= read -r -d '' filepath; do
  filename="$(basename "$filepath")"

  # Resolve symlinks for SHA computation
  real="$(realpath "$filepath" 2>/dev/null || readlink -f "$filepath" 2>/dev/null || echo "$filepath")"

  if [ ! -f "$real" ]; then
    echo "  ERROR: Source file not readable: $filepath" >&2
    FAILED=1
    continue
  fi
  if [ ! -s "$real" ]; then
    echo "  ERROR: Source file is empty: $filepath" >&2
    FAILED=1
    continue
  fi

  if command -v sha256sum &>/dev/null; then
    SHA="$(sha256sum "$real" | awk '{print $1}')"
  elif command -v shasum &>/dev/null; then
    SHA="$(shasum -a 256 "$real" | awk '{print $1}')"
  else
    # Fallback: Node crypto
    SHA="$(node -e "
const crypto = require('crypto');
const fs = require('fs');
const h = crypto.createHash('sha256').update(fs.readFileSync('$real')).digest('hex');
process.stdout.write(h);
")"
  fi

  echo "  OK  $filename"
  echo "      $SHA"
  COUNT=$((COUNT + 1))
done < <(find "$CHART_SOURCE_DIR" -maxdepth 1 -name "*.000" -print0 | sort -z)

if [ "$COUNT" -eq 0 ]; then
  echo "ERROR: No *.000 files found in $CHART_SOURCE_DIR" >&2
  exit 1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "FAIL: One or more source files failed the check." >&2
  exit 1
fi

echo "PASS: $COUNT source file(s) verified (SHA-256 reported above)."
