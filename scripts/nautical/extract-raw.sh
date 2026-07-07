#!/usr/bin/env bash
# extract-raw.sh — extract 8 S-57 feature classes per cell using GDAL 3.2.2.
# Part of Dolphin v0.2.1b data pipeline.
# Gates on verify-checksums.sh and extract-metadata.sh.
# Exact reader conditions: SPLIT_MULTIPOINT=NO, ADD_SOUNDG_DEPTH=NO,
# LNAM_REFS=YES, UPDATES=APPLY.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
GDAL_BIN="$HOME/.nix-profile/bin"

echo "=== extract-raw.sh ==="

# Gate: checksums
echo "--- checksum gate ---"
bash "$SCRIPT_DIR/verify-checksums.sh"

# Gate: GDAL version exact
GDAL_VERSION="$("$GDAL_BIN/gdal-config" --version 2>/dev/null || gdal-config --version 2>/dev/null || echo "NOT_FOUND")"
if [ "$GDAL_VERSION" != "3.2.2" ]; then
  echo "ERROR: GDAL version mismatch. Required: 3.2.2. Found: $GDAL_VERSION" >&2
  exit 1
fi
echo "  GDAL version: $GDAL_VERSION OK"

# Gate: S57 driver
if ! "$GDAL_BIN/ogrinfo" --formats 2>/dev/null | grep -q "S57"; then
  echo "ERROR: S57 driver not present in GDAL installation." >&2
  exit 1
fi
echo "  S57 driver: present"

# Gate: metadata
echo "--- metadata gate ---"
bash "$SCRIPT_DIR/extract-metadata.sh"

ASSETS_DIR="$ROOT_DIR/attached_assets"
INTERMEDIATE_DIR="$ROOT_DIR/data/nautical/intermediate"

# S-57 reader open options (exact, no substitutions)
OPEN_OPTS=(
  "-oo" "SPLIT_MULTIPOINT=NO"
  "-oo" "ADD_SOUNDG_DEPTH=NO"
  "-oo" "LNAM_REFS=YES"
  "-oo" "UPDATES=APPLY"
)

CLASSES=(BCNSPP BOYLAT BOYSPP LIGHTS TOPMAR DEPARE DEPCNT SOUNDG)

CELLS=(
  "1R76W8LI:1R76W8LI_1783372678701.000:1228405ba65ba70afec00c3b0ef5f459dd166a6df588805434383b3b731245ea"
  "1R7788RI:1R7788RI_1783372678701.000:cbdea5755b9f53de9587e2fc4d441c52178484268b79c23084a307e3910da99b"
)

for cell_entry in "${CELLS[@]}"; do
  CELL_ID="${cell_entry%%:*}"
  REST="${cell_entry#*:}"
  FILENAME="${REST%%:*}"
  CHECKSUM="${REST#*:}"

  SRC="$ASSETS_DIR/$FILENAME"
  OUT_DIR="$INTERMEDIATE_DIR/$CELL_ID"
  mkdir -p "$OUT_DIR"

  echo ""
  echo "--- Extracting cell: $CELL_ID ---"

  for CLASS in "${CLASSES[@]}"; do
    OUT_FILE="$OUT_DIR/$CLASS.geojson"

    # Pre-seed with empty FeatureCollection so the file is always valid JSON.
    # ogr2ogr will overwrite if the layer exists; if absent or empty it leaves
    # the file unwritten or writes an empty/invalid file — both cases fall back
    # to the pre-seeded content.
    echo '{"type":"FeatureCollection","features":[]}' > "$OUT_FILE"

    OGR_ERR_FILE="/tmp/ienc_ogr_err_${CELL_ID}_${CLASS}_$.txt"
    OGR_EXIT=0
    "$GDAL_BIN/ogr2ogr" \
      -f GeoJSON \
      "$OUT_FILE" \
      "${OPEN_OPTS[@]}" \
      "$SRC" \
      "$CLASS" \
      2>"$OGR_ERR_FILE" || OGR_EXIT=$?

    if [ "$OGR_EXIT" -ne 0 ]; then
      # Non-zero exit: layer is likely absent from this cell (count=0 is valid per plan).
      # This is not silently swallowed — log explicitly so the cause is visible.
      # validate.sh is the authoritative count gate and will hard-fail if count is wrong.
      OGR_STDERR="$(cat "$OGR_ERR_FILE" 2>/dev/null || echo '')"
      echo "    [INFO] ogr2ogr exited $OGR_EXIT for $CELL_ID/$CLASS — layer may be absent. stderr: ${OGR_STDERR:-<empty>}"
    fi
    rm -f "$OGR_ERR_FILE"

    # Verify the file is non-empty and valid JSON; restore seed if ogr2ogr produced nothing
    if [ ! -s "$OUT_FILE" ] || ! node -e "JSON.parse(require('fs').readFileSync('$OUT_FILE','utf8'))" 2>/dev/null; then
      echo "    [INFO] Restoring empty FeatureCollection for $CELL_ID/$CLASS (no valid output from ogr2ogr)"
      echo '{"type":"FeatureCollection","features":[]}' > "$OUT_FILE"
    fi

    # Add sourceCellId, sourceChecksum, rawObjectClass, sourceStableId to every feature
    node "$SCRIPT_DIR/enrich-raw.cjs" "$OUT_FILE" "$CELL_ID" "$CHECKSUM" "$CLASS"

  done
done

echo ""
echo "PASS: extract-raw.sh complete."
