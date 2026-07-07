#!/usr/bin/env node
'use strict';
/**
 * normalize.js — normalize IENC intermediate GeoJSON into four Dolphin-model outputs.
 * Part of Dolphin v0.2.1b data pipeline.
 *
 * Produces:
 *   data/nautical/processed/navigation-marks.geojson
 *   data/nautical/processed/depth-areas.geojson
 *   data/nautical/processed/depth-contours.geojson
 *   data/nautical/processed/soundings.geojson
 */
const fs = require('fs');
const path = require('path');

const CELLS = ['1R76W8LI', '1R7788RI'];

const NAV_CLASSES = ['BCNSPP', 'BOYLAT', 'BOYSPP', 'LIGHTS', 'TOPMAR'];

const DOLPHIN_KIND_MAP = {
  BCNSPP: 'beacon-special',
  BOYLAT: 'buoy-lateral',
  BOYSPP: 'buoy-special',
  LIGHTS: 'light',
  TOPMAR: 'topmark',
};

const DATUM_SCHEMA = {
  depthDatum: 'Approximate LAT',
  depthDatumCode: 42,
  depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
  verticalDatum: 'Local Datum',
  verticalDatumCode: 24,
  napIdentityStatus: 'UNVERIFIED',
};

const BANNED_FIELDS = new Set(['verticalDatumNapInferred']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPipelineFeatureId(cellId, className, props) {
  const rcid = props['RCID'];
  if (rcid !== null && rcid !== undefined && rcid !== 0 && String(rcid).trim() !== '') {
    return `${cellId}/${className}/${rcid}`;
  }
  const fidn = props['FIDN'];
  const fids = props['FIDS'];
  if (fidn !== null && fidn !== undefined && fids !== null && fids !== undefined) {
    return `${cellId}/${className}/FIDN${fidn}-FIDS${fids}`;
  }
  throw new Error(
    `Cannot generate pipelineFeatureId for ${cellId}/${className}: ` +
    `RCID=${JSON.stringify(rcid)}, FIDN=${JSON.stringify(props['FIDN'])}, ` +
    `FIDS=${JSON.stringify(props['FIDS'])}. Hard pipeline failure.`
  );
}

function getSoundgFeatureId(cellId, props, coordIdx) {
  const rcid = props['RCID'];
  if (rcid !== null && rcid !== undefined && rcid !== 0 && String(rcid).trim() !== '') {
    return `${cellId}/SOUNDG/${rcid}/${coordIdx}`;
  }
  const fidn = props['FIDN'];
  const fids = props['FIDS'];
  if (fidn !== null && fidn !== undefined && fids !== null && fids !== undefined) {
    return `${cellId}/SOUNDG/FIDN${fidn}-FIDS${fids}/${coordIdx}`;
  }
  throw new Error(
    `Cannot generate pipelineFeatureId for ${cellId}/SOUNDG coord ${coordIdx}: ` +
    `RCID=${JSON.stringify(rcid)}, FIDN=${JSON.stringify(props['FIDN'])}, ` +
    `FIDS=${JSON.stringify(props['FIDS'])}. Hard pipeline failure.`
  );
}

function checkZ(z, featureId) {
  if (z === null || z === undefined) {
    throw new Error(`NULL Z value in SOUNDG coordinate for ${featureId}`);
  }
  if (typeof z !== 'number') {
    throw new Error(`Non-numeric Z value (${JSON.stringify(z)}) in SOUNDG coordinate for ${featureId}`);
  }
  if (Number.isNaN(z)) {
    throw new Error(`NaN Z value in SOUNDG coordinate for ${featureId}`);
  }
  if (!Number.isFinite(z)) {
    throw new Error(`Infinity Z value in SOUNDG coordinate for ${featureId}`);
  }
}

function checkBanned(props, context) {
  for (const field of BANNED_FIELDS) {
    if (field in props) {
      throw new Error(`Banned field '${field}' found in output for ${context}. Hard pipeline failure.`);
    }
  }
}

function makeProvenance(cellId, checksum, processedAt) {
  return { cellId, checksum, readerVersion: 'GDAL 3.2.2', processedAt };
}

function loadIntermediate(intermediateDir, cellId, className) {
  const p = path.join(intermediateDir, cellId, `${className}.geojson`);
  if (!fs.existsSync(p)) return [];
  const fc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return fc.features || [];
}

function loadMetadata(intermediateDir, cellId) {
  const p = path.join(intermediateDir, cellId, 'metadata.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: normalize.js <root_dir>');
  process.exit(1);
}

const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');
const processedDir = path.join(rootDir, 'data', 'nautical', 'processed');
fs.mkdirSync(processedDir, { recursive: true });

// Delete existing manifests at start (sequencing rule)
for (const manifest of ['pipeline-manifest.json', 'pipeline-manifest.public.json']) {
  const mp = path.join(processedDir, manifest);
  if (fs.existsSync(mp)) {
    fs.unlinkSync(mp);
    console.log(`  Deleted stale manifest: ${manifest}`);
  }
}

const processedAt = new Date().toISOString();

// Load checksums from metadata
const checksums = {};
for (const cellId of CELLS) {
  const meta = loadMetadata(intermediateDir, cellId);
  checksums[cellId] = meta.sourceChecksum || 'UNKNOWN';
}

const navMarksFeatures = [];
const depthAreasFeatures = [];
const depthContoursFeatures = [];
const soundingsFeatures = [];

// ── Navigation marks ─────────────────────────────────────────────────────────
console.log('\n  [navigation-marks]');
for (const cellId of CELLS) {
  const checksum = checksums[cellId];
  for (const className of NAV_CLASSES) {
    const feats = loadIntermediate(intermediateDir, cellId, className);
    let count = 0;
    for (const feat of feats) {
      const props = feat.properties || {};
      const lnam = props['LNAM'];
      const sourceStableId = lnam !== null && lnam !== undefined ? String(lnam) : null;
      const pid = getPipelineFeatureId(cellId, className, props);

      const outProps = {
        dolphinKind: DOLPHIN_KIND_MAP[className],
        rawObjectClass: className,
        sourceProperties: { ...props },
        sourceKind: 'official',
        official: true,
        sourceCellId: cellId,
        sourceStableId,
        pipelineFeatureId: pid,
        provenance: makeProvenance(cellId, checksum, processedAt),
      };
      if (className === 'TOPMAR') {
        outProps.associationRefsVerifiedInGdalOutput = false;
      }
      checkBanned(outProps, `${cellId}/${className}/${pid}`);
      navMarksFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
      count++;
    }
    console.log(`    ${cellId}/${className}: ${count}`);
  }
}

// ── Depth areas (DEPARE) ─────────────────────────────────────────────────────
console.log('\n  [depth-areas]');
for (const cellId of CELLS) {
  const checksum = checksums[cellId];
  const feats = loadIntermediate(intermediateDir, cellId, 'DEPARE');
  let count = 0;
  for (const feat of feats) {
    const props = feat.properties || {};
    const lnam = props['LNAM'];
    const sourceStableId = lnam !== null && lnam !== undefined ? String(lnam) : null;
    const pid = getPipelineFeatureId(cellId, 'DEPARE', props);

    const outProps = {
      rawObjectClass: 'DEPARE',
      DRVAL1: props['DRVAL1'] !== undefined ? props['DRVAL1'] : null,
      DRVAL2: props['DRVAL2'] !== undefined ? props['DRVAL2'] : null,
      ...DATUM_SCHEMA,
      sourceKind: 'official',
      sourceCellId: cellId,
      sourceStableId,
      sourceChecksum: checksum,
      pipelineFeatureId: pid,
      provenance: makeProvenance(cellId, checksum, processedAt),
      sourceProperties: { ...props },
    };
    checkBanned(outProps, `${cellId}/DEPARE/${pid}`);
    depthAreasFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
    count++;
  }
  console.log(`    ${cellId}/DEPARE: ${count}`);
}

// ── Depth contours (DEPCNT) ──────────────────────────────────────────────────
console.log('\n  [depth-contours]');
for (const cellId of CELLS) {
  const checksum = checksums[cellId];
  const feats = loadIntermediate(intermediateDir, cellId, 'DEPCNT');
  let count = 0;
  for (const feat of feats) {
    const props = feat.properties || {};
    const lnam = props['LNAM'];
    const sourceStableId = lnam !== null && lnam !== undefined ? String(lnam) : null;
    const pid = getPipelineFeatureId(cellId, 'DEPCNT', props);

    const outProps = {
      rawObjectClass: 'DEPCNT',
      VALDCO: props['VALDCO'] !== undefined ? props['VALDCO'] : null,
      ...DATUM_SCHEMA,
      sourceKind: 'official',
      sourceCellId: cellId,
      sourceStableId,
      sourceChecksum: checksum,
      pipelineFeatureId: pid,
      provenance: makeProvenance(cellId, checksum, processedAt),
      sourceProperties: { ...props },
    };
    checkBanned(outProps, `${cellId}/DEPCNT/${pid}`);
    depthContoursFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
    count++;
  }
  console.log(`    ${cellId}/DEPCNT: ${count}`);
}

// ── Soundings (SOUNDG → expand MultiPoint to Points) ────────────────────────
console.log('\n  [soundings]');
let totalSourceFeatures = 0;
for (const cellId of CELLS) {
  const checksum = checksums[cellId];
  const feats = loadIntermediate(intermediateDir, cellId, 'SOUNDG');
  let cellSource = 0;
  let cellCoords = 0;

  for (const feat of feats) {
    const props = feat.properties || {};
    const geom = feat.geometry;

    if (!geom) {
      throw new Error(`NULL geometry in SOUNDG source feature for ${cellId}. Hard failure.`);
    }
    if (geom.type !== 'MultiPoint') {
      throw new Error(
        `Expected MultiPoint geometry for SOUNDG in ${cellId}, got '${geom.type}'. Hard failure.`
      );
    }

    const lnam = props['LNAM'];
    const sourceFeatureLnam = lnam !== null && lnam !== undefined ? String(lnam) : null;
    cellSource++;
    totalSourceFeatures++;

    const coords = geom.coordinates || [];
    for (let coordIdx = 0; coordIdx < coords.length; coordIdx++) {
      const coord = coords[coordIdx];
      if (!Array.isArray(coord) || coord.length < 3) {
        throw new Error(
          `SOUNDG coordinate ${coordIdx} in ${cellId} feature (LNAM=${sourceFeatureLnam}) ` +
          `has fewer than 3 elements: ${JSON.stringify(coord)}. Hard failure.`
        );
      }
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      const z = Number(coord[2]);

      const pid = getSoundgFeatureId(cellId, props, coordIdx);
      checkZ(z, pid);

      const relation = z > 0 ? 'above' : z < 0 ? 'below' : 'at';

      const outProps = {
        chartedValueMetres: z,
        chartedValueRelationToDatum: relation,
        ...DATUM_SCHEMA,
        sourceFeatureLnam,
        sourceCellId: cellId,
        sourceChecksum: checksum,
        pipelineFeatureId: pid,
        provenance: makeProvenance(cellId, checksum, processedAt),
      };
      checkBanned(outProps, pid);

      soundingsFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: outProps,
      });
      cellCoords++;
    }
  }
  console.log(`    ${cellId}/SOUNDG: ${cellSource} source features, ${cellCoords} coordinates`);
}

// ── Write outputs ─────────────────────────────────────────────────────────────
console.log('\n  Writing output files...');
const outputs = [
  ['navigation-marks.geojson', navMarksFeatures],
  ['depth-areas.geojson', depthAreasFeatures],
  ['depth-contours.geojson', depthContoursFeatures],
  ['soundings.geojson', soundingsFeatures],
];

for (const [filename, features] of outputs) {
  const outPath = path.join(processedDir, filename);
  const content = JSON.stringify({ type: 'FeatureCollection', features });
  fs.writeFileSync(outPath, content, 'utf8');
  const size = fs.statSync(outPath).size;
  console.log(`    ${filename}: ${features.length} features, ${size.toLocaleString()} bytes`);
}

console.log(`
  Summary:
    navigation-marks:  ${navMarksFeatures.length} features
    depth-areas:       ${depthAreasFeatures.length} features
    depth-contours:    ${depthContoursFeatures.length} features
    soundings:         ${soundingsFeatures.length} features (from ${totalSourceFeatures} source features)
`);
