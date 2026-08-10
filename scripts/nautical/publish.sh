#!/usr/bin/env bash
# publish.sh — validated staged publish for Dolphin IENC nautical data.
# DOL-013: publishes per-cell architecture + keeps flat files for frontend compat.
#
# Publishes to artifacts/dolphin/public/nautical/:
#   cells/<cellId>/  (per-cell output — new architecture)
#   catalog.json     (new architecture)
#   navigation-marks.geojson   ┐
#   depth-areas.geojson        │  Flat files — kept for DOL-013b frontend migration
#   depth-contours.geojson     │
#   soundings.geojson          │
#   pipeline-manifest.public.json ┘
#
# Gates on catalog.json validationResult/all cells PASS.
# Uses a TMP → BACKUP → DEST staged copy with rollback on failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

CELLS_BASE_DIR="$ROOT_DIR/data/nautical/cells"
PROCESSED_DIR="$ROOT_DIR/data/nautical/processed"
CATALOG_SRC="$ROOT_DIR/data/nautical/catalog.json"
DEST="$ROOT_DIR/artifacts/dolphin/public/nautical"
TMP="${DEST}-publish-tmp-$$"
BACKUP="${DEST}-publish-bak-$$"

echo "=== publish.sh ==="

# ── Gate 1: catalog.json must exist and all cells PASS ───────────────────────
if [ ! -f "$CATALOG_SRC" ]; then
  echo "ERROR: catalog.json not found at $CATALOG_SRC — run write-manifests.cjs first." >&2
  exit 1
fi

CATALOG_CHECK="$(node -e "
const c = JSON.parse(require('fs').readFileSync('$CATALOG_SRC','utf8'));
if (c.failCells > 0) {
  process.stderr.write('ERROR: catalog.json reports ' + c.failCells + ' failed cell(s).\n');
  process.exit(1);
}
process.stdout.write('PASS cellCount=' + c.passCells);
" 2>&1)" || {
  echo "ERROR: catalog.json gate failed: $CATALOG_CHECK" >&2
  exit 1
}
echo "  Catalog gate: $CATALOG_CHECK"

# ── Gate 2: pipeline-manifest.public.json must have validation.status == PASS ─
PUBLIC_MANIFEST="$PROCESSED_DIR/pipeline-manifest.public.json"
if [ ! -f "$PUBLIC_MANIFEST" ]; then
  echo "ERROR: pipeline-manifest.public.json absent — run write-manifests.cjs first." >&2
  exit 1
fi
MANIFEST_STATUS="$(node -e "
const d = JSON.parse(require('fs').readFileSync('$PUBLIC_MANIFEST','utf8'));
process.stdout.write((d.validation||{}).status||'MISSING');
")"
if [ "$MANIFEST_STATUS" != "PASS" ]; then
  echo "ERROR: pipeline-manifest.public.json validation.status='$MANIFEST_STATUS', expected 'PASS'." >&2
  exit 1
fi
echo "  Public manifest: validation.status=PASS"

# ── Collect cells to publish ──────────────────────────────────────────────────
PASS_CELLS="$(node -e "
const c = JSON.parse(require('fs').readFileSync('$CATALOG_SRC','utf8'));
process.stdout.write(c.cells.map(e => e.cellId).join('\n'));
")"

FLAT_FILES=(
  "navigation-marks.geojson"
  "depth-areas.geojson"
  "depth-contours.geojson"
  "soundings.geojson"
  "pipeline-manifest.public.json"
)

# ── Build staging directory ───────────────────────────────────────────────────
mkdir -p "$TMP"
mkdir -p "$TMP/cells"

# Copy per-cell directories
echo "$PASS_CELLS" | while IFS= read -r cellId; do
  if [ -z "$cellId" ]; then continue; fi
  CELL_SRC="$CELLS_BASE_DIR/$cellId"
  CELL_DST="$TMP/cells/$cellId"
  if [ ! -d "$CELL_SRC" ]; then
    echo "ERROR: Cell source directory missing: $CELL_SRC" >&2
    rm -rf "$TMP"; exit 1
  fi
  mkdir -p "$CELL_DST"
  for f in navigation-marks.geojson depth-areas.geojson depth-contours.geojson soundings.geojson cell-manifest.json; do
    if [ ! -f "$CELL_SRC/$f" ]; then
      echo "ERROR: Missing cell file: $CELL_SRC/$f" >&2
      rm -rf "$TMP"; exit 1
    fi
    if [ -L "$CELL_SRC/$f" ]; then
      echo "ERROR: Symlink not permitted in cell output: $CELL_SRC/$f" >&2
      rm -rf "$TMP"; exit 1
    fi
    cp "$CELL_SRC/$f" "$CELL_DST/$f"
  done
  echo "  Staged: cells/$cellId/"
done

# Copy catalog.json
cp "$CATALOG_SRC" "$TMP/catalog.json"

# Copy flat files (frontend compat)
for f in "${FLAT_FILES[@]}"; do
  SRC="$PROCESSED_DIR/$f"
  if [ ! -f "$SRC" ]; then
    echo "ERROR: Flat file not found: $SRC" >&2
    rm -rf "$TMP"; exit 1
  fi
  if [ -L "$SRC" ]; then
    echo "ERROR: Flat file is symlink — not permitted: $SRC" >&2
    rm -rf "$TMP"; exit 1
  fi
  cp "$SRC" "$TMP/$f"
done

# Verify no symlinks anywhere in staging
SYMLINKS="$(find "$TMP" -type l 2>/dev/null)"
if [ -n "$SYMLINKS" ]; then
  echo "ERROR: Symlinks found in staging: $SYMLINKS" >&2
  rm -rf "$TMP"; exit 1
fi

echo "  Staging directory ready."

# ── Stage: BACKUP → TMP → DEST ───────────────────────────────────────────────
if [ -d "$DEST" ]; then
  if ! mv "$DEST" "$BACKUP"; then
    echo "ERROR: Could not rename existing destination to backup." >&2
    rm -rf "$TMP"; exit 1
  fi
  echo "  Existing destination preserved as backup: $BACKUP"
fi

if mv "$TMP" "$DEST"; then
  [ -d "$BACKUP" ] && rm -rf "$BACKUP" && echo "  Backup discarded."
  echo ""
  echo "  Published to: $DEST"
  echo "  Per-cell directories:"
  echo "$PASS_CELLS" | while IFS= read -r cellId; do
    [ -z "$cellId" ] && continue
    echo "    cells/$cellId/"
  done
  echo "  Flat files (frontend compat):"
  for f in "${FLAT_FILES[@]}"; do
    SIZE="$(stat -c %s "$DEST/$f" 2>/dev/null || stat -f %z "$DEST/$f")"
    echo "    $f ($SIZE bytes)"
  done
else
  echo "ERROR: Failed to move staging directory to destination." >&2
  if [ -d "$BACKUP" ]; then
    mv "$BACKUP" "$DEST" && echo "  Backup restored." >&2 || echo "  WARNING: backup restore failed. Last known good: $BACKUP" >&2
  fi
  rm -rf "$TMP"; exit 1
fi

echo ""
echo "PASS: publish.sh complete."
