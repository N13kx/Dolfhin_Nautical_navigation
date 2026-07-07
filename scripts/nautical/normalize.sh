#!/usr/bin/env bash
# normalize.sh — normalize IENC intermediate GeoJSON into four Dolphin-model outputs.
# Part of Dolphin v0.2.1b data pipeline.
# Deletes existing manifests at start (sequencing rule).
# Does NOT write manifests — that is write-manifests.sh's responsibility.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== normalize.sh ==="

# Gate: checksums
bash "$SCRIPT_DIR/verify-checksums.sh"

# Gate: raw extraction
bash "$SCRIPT_DIR/extract-raw.sh"

echo ""
echo "Running normalization..."
node "$SCRIPT_DIR/normalize.cjs" "$ROOT_DIR"

echo "PASS: normalize.sh complete."
