#!/usr/bin/env node
'use strict';
/**
 * extract-metadata.cjs — extract DSID/DSPM dataset metadata from a single S-57 cell.
 * Called by build.sh for each DIRTY cell. Outputs metadata.json to intermediate/<cellId>/.
 *
 * Usage: node extract-metadata.cjs <rootDir> <cellId> <filename> <sha256> <gdalBin>
 * filename may be a relative path below data/nautical/chart-source/.
 *
 * Derives and verifies cellId from DSID_DSNM in the extracted metadata.
 * FAILS the cell (exits non-zero) if filename-derived cellId conflicts with
 * the official DSID_DSNM-derived cellId.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');

const DSID_FIELDS = {
  DSID_DSNM: 'DSID_DSNM',
  DSID_EDTN: 'DSID_EDTN',
  DSID_UPDN: 'DSID_UPDN',
  DSID_ISDT: 'DSID_ISDT',
  DSID_UADT: 'DSID_UADT',
  DSID_AGEN: 'DSID_AGEN',
  DSID_PRED: 'DSID_PRED',
};
const DSPM_FIELDS = {
  DSPM_VDAT: 'DSPM_VDAT',
  DSPM_SDAT: 'DSPM_SDAT',
  DSPM_HDAT: 'DSPM_HDAT',
};

function extractLayerProps(gdalBin, srcFile, layer) {
  const tmpFile = path.join(os.tmpdir(), `ienc_meta_${layer}_${process.pid}.geojson`);
  try {
    execFileSync(
      path.join(gdalBin, 'ogr2ogr'),
      ['-f', 'GeoJSON', tmpFile, srcFile, layer],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    const raw = fs.readFileSync(tmpFile, 'utf8');
    const fc  = JSON.parse(raw);
    if (!fc.features || fc.features.length === 0) return {};
    return fc.features[0].properties || {};
  } catch {
    return {};
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

const [, , rootDir, cellId, filename, sha256, gdalBin] = process.argv;
if (!rootDir || !cellId || !filename || !sha256 || !gdalBin) {
  process.stderr.write('Usage: extract-metadata.cjs <rootDir> <cellId> <filename> <sha256> <gdalBin>\n');
  process.exit(1);
}

const assetsDir       = path.join(rootDir, 'data', 'nautical', 'chart-source');
const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');

// filename is intentionally allowed to contain subdirectories below chart-source/.
// Folder names are organisational only and are never used as nautical metadata.
const srcPath = path.resolve(assetsDir, filename);
const assetsRoot = path.resolve(assetsDir) + path.sep;
if (!srcPath.startsWith(assetsRoot)) {
  process.stderr.write(`ERROR: Source path escapes chart-source: ${filename}\n`);
  process.exit(1);
}
if (!fs.existsSync(srcPath)) {
  process.stderr.write(`ERROR: Source file not found: ${srcPath}\n`);
  process.exit(1);
}

console.log(`  Extracting metadata for ${cellId}...`);

const outDir = path.join(intermediateDir, cellId);
fs.mkdirSync(outDir, { recursive: true });

const dsidProps = extractLayerProps(gdalBin, srcPath, 'DSID');

const metadata = {
  sourceCellId:   cellId,
  sourceFilename: path.basename(filename),
  sourceRelativePath: filename,
  sourceChecksum: sha256,
};

for (const [gdalField, metaKey] of Object.entries(DSID_FIELDS)) {
  const val = dsidProps[gdalField];
  metadata[metaKey] = (val !== undefined && val !== null) ? val : null;
}
for (const [gdalField, metaKey] of Object.entries(DSPM_FIELDS)) {
  const val = dsidProps[gdalField];
  metadata[metaKey] = (val !== undefined && val !== null) ? val : null;
}

// ── CellId verification ───────────────────────────────────────────────────────
if (metadata.DSID_DSNM) {
  const metaCellId = String(metadata.DSID_DSNM).replace(/\.000$/i, '').trim();
  if (metaCellId.length > 0 && metaCellId !== cellId) {
    process.stderr.write(
      `ERROR: CellId conflict for ${filename}:\n` +
      `  filename-derived = "${cellId}"\n` +
      `  DSID_DSNM-derived = "${metaCellId}"\n` +
      `  Source identity cannot be verified. Cell FAILED.\n`
    );
    process.exit(1);
  }
  console.log(`  CellId verified: DSID_DSNM="${metadata.DSID_DSNM}" matches filename-derived "${cellId}"`);
} else {
  console.log(`  CellId: filename-derived "${cellId}" (DSID_DSNM absent — cannot cross-verify)`);
}

const outPath = path.join(outDir, 'metadata.json');
fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), 'utf8');
console.log(`    Wrote ${outPath}`);
console.log(`    DSID: ${JSON.stringify(Object.fromEntries(Object.entries(DSID_FIELDS).map(([,v])=>[v, metadata[v]])))}`);
console.log(`    DSPM: ${JSON.stringify(Object.fromEntries(Object.entries(DSPM_FIELDS).map(([,v])=>[v, metadata[v]])))}`);
