#!/usr/bin/env bash
# build.sh — Generic incremental IENC Chart Builder for Dolphin.
# DOL-013: auto-discovery, SHA-256 incremental logic, per-cell output, catalog.json.
#
# Usage: bash scripts/nautical/build.sh [rootDir]
#
# Flow:
#   1. Discover cells from data/nautical/chart-source/*.000
#   2. Check GDAL requirements (DIRTY cells need GDAL 3.2.2 + S57 driver)
#   3. For DIRTY cells: run GDAL extraction (extract-metadata + extract-raw-cell)
#   4. For non-FULL_PASS cells: run normalize.cjs (writes per-cell + flat output)
#   5. Run validate.cjs (universal invariants + pilot fixtures, writes cell-manifests)
#   6. Run write-manifests.cjs (catalog.json + legacy manifests)
#   7. Run publish.sh (per-cell publish + flat files for frontend compat)
#
# Failure policy:
#   Any discovered cell that fails validation causes overall build FAIL.
#   publish.sh is NOT called if any cell fails.
#   The previous published dataset remains intact on failure.
#
# Incremental cache levels:
#   FULL_PASS        — cell-manifest.json PASS + SHA match + all 4 output files
#                      → skip ALL stages (normalize, validate, publish steps reuse existing)
#   INTERMEDIATE_HIT — intermediate/ complete + SHA match, no PASS cell output
#                      → skip GDAL extraction; run normalize + validate
#   DIRTY            — no usable cache; GDAL required for extraction
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
GDAL_BIN="$HOME/.nix-profile/bin"

echo "=========================================="
echo "  Dolphin Chart Builder — DOL-013"
echo "  Root: $ROOT_DIR"
echo "=========================================="

# ── Step 1: Discover cells ────────────────────────────────────────────────────
echo ""
echo "--- Step 1: Source Discovery ---"
DISCOVERY_JSON="$(node "$SCRIPT_DIR/discover-cells.cjs" "$ROOT_DIR")"

# Report discovery
echo "$DISCOVERY_JSON" | node -e "
const cells = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('  Discovered ' + cells.length + ' cell(s):');
for (const c of cells) {
  const conflict = c.idConflict ? ' *** ID CONFLICT ***' : '';
  console.log('    ' + c.cacheStatus.padEnd(18) + c.cellId + '  sha=' + c.sha256.slice(0,16) + '...' + conflict);
}
"

# Abort on identity conflicts immediately
ID_CONFLICTS="$(echo "$DISCOVERY_JSON" | node -e "
const cells = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const bad = cells.filter(c => c.idConflict);
if (bad.length > 0) {
  bad.forEach(c => process.stderr.write('  CellId conflict: ' + c.idConflictDetail + '\n'));
  process.exit(1);
}" 2>&1)" || {
  echo ""
  echo "ERROR: CellId identity conflict(s) detected — pipeline aborted." >&2
  echo "$ID_CONFLICTS" >&2
  exit 1
}

# ── Step 2: GDAL requirements check ──────────────────────────────────────────
echo ""
echo "--- Step 2: GDAL Environment ---"

DIRTY_CELLS="$(echo "$DISCOVERY_JSON" | node -e "
const cells = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
process.stdout.write(cells.filter(c => c.cacheStatus === 'DIRTY').map(c => c.cellId + ':' + c.filename + ':' + c.sha256).join('\n'));
")"

GDAL_VERSION="$("$GDAL_BIN/gdal-config" --version 2>/dev/null || gdal-config --version 2>/dev/null || echo "NOT_FOUND")"
S57_PRESENT=0
if "$GDAL_BIN/ogrinfo" --formats 2>/dev/null | grep -q "S57"; then S57_PRESENT=1; fi

echo "  GDAL version : $GDAL_VERSION"
echo "  S57 driver   : $([ "$S57_PRESENT" -gt 0 ] && echo 'present' || echo 'NOT FOUND')"

if [ -n "$DIRTY_CELLS" ]; then
  echo "  DIRTY cells requiring GDAL extraction:"
  echo "$DIRTY_CELLS" | while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    echo "    ${entry%%:*}"
  done
  if [ "$GDAL_VERSION" != "3.2.2" ]; then
    echo ""
    echo "BLOCKED: GDAL 3.2.2 required for DIRTY cell extraction." >&2
    echo "  Found: $GDAL_VERSION" >&2
    echo "  Install: nix-shell -p gdal (version must be 3.2.2 exactly)" >&2
    echo "  Do not substitute another GDAL version or reader implementation." >&2
    exit 2
  fi
  if [ "$S57_PRESENT" -eq 0 ]; then
    echo "BLOCKED: S57 driver not present in GDAL installation." >&2
    exit 2
  fi
  echo "  GDAL check: OK (3.2.2, S57 present)"
