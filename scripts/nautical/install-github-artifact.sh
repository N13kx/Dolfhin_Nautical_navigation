#!/usr/bin/env bash
# install-github-artifact.sh — Download and install a validated GitHub Actions artifact.
#
# Usage: bash scripts/nautical/install-github-artifact.sh [rootDir]
#
# Reads GITHUB_TOKEN from environment only. Never hardcodes or logs it.
# Installs artifact "dolphin-ienc-zeeland-validated" from:
#   repo: N13kx/Dolfhin_Nautical_navigation
#   branch: feature/v0.2.1b-official-ienc-integration
#
# Requires: curl, unzip, node
set -euo pipefail

REPO="N13kx/Dolfhin_Nautical_navigation"
ARTIFACT_NAME="dolphin-ienc-zeeland-validated"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PUBLIC_NAUTICAL="$ROOT_DIR/artifacts/dolphin/public/nautical"
TMP_DIR="$(mktemp -d /tmp/dol014-artifact-XXXXXX)"
BACKUP_DIR="$(mktemp -d /tmp/dol014-backup-XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== DOL-014 GitHub Artifact Installer ==="
echo "  Repo:     $REPO"
echo "  Artifact: $ARTIFACT_NAME"
echo "  Root:     $ROOT_DIR"

# ── 1. Token check ────────────────────────────────────────────────────────────
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo ""
  echo "ERROR: GITHUB_TOKEN environment variable is not set." >&2
  echo "  Set it with:  export GITHUB_TOKEN=<your_token>" >&2
  echo "  Required scopes: actions:read (for private repos: repo)" >&2
  echo "  Never hardcode or commit a token." >&2
  exit 1
fi
echo "  Token:    present (not logged)"

# ── 2. Query artifacts API ────────────────────────────────────────────────────
echo ""
echo "--- Querying GitHub Actions artifacts ---"

API_URL="https://api.github.com/repos/${REPO}/actions/artifacts?per_page=100&name=${ARTIFACT_NAME}"

ARTIFACTS_JSON="$(curl -fsSL \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "$API_URL" 2>&1)" || {
  echo "ERROR: GitHub API request failed." >&2
  echo "$ARTIFACTS_JSON" >&2
  exit 1
}

# Find newest non-expired artifact named exactly dolphin-ienc-zeeland-validated
ARTIFACT_INFO="$(echo "$ARTIFACTS_JSON" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const arts = (data.artifacts || [])
  .filter(a => a.name === '${ARTIFACT_NAME}' && !a.expired)
  .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
if (arts.length === 0) {
  const total = (data.artifacts||[]).length;
  const expired = (data.artifacts||[]).filter(a=>a.name==='${ARTIFACT_NAME}').length;
  process.stderr.write('ERROR: No non-expired artifact named \"${ARTIFACT_NAME}\" found.\n');
  process.stderr.write('  Total artifacts in response: ' + total + '\n');
  process.stderr.write('  Matching name (including expired): ' + expired + '\n');
  process.exit(1);
}
const a = arts[0];
const out = {
  id: a.id,
  name: a.name,
  created_at: a.created_at,
  size_in_bytes: a.size_in_bytes,
  expired: a.expired,
  workflow_run_id: (a.workflow_run||{}).id || null,
  download_url: a.archive_download_url,
};
process.stdout.write(JSON.stringify(out));
")" || exit 1

ARTIFACT_ID="$(echo "$ARTIFACT_INFO" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id))")"
ARTIFACT_SIZE="$(echo "$ARTIFACT_INFO" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).size_in_bytes))")"
ARTIFACT_CREATED="$(echo "$ARTIFACT_INFO" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).created_at)")"
ARTIFACT_RUN="$(echo "$ARTIFACT_INFO" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).workflow_run_id||'N/A'))")"
ARTIFACT_URL="$(echo "$ARTIFACT_INFO" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).download_url)")"

