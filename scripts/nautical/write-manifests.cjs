#!/usr/bin/env node
'use strict';
/**
 * write-manifests.cjs — generate catalog.json and legacy pipeline manifests.
 *
 * DOL-013: reads cell-manifest.json for each discovered cell and generates:
 *   data/nautical/catalog.json              — per-cell catalog (new architecture)
 *   data/nautical/processed/pipeline-manifest.json        — legacy internal manifest
 *   data/nautical/processed/pipeline-manifest.public.json — legacy frontend manifest
 *
 * Only PASS cells appear in catalog.json. FAIL cells are recorded but never
 * promoted. A build with any FAIL cell must not publish.
 *
 * Failure policy: if any cell has validationStatus !== "PASS", this script
 * still writes the catalog but exits non-zero. build.sh must check the exit
 * code before proceeding to publish.
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { discoverCells } = require('./discover-cells.cjs');

const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: write-manifests.cjs <root_dir>');
  process.exit(1);
}

const cellsBaseDir  = path.join(rootDir, 'data', 'nautical', 'cells');
const processedDir  = path.join(rootDir, 'data', 'nautical', 'processed');
const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');
const catalogPath   = path.join(rootDir, 'data', 'nautical', 'catalog.json');

const cells = discoverCells(rootDir);
const now   = new Date();
const ts    = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
const builtAt = now.toISOString();

// Load cell manifests
const manifests = [];
let allPass = true;

for (const cell of cells) {
  const mPath = path.join(cellsBaseDir, cell.cellId, 'cell-manifest.json');
  if (!fs.existsSync(mPath)) {
    process.stderr.write(`ERROR: cell-manifest.json missing for ${cell.cellId} — run validate.cjs first\n`);
    process.exit(1);
  }
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  manifests.push(m);
  if (m.validationStatus !== 'PASS') allPass = false;
}

const passCells = manifests.filter(m => m.validationStatus === 'PASS');
const failCells = manifests.filter(m => m.validationStatus !== 'PASS');

// ── catalog.json ─────────────────────────────────────────────────────────────
const catalog = {
  catalogVersion:  1,
  builtAt,
  totalCells:      manifests.length,
  passCells:       passCells.length,
  failCells:       failCells.length,
  depthDatum:      'Approximate LAT',
  depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
  napIdentityStatus: 'UNVERIFIED',
  disclaimers: [
    'Charted depths are not real-time water depth',
    'Not for navigation',
    'Depths reference Approximate LAT — not chart datum at your location',
  ],
  cells: passCells.map(m => ({
    cellId:                m.cellId,
    sourceSha256:          m.sourceSha256,
    pipelineRunId:         m.pipelineRunId,
    validatedAt:           m.validatedAt,
    validationStatus:      m.validationStatus,
    edition:               m.edition,
    issueDate:             m.issueDate,
    updateApplicationDate: m.updateApplicationDate,
    producer:              m.producer,
    vdat:                  m.vdat,
    sdat:                  m.sdat,
    depthDatum:            m.depthDatum,
    depthDatumStatus:      m.depthDatumStatus,
    bbox:                  m.bbox,
    featureCounts:         m.featureCounts,
    files: {
      'navigation-marks': `cells/${m.cellId}/navigation-marks.geojson`,
      'depth-areas':      `cells/${m.cellId}/depth-areas.geojson`,
      'depth-contours':   `cells/${m.cellId}/depth-contours.geojson`,
      'soundings':        `cells/${m.cellId}/soundings.geojson`,
    },
  })),
  ...(failCells.length > 0 ? {
    failedCells: failCells.map(m => ({
      cellId:           m.cellId,
      validationStatus: m.validationStatus,
      errors:           m.validationErrors || [],
    })),
  } : {}),
};

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`  Wrote catalog.json — ${passCells.length} PASS, ${failCells.length} FAIL`);

// ── Legacy pipeline-manifest.json (flat processed/ — frontend compat) ─────────
const randHex      = crypto.randomBytes(4).toString('hex');
const pipelineRunId = `${ts}-${randHex}`;
const validatedAt  = builtAt;

// Load metadata for each cell (for legacy manifest sources section)
const sourcesMeta = [];
for (const m of manifests) {
  const metaPath = path.join(intermediateDir, m.cellId, 'metadata.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }
  sourcesMeta.push({ manifest: m, meta });
}

function loadFcLen(dir, filename) {
  const p = path.join(dir, filename);
  if (!fs.existsSync(p)) return 0;
  const fc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (fc.features || []).length;
}

const navCount = loadFcLen(processedDir, 'navigation-marks.geojson');
const depCount = loadFcLen(processedDir, 'depth-areas.geojson');
const cntCount = loadFcLen(processedDir, 'depth-contours.geojson');
const sndCount = loadFcLen(processedDir, 'soundings.geojson');

const internalManifest = {
  schemaVersion:  1,
  pipelineRunId,
  generatedAt:    validatedAt,
  catalogRef:     catalogPath,
  pipeline: {
    gdalVersion:    '3.2.2',
    s57DriverPresent: true,
    ogrOpenOptions: {
      SPLIT_MULTIPOINT: 'NO',
      ADD_SOUNDG_DEPTH: 'NO',
      LNAM_REFS:        'YES',
      UPDATES:          'APPLY',
    },
  },
  sources: sourcesMeta.map(({ manifest: m, meta }) => ({
    cellId:                m.cellId,
    filename:              m.sourceFilename,
    sha256:                m.sourceSha256,
    edition:               m.edition,
    issueDate:             m.issueDate,
    updateApplicationDate: m.updateApplicationDate,
    producer:              m.producer,
    vdat:                  m.vdat,
    sdat:                  m.sdat,
    validationStatus:      m.validationStatus,
  })),
  featureCounts: {
    combinedByOutput: {
      'navigation-marks.geojson': { features: navCount },
      'depth-areas.geojson':      { features: depCount },
      'depth-contours.geojson':   { features: cntCount },
      'soundings.geojson':        { features: sndCount },
    },
  },
  datumLabels: {
    depthDatum:       'Approximate LAT',
    depthDatumCode:   42,
    depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
    verticalDatum:    'Local Datum',
    verticalDatumCode: 24,
    napIdentityStatus: 'UNVERIFIED',
  },
  statedLimitations: [
    'VDAT=24 NAP identity is UNVERIFIED',
    'Data is not real-time water depth',
    'Not for navigation',
    'TOPMAR parent-association semantics not fully verifiable from GDAL decoded output alone',
  ],
  validationResult: allPass ? 'PASS' : 'FAIL',
};

const publicManifest = {
  pipelineSchemaVersion: 1,
  pipelineRunId,
  generatedAt:  validatedAt,
  validation: {
    status:      allPass ? 'PASS' : 'FAIL',
    validatedAt,
  },
  sources: passCells.map(m => ({
    cellId:                m.cellId,
    edition:               m.edition,
    issueDate:             m.issueDate,
    updateApplicationDate: m.updateApplicationDate,
    producer:              'Rijkswaterstaat',
  })),
  depthDatum:       'Approximate LAT',
  depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
  disclaimers: [
    'Charted depths are not real-time water depth',
    'Not for navigation',
  ],
};

const internalPath = path.join(processedDir, 'pipeline-manifest.json');
const publicPath   = path.join(processedDir, 'pipeline-manifest.public.json');
fs.writeFileSync(internalPath, JSON.stringify(internalManifest, null, 2), 'utf8');
fs.writeFileSync(publicPath,   JSON.stringify(publicManifest,  null, 2), 'utf8');
console.log(`  Wrote pipeline-manifest.json (${fs.statSync(internalPath).size} bytes)`);
console.log(`  Wrote pipeline-manifest.public.json (${fs.statSync(publicPath).size} bytes)`);

if (!allPass) {
  process.stderr.write(`\nWARN: ${failCells.length} cell(s) failed — catalog written but build is FAIL.\n`);
  process.exit(1);
}

console.log(`  pipelineRunId: ${pipelineRunId}`);
