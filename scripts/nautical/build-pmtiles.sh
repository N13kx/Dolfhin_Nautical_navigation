#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
input_dir="${2:-$repo_root/artifacts/dolphin/public/nautical}"
output_file="${3:-$input_dir/dolphin-zeeland.pmtiles}"
validation_mode="${4:-strict}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

required_tippecanoe_version="2.29.0"
actual_tippecanoe_version="$(tippecanoe --version 2>&1 | awk '{print $2}' | sed 's/^v//')"
if [[ "$actual_tippecanoe_version" != "$required_tippecanoe_version" ]]; then
  echo "Expected tippecanoe $required_tippecanoe_version, got $actual_tippecanoe_version" >&2
  exit 1
fi

node "$repo_root/scripts/nautical/prepare-pmtiles-input.cjs" "$input_dir" "$work_dir/input" "$validation_mode"
mkdir -p "$(dirname "$output_file")"

tippecanoe \
  --force \
  --minimum-zoom=8 \
  --maximum-zoom=16 \
  --projection=EPSG:4326 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --name='Dolphin Zeeland experimental IENC' \
  --description='Experimental portrayal tiles derived from validated official IENC GeoJSON; not for navigation' \
  --attribution='Official IENC source: Rijkswaterstaat; Dolphin experimental portrayal; not for navigation' \
  --output="$output_file" \
  -L "navigation-marks:$work_dir/input/navigation-marks.ndjson" \
  -L "depth-areas:$work_dir/input/depth-areas.ndjson" \
  -L "depth-contours:$work_dir/input/depth-contours.ndjson" \
  -L "soundings:$work_dir/input/soundings.ndjson"

cp "$work_dir/input/build-report.json" "${output_file%.pmtiles}.build-report.json"
echo "[IENC PMTiles] Wrote $output_file ($(wc -c < "$output_file") bytes)"