echo "  Artifact ID:      $ARTIFACT_ID"
echo "  Created at:       $ARTIFACT_CREATED"
echo "  Size (bytes):     $ARTIFACT_SIZE"
echo "  Workflow run ID:  $ARTIFACT_RUN"

# ── 3. Download artifact ZIP ──────────────────────────────────────────────────
echo ""
echo "--- Downloading artifact ---"
ZIP_PATH="$TMP_DIR/artifact.zip"

curl -fL \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -o "$ZIP_PATH" \
  "$ARTIFACT_URL" 2>&1 | grep -v "Authorization" || {
  echo "ERROR: Download failed." >&2
  exit 1
}

ACTUAL_SIZE="$(stat -c %s "$ZIP_PATH" 2>/dev/null || stat -f %z "$ZIP_PATH")"
echo "  Downloaded: $ACTUAL_SIZE bytes → $ZIP_PATH"

# ── 4. Extract and inspect ────────────────────────────────────────────────────
echo ""
echo "--- Inspecting ZIP structure ---"
EXTRACT_DIR="$TMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"
unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"

echo "  Top-level contents:"
ls "$EXTRACT_DIR/" | sed 's/^/    /'

# Require nautical/catalog.json
if [ ! -f "$EXTRACT_DIR/nautical/catalog.json" ]; then
  echo "ERROR: nautical/catalog.json not found in artifact." >&2
  exit 1
fi
echo "  nautical/catalog.json: PRESENT"

# Require nautical/cells/
if [ ! -d "$EXTRACT_DIR/nautical/cells" ]; then
  echo "ERROR: nautical/cells/ directory not found in artifact." >&2
  exit 1
fi
CELL_COUNT="$(ls "$EXTRACT_DIR/nautical/cells/" | wc -l | tr -d ' ')"
echo "  nautical/cells/:      PRESENT ($CELL_COUNT directories)"

# ── 5. Validate catalog.json ──────────────────────────────────────────────────
echo ""
echo "--- Validating catalog.json ---"

CATALOG_VALIDATION="$(node -e "
const fs = require('fs');
const path = require('path');
const extractDir = '$EXTRACT_DIR';
const catalogPath = path.join(extractDir, 'nautical', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const errors = [];

if (catalog.totalCells !== 61) errors.push('totalCells=' + catalog.totalCells + ', expected 61');
if (catalog.passCells  !== 61) errors.push('passCells='  + catalog.passCells  + ', expected 61');
if (catalog.failCells  !== 0)  errors.push('failCells='  + catalog.failCells  + ', expected 0');

const cell = (catalog.cells||[]).find(c => c.cellId === '1R76W8LI');
if (!cell)                        errors.push('cell 1R76W8LI not found in catalog');
else if (String(cell.edition) !== '80') errors.push('1R76W8LI edition=' + cell.edition + ', expected 80');

if (errors.length > 0) {
  errors.forEach(e => process.stderr.write('  FAIL ' + e + '\n'));
  process.exit(1);
}

// Verify all referenced file paths exist in the artifact
const nauticalDir = path.join(extractDir, 'nautical');
let missingFiles = [];
for (const c of catalog.cells||[]) {
  for (const [key, relPath] of Object.entries(c.files||{})) {
    const full = path.join(nauticalDir, relPath);
    if (!fs.existsSync(full)) missingFiles.push(relPath);
  }
}
if (missingFiles.length > 0) {
  process.stderr.write('  FAIL: ' + missingFiles.length + ' referenced file(s) missing:\n');
  missingFiles.slice(0,10).forEach(f => process.stderr.write('    ' + f + '\n'));
  process.exit(1);
}

const r76 = (catalog.cells||[]).find(c => c.cellId === '1R76W8LI');
process.stdout.write(JSON.stringify({
  totalCells:   catalog.totalCells,
  passCells:    catalog.passCells,
  failCells:    catalog.failCells,
  edition1R76:  r76 ? String(r76.edition) : 'NOT_FOUND',
  missingFiles: missingFiles.length,
}));
" 2>&1)" || {
  echo "ERROR: Catalog validation failed:" >&2
  echo "$CATALOG_VALIDATION" >&2
  echo ""
  echo "Restoring previous nautical directory is not needed (nothing was replaced yet)."
  exit 1
}

echo "  totalCells:  $(echo "$CATALOG_VALIDATION" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).totalCells))")"
echo "  passCells:   $(echo "$CATALOG_VALIDATION" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).passCells))")"
echo "  failCells:   $(echo "$CATALOG_VALIDATION" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).failCells))")"
echo "  1R76W8LI ed: $(echo "$CATALOG_VALIDATION" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).edition1R76)")"
echo "  Missing refs:$(echo "$CATALOG_VALIDATION" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).missingFiles))")"
echo "  Catalog validation: PASS"

