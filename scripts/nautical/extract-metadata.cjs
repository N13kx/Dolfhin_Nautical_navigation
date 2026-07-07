#!/usr/bin/env node
'use strict';
/**
 * extract-metadata.js — extract DSID/DSPM dataset metadata from S-57 cells.
 * Called by extract-metadata.sh. Outputs per-cell metadata.json files.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CELLS = [
  {
    cellId: '1R76W8LI',
    filename: '1R76W8LI_1783372678701.000',
    checksum: '1228405ba65ba70afec00c3b0ef5f459dd166a6df588805434383b3b731245ea',
  },
  {
    cellId: '1R7788RI',
    filename: '1R7788RI_1783372678701.000',
    checksum: 'cbdea5755b9f53de9587e2fc4d441c52178484268b79c23084a307e3910da99b',
  },
];

// Field names as they appear in GDAL S-57 GeoJSON output for the DSID layer.
// GDAL prefixes them: DSID_*, DSSI_*, DSPM_* are all in the same DSID layer.
const DSID_FIELDS = {
  DSID_DSNM: 'DSID_DSNM',
  DSID_EDTN: 'DSID_EDTN',
  DSID_UPDN: 'DSID_UPDN',
  DSID_ISDT: 'DSID_ISDT',
  DSID_UADT: 'DSID_UADT',
  DSID_AGEN: 'DSID_AGEN',
  DSID_PRED: 'DSID_PRED',
};

// DSPM fields are also in the DSID layer in GDAL S-57 output
const DSPM_FIELDS = {
  DSPM_VDAT: 'DSPM_VDAT',
  DSPM_SDAT: 'DSPM_SDAT',
  DSPM_HDAT: 'DSPM_HDAT',
};

function extractLayerProps(gdalBin, srcFile, layer) {
  const tmpFile = path.join(os.tmpdir(), `ienc_${layer}_${process.pid}.geojson`);
  try {
    execFileSync(
      path.join(gdalBin, 'ogr2ogr'),
      ['-f', 'GeoJSON', tmpFile, srcFile, layer],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    const raw = fs.readFileSync(tmpFile, 'utf8');
    const fc = JSON.parse(raw);
    if (!fc.features || fc.features.length === 0) return {};
    return fc.features[0].properties || {};
  } catch {
    return {};
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

const [, , rootDir, gdalBin] = process.argv;
if (!rootDir || !gdalBin) {
  console.error('Usage: extract-metadata.js <root_dir> <gdal_bin>');
  process.exit(1);
}

const assetsDir = path.join(rootDir, 'attached_assets');
const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');

for (const cell of CELLS) {
  console.log(`  Extracting metadata for ${cell.cellId}...`);
  const srcPath = path.join(assetsDir, cell.filename);
  const outDir = path.join(intermediateDir, cell.cellId);
  fs.mkdirSync(outDir, { recursive: true });

  // All DSID_* and DSPM_* fields live in the DSID layer in GDAL S-57 output
  const dsidProps = extractLayerProps(gdalBin, srcPath, 'DSID');

  const metadata = {
    sourceCellId: cell.cellId,
    sourceChecksum: cell.checksum,
  };

  for (const [gdalField, metaKey] of Object.entries(DSID_FIELDS)) {
    const val = dsidProps[gdalField];
    metadata[metaKey] = val !== undefined && val !== null ? val : null;
  }
  for (const [gdalField, metaKey] of Object.entries(DSPM_FIELDS)) {
    const val = dsidProps[gdalField];
    metadata[metaKey] = val !== undefined && val !== null ? val : null;
  }

  const outPath = path.join(outDir, 'metadata.json');
  fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), 'utf8');

  const dsidDisplay = Object.fromEntries(
    Object.entries(DSID_FIELDS).map(([, v]) => [v, metadata[v]])
  );
  const dspmDisplay = Object.fromEntries(
    Object.entries(DSPM_FIELDS).map(([, v]) => [v, metadata[v]])
  );
  console.log(`    Wrote ${outPath}`);
  console.log(`    DSID: ${JSON.stringify(dsidDisplay)}`);
  console.log(`    DSPM: ${JSON.stringify(dspmDisplay)}`);
}

console.log('  Metadata extraction complete.');
