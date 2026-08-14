#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
input_dir="${2:-$repo_root/artifacts/dolphin/public/nautical}"
output_file="${3:-$input_dir/dolphin-zeeland.pmtiles}"
validation_mode="${4:-strict}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
mbtiles_file="$work_dir/dolphin-zeeland.mbtiles"

# Minimum required version: 2.29.0 (accepts any later release, e.g. 2.78.x).
min_tippecanoe_major=2
min_tippecanoe_minor=29
actual_tippecanoe_version="$(tippecanoe --version 2>&1 | awk '{print $2}' | sed 's/^v//')"
actual_major="$(echo "$actual_tippecanoe_version" | cut -d. -f1)"
actual_minor="$(echo "$actual_tippecanoe_version" | cut -d. -f2)"
if [[ "$actual_major" -lt "$min_tippecanoe_major" ]] || \
   { [[ "$actual_major" -eq "$min_tippecanoe_major" ]] && [[ "$actual_minor" -lt "$min_tippecanoe_minor" ]]; }; then
  echo "Expected tippecanoe >= ${min_tippecanoe_major}.${min_tippecanoe_minor}.0, got $actual_tippecanoe_version" >&2
  exit 1
fi
echo "[IENC PMTiles] tippecanoe $actual_tippecanoe_version OK"

node "$repo_root/scripts/nautical/prepare-pmtiles-input.cjs" "$input_dir" "$work_dir/input" "$validation_mode"
mkdir -p "$(dirname "$output_file")"

# Tippecanoe applies per-input zoom bands through a top-level `tippecanoe`
# object on each feature. Add those directives only to disposable NDJSON build
# inputs; validated source GeoJSON and feature properties remain unchanged.
add_zoom_band() {
  local source_file="$1"
  local banded_file="$2"
  local minzoom="$3"
  local maxzoom="$4"
  awk -v minzoom="$minzoom" -v maxzoom="$maxzoom" '
    {
      sub(/^\{"type":"Feature",/, "{\"type\":\"Feature\",\"tippecanoe\":{\"minzoom\":" minzoom ",\"maxzoom\":" maxzoom "},")
      print
    }
  ' "$source_file" > "$banded_file"
}

add_zoom_band "$work_dir/input/navigation-marks.ndjson" "$work_dir/input/navigation-marks-banded.ndjson" 5 16
add_zoom_band "$work_dir/input/depth-areas.ndjson" "$work_dir/input/depth-areas-banded.ndjson" 8 16
add_zoom_band "$work_dir/input/depth-contours.ndjson" "$work_dir/input/depth-contours-banded.ndjson" 8 16
add_zoom_band "$work_dir/input/soundings-sparse.ndjson" "$work_dir/input/soundings-sparse-banded.ndjson" 8 11
add_zoom_band "$work_dir/input/soundings.ndjson" "$work_dir/input/soundings-banded.ndjson" 12 16

# ── Two sounding source-layers for progressive LOD ───────────────────────
# soundings-sparse (tile zoom 8–11): grid-selected ~1-km sparse subset.
#   MapLibre layers soundingsSparsePoint/Label render at map zoom 10–11.
# soundings (tile zoom 12–16): full validated 435 k dataset.
#   MapLibre layers soundingsPoint/Label render at map zoom 12+.
# Navigation marks start at tile zoom 5 for regional recognition. Their
# explicit per-feature minzoom also prevents Tippecanoe point thinning at
# lower zooms. Depth areas
# and contours retain their existing tile zoom 8 floor.
# ─────────────────────────────────────────────────────────────────────────
tippecanoe \
  --quiet \
  --force \
  --minimum-zoom=5 \
  --maximum-zoom=16 \
  --projection=EPSG:4326 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --name='Dolphin Zeeland experimental IENC' \
  --description='Experimental portrayal tiles derived from validated official IENC GeoJSON; not for navigation' \
  --attribution='Official IENC source: Rijkswaterstaat; Dolphin experimental portrayal; not for navigation' \
  --output="$mbtiles_file" \
  -L "navigation-marks:$work_dir/input/navigation-marks-banded.ndjson" \
  -L "depth-areas:$work_dir/input/depth-areas-banded.ndjson" \
  -L "depth-contours:$work_dir/input/depth-contours-banded.ndjson" \
  -L "soundings-sparse:$work_dir/input/soundings-sparse-banded.ndjson" \
  -L "soundings:$work_dir/input/soundings-banded.ndjson"

pmtiles convert --force "$mbtiles_file" "$output_file"
cp "$work_dir/input/build-report.json" "${output_file%.pmtiles}.build-report.json"
echo "[IENC PMTiles] Wrote $output_file ($(wc -c < "$output_file") bytes)"
