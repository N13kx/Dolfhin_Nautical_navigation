#!/usr/bin/env node
'use strict';
/**
 * write-manifests.js — write both pipeline manifests after successful validation.
 * Part of Dolphin v0.2.1b data pipeline.
 *
 * Writes:
 *   data/nautical/processed/pipeline-manifest.json       (internal full audit)
 *   data/nautical/processed/pipeline-manifest.public.json (frontend-safe)
 *
 * Both manifests carry the same pipelineRunId, tying them to the validated output set.
 * Called only by write-manifests.sh, which gates on validate.sh exiting 0.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const EXPECTED_COUNTS = {
  '1R76W8LI': { BCNSPP: 2, BOYLAT: 0, BOYSPP: 0, LIGHTS: 25, TOPMAR: 1, DEPARE: 532, DEPCNT: 528, SOUNDG_sourceFeatures: 4, SOUNDG_coordinates: 757 },
  '1R7788RI': { BCNSPP: 0, BOYLAT: 12, BOYSPP: 5, LIGHTS: 13, TOPMAR: 14, DEPARE: 393, DEPCNT: 390, SOUNDG_sourceFeatures: 5, SOUNDG_coordinates: 1327 },
};

const CELL_BBOXES = {
  '1R76W8LI': {
    minLon: 4.133333, minLat: 51.575000, maxLon: 4.333333, maxLat: 51.625000,
    provenance: 'Derived from union of GDAL-decoded selected-class geometry under pinned reader conditions (VERIFIED_FROM_FILE 2026-07-07)',
  },
  '1R7788RI': {
    minLon: 4.333333, minLat: 51.625000, maxLon: 4.533333, maxLat: 51.675000,
    provenance: 'Derived from union of GDAL-decoded selected-class geometry under pinned reader conditions (VERIFIED_FROM_FILE 2026-07-07)',
  },
};

function loadMetadata(intermediateDir, cellId) {
  const p = path.join(intermediateDir, cellId, 'metadata.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadFcLen(processedDir, filename) {
  const p = path.join(processedDir, filename);
  const fc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (fc.features || []).length;
}

const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: write-manifests.js <root_dir>');
  process.exit(1);
}

const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');
const processedDir = path.join(rootDir, 'data', 'nautical', 'processed');

// Generate pipelineRunId: ISO-8601 UTC + 8-char random hex suffix
const now = new Date();
const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
const randHex = crypto.randomBytes(4).toString('hex');
const pipelineRunId = `${ts}-${randHex}`;
const validatedAt = now.toISOString();

console.log(`  pipelineRunId: ${pipelineRunId}`);
console.log(`  validatedAt:   ${validatedAt}`);

// Load per-cell metadata
const sourcesMeta = CELLS.map(cell => ({
  cell,
  meta: loadMetadata(intermediateDir, cell.cellId),
}));

// Load output feature counts
const navCount = loadFcLen(processedDir, 'navigation-marks.geojson');
const depCount = loadFcLen(processedDir, 'depth-areas.geojson');
const cntCount = loadFcLen(processedDir, 'depth-contours.geojson');
const sndCount = loadFcLen(processedDir, 'soundings.geojson');

// ── Internal manifest ──────────────────────────────────────────────────────────
const internalManifest = {
  schemaVersion: 1,
  pipelineRunId,
  generatedAt: validatedAt,
  pipeline: {
    gdalVersion: '3.2.2',
    s57DriverPresent: true,
    ogrOpenOptions: {
      SPLIT_MULTIPOINT: 'NO',
      ADD_SOUNDG_DEPTH: 'NO',
      LNAM_REFS: 'YES',
      UPDATES: 'APPLY',
    },
  },
  sources: sourcesMeta.map(({ cell, meta }) => ({
    cellId: cell.cellId,
    filename: cell.filename,
    sha256: cell.checksum,
    edition: meta.DSID_EDTN,
    updateNumber: meta.DSID_UPDN,
    issueDate: meta.DSID_ISDT,
    updateApplicationDate: meta.DSID_UADT,
    producer: meta.DSID_AGEN,
    productionSpecification: meta.DSID_PRED,
    vdat: meta.DSPM_VDAT,
    sdat: meta.DSPM_SDAT,
    hdat: meta.DSPM_HDAT,
    verifiedBbox: CELL_BBOXES[cell.cellId],
  })),
  featureCounts: {
    byClassByCell: Object.fromEntries(
      CELLS.map(({ cellId }) => [cellId, { ...EXPECTED_COUNTS[cellId] }])
    ),
    combinedByOutput: {
      'navigation-marks.geojson': { features: navCount },
      'depth-areas.geojson': { features: depCount },
      'depth-contours.geojson': { features: cntCount },
      'soundings.geojson': {
        sourceFeatures: 9,
        normalizedFeatures: sndCount,
        transformationReason:
          '3D MultiPoint expanded to one Point feature per sounding coordinate; signed Z semantics applied per coordinate',
      },
    },
  },
  geometryTypes: {
    BCNSPP: 'Point', BOYLAT: 'Point', BOYSPP: 'Point',
    LIGHTS: 'Point', TOPMAR: 'Point',
    DEPARE: 'Polygon', DEPCNT: 'LineString',
    SOUNDG_source: '3D MultiPoint', SOUNDG_normalized: 'Point',
  },
  geometryCoercionNotes:
    'No coercion or linearization performed. SOUNDG MultiPoint explicitly expanded to Point per coordinate.',
  datumLabels: {
    depthDatum: 'Approximate LAT',
    depthDatumCode: 42,
    depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
    verticalDatum: 'Local Datum',
    verticalDatumCode: 24,
    napIdentityStatus: 'UNVERIFIED',
  },
  topmarAssociationNote:
    'All 15 TOPMAR features have empty LNAM_REFS and FFPT_RIND in GDAL output under LNAM_REFS=YES. ' +
    'GDAL may not expose all S-57 FFPT records. associationRefsVerifiedInGdalOutput=false on all TOPMAR features.',
  sourceGovernanceNote:
    "Both .000 files were Git-tracked at pipeline creation. They have been removed from the Git index via " +
    "'git rm --cached' (files retained on disk) and attached_assets/*.000 has been added to .gitignore. " +
    'Fresh clones must provision source files from the official source with SHA-256 verification before running the pipeline.',
  statedLimitations: [
    'VDAT=24 NAP identity is UNVERIFIED — not confirmed from official documentation',
    'Bridge and overhead clearances are not in scope',
    'Data is not real-time water depth',
    'Not for navigation',
    'Rijkswaterstaat data licence not reviewed for public redistribution',
    'TOPMAR parent-association semantics cannot be fully verified from GDAL decoded output alone',
  ],
  validationResult: 'PASS',
  validationLog: 'See validate.sh output during pipeline run',
};

// ── Public manifest ────────────────────────────────────────────────────────────
const publicManifest = {
  pipelineSchemaVersion: 1,
  pipelineRunId,
  generatedAt: validatedAt,
  validation: {
    status: 'PASS',
    validatedAt,
  },
  sources: sourcesMeta.map(({ cell, meta }) => ({
    cellId: cell.cellId,
    edition: meta.DSID_EDTN,
    issueDate: meta.DSID_ISDT,
    updateApplicationDate: meta.DSID_UADT,
    producer: 'Rijkswaterstaat',
  })),
  depthDatum: 'Approximate LAT',
  depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
  disclaimers: [
    'Charted depths are not real-time water depth',
    'Not for navigation',
  ],
};

// ── Write with rollback on failure ────────────────────────────────────────────
const internalPath = path.join(processedDir, 'pipeline-manifest.json');
const publicPath = path.join(processedDir, 'pipeline-manifest.public.json');

try {
  fs.writeFileSync(internalPath, JSON.stringify(internalManifest, null, 2), 'utf8');
  console.log(`  Wrote pipeline-manifest.json (${fs.statSync(internalPath).size.toLocaleString()} bytes)`);

  fs.writeFileSync(publicPath, JSON.stringify(publicManifest, null, 2), 'utf8');
  console.log(`  Wrote pipeline-manifest.public.json (${fs.statSync(publicPath).size.toLocaleString()} bytes)`);
} catch (e) {
  // Clean up partial writes
  for (const p of [internalPath, publicPath]) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      process.stderr.write(`  Deleted partial manifest: ${p}\n`);
    }
  }
  process.stderr.write(`ERROR: Manifest write failed — both files deleted: ${e.message}\n`);
  process.exit(1);
}