else
  echo "  No DIRTY cells — GDAL extraction not required for this build."
  if [ "$GDAL_VERSION" = "3.2.2" ]; then
    echo "  GDAL available (not needed this run)."
  else
    echo "  GDAL unavailable (not needed — all cells cached)."
  fi
fi

# ── Step 3: GDAL extraction for DIRTY cells ───────────────────────────────────
if [ -n "$DIRTY_CELLS" ]; then
  echo ""
  echo "--- Step 3: GDAL Extraction (DIRTY cells) ---"
  echo "$DIRTY_CELLS" | while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    CELL_ID="${entry%%:*}"
    REST="${entry#*:}"
    FILENAME="${REST%%:*}"
    SHA="${REST#*:}"
    echo ""
    echo "  Extracting metadata: $CELL_ID"
    node "$SCRIPT_DIR/extract-metadata.cjs" "$ROOT_DIR" "$CELL_ID" "$FILENAME" "$SHA" "$GDAL_BIN"
    echo ""
    echo "  Extracting raw classes: $CELL_ID"
    bash "$SCRIPT_DIR/extract-raw-cell.sh" "$ROOT_DIR" "$CELL_ID" "$FILENAME" "$SHA" "$GDAL_BIN"
  done
else
  echo ""
  echo "--- Step 3: GDAL Extraction --- SKIPPED (no DIRTY cells)"
fi

# ── Step 4: Normalize ─────────────────────────────────────────────────────────
echo ""
echo "--- Step 4: Normalize ---"

# Check if all cells are FULL_PASS (can skip normalize)
ALL_FULL_PASS="$(echo "$DISCOVERY_JSON" | node -e "
const cells = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
process.stdout.write(cells.every(c => c.cacheStatus === 'FULL_PASS') ? 'YES' : 'NO');
")"

if [ "$ALL_FULL_PASS" = "YES" ]; then
  echo "  All cells FULL_PASS — normalize SKIPPED (per-cell output already valid)"
  echo "  Regenerating flat processed/ files from cached per-cell output..."
  node "$SCRIPT_DIR/normalize.cjs" "$ROOT_DIR"
else
  node "$SCRIPT_DIR/normalize.cjs" "$ROOT_DIR"
fi

# ── Step 5: Validate ──────────────────────────────────────────────────────────
echo ""
echo "--- Step 5: Validate ---"
VALIDATE_RESULT=0
node "$SCRIPT_DIR/validate.cjs" "$ROOT_DIR" || VALIDATE_RESULT=$?

# ── Step 6: Write manifests ───────────────────────────────────────────────────
echo ""
echo "--- Step 6: Write Manifests ---"
MANIFESTS_RESULT=0
node "$SCRIPT_DIR/write-manifests.cjs" "$ROOT_DIR" || MANIFESTS_RESULT=$?

# ── Failure gate before publish ───────────────────────────────────────────────
if [ "$VALIDATE_RESULT" -ne 0 ] || [ "$MANIFESTS_RESULT" -ne 0 ]; then
  echo ""
  echo "=========================================="
  echo "  BUILD FAILED"
  echo "  One or more cells failed validation."
  echo "  Previous published dataset is INTACT."
  echo "  publish.sh was NOT called."
  echo "=========================================="
  # Report failed cells
  CATALOG_PATH="$ROOT_DIR/data/nautical/catalog.json"
  if [ -f "$CATALOG_PATH" ]; then
    node -e "
const c = JSON.parse(require('fs').readFileSync('$CATALOG_PATH','utf8'));
if (c.failedCells && c.failedCells.length > 0) {
  console.error('Failed cells:');
  for (const f of c.failedCells) {
    console.error('  ' + f.cellId + ': ' + (f.errors||[]).slice(0,3).join('; '));
  }
}
" >&2
  fi
  exit 1
fi

# ── Step 7: Publish ───────────────────────────────────────────────────────────
echo ""
echo "--- Step 7: Publish ---"
bash "$SCRIPT_DIR/publish.sh" "$ROOT_DIR"

echo ""
echo "=========================================="
echo "  BUILD COMPLETE — ALL CELLS PASS"
echo "=========================================="

# Print summary
echo "$DISCOVERY_JSON" | node -e "
const cells = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('  Cells processed: ' + cells.length);
const full = cells.filter(c => c.cacheStatus === 'FULL_PASS').length;
const inter = cells.filter(c => c.cacheStatus === 'INTERMEDIATE_HIT').length;
const dirty = cells.filter(c => c.cacheStatus === 'DIRTY').length;
if (full)  console.log('    FULL_PASS (skipped all):     ' + full);
if (inter) console.log('    INTERMEDIATE_HIT (skip GDAL): ' + inter);
if (dirty) console.log('    DIRTY (full extraction):     ' + dirty);
"
