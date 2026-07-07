#!/usr/bin/env bash
# validate.sh — full validation of the four normalized IENC GeoJSON outputs.
# Part of Dolphin v0.2.1b data pipeline.
# Exits non-zero on any validation failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== validate.sh ==="

node "$SCRIPT_DIR/validate.cjs" "$ROOT_DIR"

echo ""
echo "PASS: validate.sh complete."
