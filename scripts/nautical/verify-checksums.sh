#!/usr/bin/env bash
# verify-checksums.sh — SHA-256 gate for IENC source files
# Part of Dolphin v0.2.1b data pipeline.
# Exits non-zero on any mismatch, absence, or environment error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

CANONICAL_1R76W8LI="1228405ba65ba70afec00c3b0ef5f459dd166a6df588805434383b3b731245ea"
CANONICAL_1R7788RI="cbdea5755b9f53de9587e2fc4d441c52178484268b79c23084a307e3910da99b"

FILE_1R76W8LI="$ROOT_DIR/attached_assets/1R76W8LI_1783372678701.000"
FILE_1R7788RI="$ROOT_DIR/attached_assets/1R7788RI_1783372678701.000"

echo "=== verify-checksums.sh ==="

# Check sha256sum is available
if ! command -v sha256sum &>/dev/null; then
  echo "ERROR: sha256sum not found on PATH" >&2
  exit 1
fi

FAILED=0

check_file() {
  local path="$1"
  local canonical="$2"
  local label="$3"

  if [ ! -f "$path" ]; then
    echo "ERROR: Source file absent: $path" >&2
    echo "  Fresh clones must provision source files from the official source." >&2
    echo "  See data/nautical/README.md for provisioning instructions." >&2
    FAILED=1
    return
  fi

  local actual
  actual="$(sha256sum "$path" | awk '{print $1}')"

  if [ "$actual" = "$canonical" ]; then
    echo "  OK  $label"
    echo "      $actual"
  else
    echo "ERROR: Checksum mismatch for $label" >&2
    echo "  Expected: $canonical" >&2
    echo "  Actual:   $actual" >&2
    echo "  Path:     $path" >&2
    FAILED=1
  fi
}

check_file "$FILE_1R76W8LI" "$CANONICAL_1R76W8LI" "1R76W8LI_1783372678701.000"
check_file "$FILE_1R7788RI" "$CANONICAL_1R7788RI"  "1R7788RI_1783372678701.000"

if [ "$FAILED" -ne 0 ]; then
  echo "FAIL: Checksum verification failed — pipeline aborted." >&2
  exit 1
fi

echo "PASS: All source checksums verified."
