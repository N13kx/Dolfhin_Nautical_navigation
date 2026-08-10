#!/usr/bin/env bash
# extract-raw-cell.sh — extract 8 S-57 feature classes for a SINGLE cell using GDAL 3.2.2.
# Called by build.sh for DIRTY cells only.
# Usage: bash extract-raw-cell.sh <rootDir> <cellId> <filename> <sha256> <gdalBin>
#
# Exact reader conditions: SPLIT_MULTIPOINT=NO, ADD_SOUNDG_DEPTH=NO,
# LNAM_REFS=YES, UPDATES=APPLY.
set -euo pipefail

ROOT_DIR="$1"
CELL_ID="$2"
FILENAME="$3"
CHECKSUM="$4"
GDAL_BIN="$5"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ASSETS_DIR="$ROOT_DIR/data/nautical/chart-source"
INTERMEDIATE_DIR="$ROOT_DIR/data/nautical/intermediate"

CLASSES=(BCNSPP BOYLAT BOYSPP LIGHTS TOPMAR DEPARE DEPCNT SOUNDG)

OPEN_OPTS=(
  "-oo" "SPLIT_MULTIPOINT=NO"
  "-oo" "ADD_SOUNDG_DEPTH=NO"
  "-oo" "LNAM_REFS=YES"
  "-oo" "UPDATES=APPLY"
)

SRC="$ASSETS_DIR/$FILENAME"
OUT_DIR="$INTERMEDIATE_DIR/$CELL_ID"
mkdir -p "$OUT_DIR"

echo ""
echo "--- Extracting cell: $CELL_ID ---"
echo "    Source: $FILENAME"
echo "    SHA-256: ${CHECKSUM:0:16}..."

for CLASS in "${CLASSES[@]}"; do
  OUT_FILE="$OUT_DIR/$CLASS.geojson"
  echo '{"type":"FeatureCollection","features":[]}' > "$OUT_FILE"

  OGR_ERR_FILE="/tmp/ienc_ogr_err_${CELL_ID}_${CLASS}_$$.txt"
  OGR_EXIT=0
  "$GDAL_BIN/ogr2ogr" \
    -f GeoJSON \
    "$OUT_FILE" \
    "${OPEN_OPTS[@]}" \
    "$SRC" \
    "$CLASS" \
    2>"$OGR_ERR_FILE" || OGR_EXIT=$?

  if [ "$OGR_EXIT" -ne 0 ]; then
    OGR_STDERR="$(cat "$OGR_ERR_FILE" 2>/dev/null || echo '')"
    echo "    [INFO] ogr2ogr exited $OGR_EXIT for $CELL_ID/$CLASS — layer may be absent. stderr: ${OGR_STDERR:-<empty>}"
  fi
  rm -f "$OGR_ERR_FILE"

  if [ ! -s "$OUT_FILE" ] || ! node -e "JSON.parse(require('fs').readFileSync('$OUT_FILE','utf8'))" 2>/dev/null; then
    echo "    [INFO] Restoring empty FeatureCollection for $CELL_ID/$CLASS"
    echo '{"type":"FeatureCollection","features":[]}' > "$OUT_FILE"
  fi

  node "$SCRIPT_DIR/enrich-raw.cjs" "$OUT_FILE" "$CELL_ID" "$CHECKSUM" "$CLASS"
done

echo "PASS: extract-raw-cell.sh complete for $CELL_ID."
