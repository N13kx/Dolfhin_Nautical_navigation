#!/usr/bin/env bash
# extract-metadata.sh — extract DSID/DSPM dataset metadata from S-57 source cells.
# Part of Dolphin v0.2.1b data pipeline.
# Gates on verify-checksums.sh. Requires GDAL 3.2.2 exact.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
GDAL_BIN="$HOME/.nix-profile/bin"

echo "=== extract-metadata.sh ==="

# Gate: checksums
echo "--- checksum gate ---"
bash "$SCRIPT_DIR/verify-checksums.sh"

# Gate: GDAL version
GDAL_VERSION="$("$GDAL_BIN/gdal-config" --version 2>/dev/null || gdal-config --version 2>/dev/null || echo "NOT_FOUND")"
if [ "$GDAL_VERSION" != "3.2.2" ]; then
  echo "ERROR: GDAL version mismatch. Required: 3.2.2. Found: $GDAL_VERSION" >&2
  echo "  Restore the pinned environment before re-running." >&2
  exit 1
fi
echo "  GDAL version: $GDAL_VERSION OK"

node "$SCRIPT_DIR/extract-metadata.cjs" "$ROOT_DIR" "$GDAL_BIN"

echo "PASS: extract-metadata.sh complete."
