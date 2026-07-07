#!/usr/bin/env bash
# publish.sh — validated staged publish with rollback for IENC nautical data.
# Part of Dolphin v0.2.1b data pipeline.
#
# Design: validated staged publish with rollback (NOT claimed to be fully
# filesystem-atomic). The existing destination is preserved as BACKUP until
# the new directory is confirmed in place.
#
# Filesystem assumption: TMP, BACKUP, and DEST are all under
# artifacts/dolphin/public/, assumed to be on the same filesystem.
# 'mv' between directories on the same filesystem is POSIX-atomic.
#
# Allowlist (exactly 5 files):
#   navigation-marks.geojson
#   depth-areas.geojson
#   depth-contours.geojson
#   soundings.geojson
#   pipeline-manifest.public.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROCESSED_DIR="$ROOT_DIR/data/nautical/processed"
DEST="$ROOT_DIR/artifacts/dolphin/public/nautical"
TMP="${DEST}-publish-tmp-$$"
BACKUP="${DEST}-publish-bak-$$"

ALLOWLIST=(
  "navigation-marks.geojson"
  "depth-areas.geojson"
  "depth-contours.geojson"
  "soundings.geojson"
  "pipeline-manifest.public.json"
)

echo "=== publish.sh ==="

# Gate 1: re-run validation
echo "--- validation gate ---"
bash "$SCRIPT_DIR/validate.sh"

# Gate 2: public manifest must be present
PUBLIC_MANIFEST="$PROCESSED_DIR/pipeline-manifest.public.json"
if [ ! -f "$PUBLIC_MANIFEST" ]; then
  echo "ERROR: pipeline-manifest.public.json is absent from processed/." >&2
  echo "  Run write-manifests.sh before publish.sh." >&2
  exit 1
fi

# Gate 3: public manifest must have validation.status == "PASS"
MANIFEST_STATUS="$(node -e "
const d = JSON.parse(require('fs').readFileSync('$PUBLIC_MANIFEST','utf8'));
process.stdout.write((d.validation||{}).status||'MISSING');
")"
if [ "$MANIFEST_STATUS" != "PASS" ]; then
  echo "ERROR: pipeline-manifest.public.json validation.status is '$MANIFEST_STATUS', expected 'PASS'." >&2
  exit 1
fi
echo "  Public manifest: validation.status=PASS"

# Step 1: Create TMP staging directory
mkdir -p "$TMP"

# Step 2: Copy exactly the allowlisted files (no symlinks permitted)
for f in "${ALLOWLIST[@]}"; do
  SRC="$PROCESSED_DIR/$f"
  if [ ! -f "$SRC" ]; then
    echo "ERROR: Allowlisted file not found in processed/: $f" >&2
    rm -rf "$TMP"
    exit 1
  fi
  if [ -L "$SRC" ]; then
    echo "ERROR: Allowlisted file is a symlink — not permitted: $SRC" >&2
    rm -rf "$TMP"
    exit 1
  fi
  cp "$SRC" "$TMP/$f"
done

# Verify no symlinks in staging directory
SYMLINKS="$(find "$TMP" -maxdepth 1 -type l 2>/dev/null)"
if [ -n "$SYMLINKS" ]; then
  echo "ERROR: Symlinks found in staging directory — not permitted: $SYMLINKS" >&2
  rm -rf "$TMP"
  exit 1
fi

# Step 3: Verify exactly 5 files in TMP, all non-empty
COUNT="$(find "$TMP" -maxdepth 1 -type f | wc -l)"
if [ "$COUNT" -ne 5 ]; then
  echo "ERROR: Expected 5 files in staging directory, found $COUNT." >&2
  rm -rf "$TMP"
  exit 1
fi

for f in "${ALLOWLIST[@]}"; do
  if [ ! -s "$TMP/$f" ]; then
    echo "ERROR: Staged file is empty: $f" >&2
    rm -rf "$TMP"
    exit 1
  fi
done
echo "  Staging directory: 5 files, all non-empty"

# Step 4: Preserve existing DEST as BACKUP
if [ -d "$DEST" ]; then
  if ! mv "$DEST" "$BACKUP"; then
    echo "ERROR: Could not rename existing destination to backup." >&2
    rm -rf "$TMP"
    exit 1
  fi
  echo "  Existing destination preserved as backup: $BACKUP"
fi

# Step 5: Place new DEST
if mv "$TMP" "$DEST"; then
  # Step 6: Success — discard backup
  if [ -d "$BACKUP" ]; then
    rm -rf "$BACKUP"
    echo "  Backup discarded."
  fi
  echo ""
  echo "  Published to: $DEST"
  echo "  Files:"
  for f in "${ALLOWLIST[@]}"; do
    SIZE="$(stat -c %s "$DEST/$f" 2>/dev/null || stat -f %z "$DEST/$f")"
    echo "    $f ($SIZE bytes)"
  done
else
  # Placement failed — restore backup
  echo "ERROR: Failed to move staging directory to destination." >&2
  if [ -d "$BACKUP" ]; then
    if mv "$BACKUP" "$DEST"; then
      echo "  Backup restored to destination." >&2
    else
      echo "  WARNING: Backup restore also failed. Last known good state: $BACKUP" >&2
    fi
  fi
  rm -rf "$TMP"
  exit 1
fi

echo ""
echo "PASS: publish.sh complete."
