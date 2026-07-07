#!/usr/bin/env bash
# write-manifests.sh — write both pipeline manifests after successful validation.
# Part of Dolphin v0.2.1b data pipeline.
#
# Contract:
#   - Re-runs validate.sh; aborts on non-zero exit. No manifest written on failure.
#   - Generates pipelineRunId at script start (ISO-8601 UTC + 8-char random hex suffix).
#   - Writes pipeline-manifest.json (validationResult: "PASS").
#   - Writes pipeline-manifest.public.json (validation.status: "PASS", validatedAt).
#   - On write failure: deletes both manifest files, exits non-zero.
#   - Never leaves partial manifests.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== write-manifests.sh ==="

# Gate: re-run validation (must pass before any manifest is written)
echo "--- validation gate ---"
bash "$SCRIPT_DIR/validate.sh"
echo "--- validation passed — writing manifests ---"

node "$SCRIPT_DIR/write-manifests.cjs" "$ROOT_DIR"

echo ""
echo "PASS: write-manifests.sh complete."