# ── 6. Backup current public/nautical ────────────────────────────────────────
echo ""
echo "--- Backing up current public/nautical ---"
if [ -d "$PUBLIC_NAUTICAL" ]; then
  cp -r "$PUBLIC_NAUTICAL" "$BACKUP_DIR/nautical"
  echo "  Backup: $BACKUP_DIR/nautical"
else
  echo "  No existing public/nautical to back up."
fi

# ── 7. Install ────────────────────────────────────────────────────────────────
echo ""
echo "--- Installing validated artifact ---"

install_failed() {
  echo ""
  echo "ERROR: Installation failed: $1" >&2
  if [ -d "$BACKUP_DIR/nautical" ]; then
    echo "  Restoring backup..." >&2
    rm -rf "$PUBLIC_NAUTICAL" 2>/dev/null || true
    cp -r "$BACKUP_DIR/nautical" "$PUBLIC_NAUTICAL"
    echo "  Restore complete." >&2
  fi
  exit 1
}

# Remove existing and replace
rm -rf "$PUBLIC_NAUTICAL" || install_failed "could not remove existing public/nautical"
cp -r "$EXTRACT_DIR/nautical" "$PUBLIC_NAUTICAL" || install_failed "cp failed"

# Verify installed catalog is readable
if ! node -e "JSON.parse(require('fs').readFileSync('$PUBLIC_NAUTICAL/catalog.json','utf8'))" 2>/dev/null; then
  install_failed "installed catalog.json is not valid JSON"
fi

echo "  Installed: $PUBLIC_NAUTICAL"

# Remove backup on success
rm -rf "$BACKUP_DIR" 2>/dev/null || true
echo "  Backup removed."

# ── 8. Post-install report ────────────────────────────────────────────────────
echo ""
echo "--- Post-install summary ---"
INSTALLED_CELLS="$(ls "$PUBLIC_NAUTICAL/cells/" 2>/dev/null | wc -l | tr -d ' ')"
echo "  Cell directories installed: $INSTALLED_CELLS"
echo "  Flat files:"
for f in navigation-marks.geojson depth-areas.geojson depth-contours.geojson soundings.geojson pipeline-manifest.public.json catalog.json; do
  if [ -f "$PUBLIC_NAUTICAL/$f" ]; then
    SZ="$(stat -c %s "$PUBLIC_NAUTICAL/$f" 2>/dev/null || stat -f %z "$PUBLIC_NAUTICAL/$f")"
    echo "    $f ($SZ bytes)"
  else
    echo "    $f — ABSENT"
  fi
done

# ── 9. TypeScript + build ─────────────────────────────────────────────────────
echo ""
echo "--- TypeScript check ---"
cd "$ROOT_DIR"
pnpm --filter @workspace/dolphin exec tsc --noEmit && echo "  tsc: PASS" || { echo "  tsc: FAIL" >&2; exit 1; }

echo ""
echo "--- Build ---"
pnpm --filter @workspace/dolphin build && echo "  build: PASS" || { echo "  build: FAIL" >&2; exit 1; }

echo ""
echo "=========================================="
echo "  DOL-014 COMPLETE"
echo "  Artifact ID: $ARTIFACT_ID"
echo "  Cells installed: $INSTALLED_CELLS"
echo "=========================================="
