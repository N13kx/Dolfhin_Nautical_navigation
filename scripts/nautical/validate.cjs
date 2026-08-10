#!/usr/bin/env node
'use strict';
/**
 * validate.js — full validation of the four normalized IENC GeoJSON outputs.
 * Part of Dolphin v0.2.1b data pipeline. Exits non-zero on any failure.
 *
 * Validation gates (from approved Task #7 plan):
 *   a. Exact per-cell feature counts by class
 *   b. Exact SOUNDG source feature count (9) and normalized count (2084)
 *   c. No empty geometries
 *   d. No NaN/Infinity coordinates
 *   e. Per-cell bbox gate (±0.005° tolerance)
 *   f. No duplicate LNAMs within same cell in navigation-marks.geojson
 *   g. depthDatum and chartedValueRelationToDatum on all soundings features
 *   h. depthDatum on all depth-areas and depth-contours features
 *   i. napIdentityStatus == "UNVERIFIED" on all depth features
 *   j. verticalDatumNapInferred absent everywhere
 *   k. provenance and sourceCellId on every feature
 *   l. Geometry type matches recorded type for class
 *   m. pipelineFeatureId present on every feature
 *   n. pipelineFeatureId globally unique within each file
 *   o. JSON round-trip safety
 */
const fs = require('fs');
const path = require('path');

// ── Expected counts ───────────────────────────────────────────────────────────
const EXPECTED_NAV_COUNTS = {
  '1R76W8LI': { 'beacon-special': 2, 'buoy-lateral': 0, 'buoy-special': 0, light: 25, topmark: 1 },
  '1R7788RI': { 'beacon-special': 0, 'buoy-lateral': 12, 'buoy-special': 5, light: 13, topmark: 14 },
};
const EXPECTED_DEPARE_COUNTS = { '1R76W8LI': 532, '1R7788RI': 393 };
const EXPECTED_DEPCNT_COUNTS = { '1R76W8LI': 528, '1R7788RI': 390 };
const EXPECTED_SOUNDG_SRC = { '1R76W8LI': 4, '1R7788RI': 5 };
const EXPECTED_SOUNDG_COORDS = { '1R76W8LI': 757, '1R7788RI': 1327 };
const EXPECTED_SOUNDG_TOTAL = 2084;
const EXPECTED_SOUNDG_SRC_TOTAL = 9;

// ── Expected geometry types ───────────────────────────────────────────────────
const EXPECTED_GEOM_TYPES = {
  'navigation-marks.geojson': 'Point',
  'depth-areas.geojson': 'Polygon',
  'depth-contours.geojson': 'LineString',
  'soundings.geojson': 'Point',
};

// ── Per-cell bounding boxes (±0.005° tolerance applied) ──────────────────────
const CELL_BBOXES = {
  '1R76W8LI': { minLon: 4.133333 - 0.005, minLat: 51.575000 - 0.005, maxLon: 4.333333 + 0.005, maxLat: 51.625000 + 0.005 },
  '1R7788RI': { minLon: 4.333333 - 0.005, minLat: 51.625000 - 0.005, maxLon: 4.533333 + 0.005, maxLat: 51.675000 + 0.005 },
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
function* iterCoordinates(geom) {
  if (!geom) return;
  const t = geom.type;
  const c = geom.coordinates;
  if (!c) return;
  if (t === 'Point') { yield c; }
  else if (t === 'MultiPoint' || t === 'LineString') { for (const p of c) yield p; }
  else if (t === 'Polygon') { for (const ring of c) for (const p of ring) yield p; }
  else if (t === 'MultiLineString') { for (const line of c) for (const p of line) yield p; }
  else if (t === 'MultiPolygon') { for (const poly of c) for (const ring of poly) for (const p of ring) yield p; }
}

function checkNanInf(geom, featureId, errors) {
  for (const coord of iterCoordinates(geom)) {
    for (const v of coord) {
      if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) {
        errors.push(`NaN/Infinity coordinate value in geometry of ${featureId}`);
        return;
      }
    }
  }
}

function checkBbox(geom, cellId, featureId, errors) {
  const bbox = CELL_BBOXES[cellId];
  if (!bbox) { errors.push(`Unknown cellId '${cellId}' for bbox check: ${featureId}`); return; }
  for (const coord of iterCoordinates(geom)) {
    if (coord.length < 2) continue;
    const [lon, lat] = coord;
    if (lon < bbox.minLon || lon > bbox.maxLon) {
      errors.push(`Longitude ${lon} out of bbox [${bbox.minLon}, ${bbox.maxLon}] for ${cellId} in ${featureId}`);
      return;
    }
    if (lat < bbox.minLat || lat > bbox.maxLat) {
      errors.push(`Latitude ${lat} out of bbox [${bbox.minLat}, ${bbox.maxLat}] for ${cellId} in ${featureId}`);
      return;
    }
  }
}

// ── JSON round-trip ───────────────────────────────────────────────────────────
function checkJsonRoundtrip(filePath, fc, errors) {
  const filename = path.basename(filePath);
  const rawBytes = fs.readFileSync(filePath);
  let reparsed;
  try {
    reparsed = JSON.parse(rawBytes.toString('utf8'));
  } catch (e) {
    errors.push(`JSON re-parse failed for ${filename}: ${e.message}`);
    return;
  }
  if ((reparsed.features || []).length !== (fc.features || []).length) {
    errors.push(`Feature count mismatch after re-parse for ${filename}`);
  }
  // Byte count check: reserialize and compare
  const reencoded = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: fc.features }), 'utf8');
  if (reencoded.length !== rawBytes.length) {
    errors.push(
      `Byte count mismatch for ${filename}: written=${rawBytes.length}, reencoded=${reencoded.length}`
    );
  }
}

function checkIdentifierTypes(fc, filename, errors) {
  for (const feat of fc.features || []) {
    const props = feat.properties || {};
    const pid = props.pipelineFeatureId || 'UNKNOWN';

    // sourceStableId must be string or null
    const sid = props.sourceStableId;
    if (sid !== null && sid !== undefined && typeof sid !== 'string') {
      errors.push(`sourceStableId is not a string in ${filename} feature ${pid}: type=${typeof sid}`);
    }

    // LNAM in sourceProperties must be string or null
    const sp = props.sourceProperties || {};
    const lnam = sp.LNAM;
    if (lnam !== null && lnam !== undefined && typeof lnam !== 'string') {
      errors.push(`LNAM in sourceProperties is not a string in ${filename} feature ${pid}: type=${typeof lnam}`);
    }

    // RCID must be safe integer if numeric
    const rcid = sp.RCID;
    if (rcid !== null && rcid !== undefined) {
      if (typeof rcid === 'number') {
        if (!Number.isInteger(rcid)) {
          errors.push(`RCID is non-integer float in ${filename} feature ${pid}: ${rcid}`);
        } else if (Math.abs(rcid) > Number.MAX_SAFE_INTEGER) {
          errors.push(`RCID exceeds safe integer range in ${filename} feature ${pid}: ${rcid}`);
        }
      }
    }

    // sourceProperties must be JSON-serializable
    try {
      JSON.stringify(sp);
    } catch (e) {
      errors.push(`sourceProperties not JSON-safe in ${filename} feature ${pid}: ${e.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: validate.js <root_dir>');
  process.exit(1);
}

const processedDir = path.join(rootDir, 'data', 'nautical', 'processed');
const errors = [];
let checksPassedCount = 0;

function ok(msg) {
  console.log(`  OK  ${msg}`);
  checksPassedCount++;
}
function fail(msg) {
  errors.push(msg);
  process.stderr.write(`  FAIL ${msg}\n`);
}

// ── Load all four files ───────────────────────────────────────────────────────
const fileData = {};
for (const name of Object.keys(EXPECTED_GEOM_TYPES)) {
  const filePath = path.join(processedDir, name);
  if (!fs.existsSync(filePath)) {
    fail(`Output file missing: ${name}`);
    fileData[name] = null;
    continue;
  }
  let fc;
  try {
    fc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`JSON parse failed for ${name}: ${e.message}`);
    fileData[name] = null;
    continue;
  }
  fileData[name] = { filePath, fc };
}

if (Object.values(fileData).some(v => v === null)) {
  const missing = Object.values(fileData).filter(v => v === null).length;
  console.error(`\nFAIL: Cannot proceed — ${missing} file(s) missing or unparseable.`);
  process.exit(1);
}

const { filePath: navPath, fc: navFc } = fileData['navigation-marks.geojson'];
const { filePath: depPath, fc: depFc } = fileData['depth-areas.geojson'];
const { filePath: cntPath, fc: cntFc } = fileData['depth-contours.geojson'];
const { filePath: sndPath, fc: sndFc } = fileData['soundings.geojson'];

// ── (a) Navigation mark counts ────────────────────────────────────────────────
const navCounts = {};
for (const feat of navFc.features || []) {
  const p = feat.properties || {};
  const cellId = p.sourceCellId || 'UNKNOWN';
  const kind = p.dolphinKind || 'UNKNOWN';
  if (!navCounts[cellId]) navCounts[cellId] = {};
  navCounts[cellId][kind] = (navCounts[cellId][kind] || 0) + 1;
}
for (const [cellId, expectedKinds] of Object.entries(EXPECTED_NAV_COUNTS)) {
  for (const [kind, expectedN] of Object.entries(expectedKinds)) {
    const actualN = (navCounts[cellId] || {})[kind] || 0;
    if (actualN === expectedN) ok(`nav-marks ${cellId}/${kind}: ${actualN}`);
    else fail(`nav-marks ${cellId}/${kind}: expected ${expectedN}, got ${actualN}`);
  }
}

// ── (a) Depth area counts ─────────────────────────────────────────────────────
const depCounts = {};
for (const feat of depFc.features || []) {
  const cellId = (feat.properties || {}).sourceCellId || 'UNKNOWN';
  depCounts[cellId] = (depCounts[cellId] || 0) + 1;
}
for (const [cellId, expectedN] of Object.entries(EXPECTED_DEPARE_COUNTS)) {
  const actualN = depCounts[cellId] || 0;
  if (actualN === expectedN) ok(`depth-areas ${cellId}: ${actualN}`);
  else fail(`depth-areas ${cellId}: expected ${expectedN}, got ${actualN}`);
}

// ── (a) Depth contour counts ──────────────────────────────────────────────────
const cntCounts = {};
for (const feat of cntFc.features || []) {
  const cellId = (feat.properties || {}).sourceCellId || 'UNKNOWN';
  cntCounts[cellId] = (cntCounts[cellId] || 0) + 1;
}
for (const [cellId, expectedN] of Object.entries(EXPECTED_DEPCNT_COUNTS)) {
  const actualN = cntCounts[cellId] || 0;
  if (actualN === expectedN) ok(`depth-contours ${cellId}: ${actualN}`);
  else fail(`depth-contours ${cellId}: expected ${expectedN}, got ${actualN}`);
}

// ── (b) SOUNDG counts ────────────────────────────────────────────────────────
const sndTotal = (sndFc.features || []).length;
if (sndTotal === EXPECTED_SOUNDG_TOTAL) ok(`soundings normalized total: ${sndTotal}`);
else fail(`soundings normalized total: expected ${EXPECTED_SOUNDG_TOTAL}, got ${sndTotal}`);

// Derive source feature count from pipelineFeatureId prefixes
const sndSrcByCell = {};
const sndCoordByCell = {};
for (const feat of sndFc.features || []) {
  const props = feat.properties || {};
  const cellId = props.sourceCellId || 'UNKNOWN';
  const pid = props.pipelineFeatureId || '';
  const parts = pid.split('/');
  if (parts.length >= 3) {
    const srcKey = parts.slice(0, 3).join('/');
    if (!sndSrcByCell[cellId]) sndSrcByCell[cellId] = new Set();
    sndSrcByCell[cellId].add(srcKey);
  }
  sndCoordByCell[cellId] = (sndCoordByCell[cellId] || 0) + 1;
}
for (const [cellId, expectedSrc] of Object.entries(EXPECTED_SOUNDG_SRC)) {
  const actualSrc = (sndSrcByCell[cellId] || new Set()).size;
  if (actualSrc === expectedSrc) ok(`soundings ${cellId} source features: ${actualSrc}`);
  else fail(`soundings ${cellId} source features: expected ${expectedSrc}, got ${actualSrc}`);
}
for (const [cellId, expectedCoords] of Object.entries(EXPECTED_SOUNDG_COORDS)) {
  const actualCoords = sndCoordByCell[cellId] || 0;
  if (actualCoords === expectedCoords) ok(`soundings ${cellId} coordinates: ${actualCoords}`);
  else fail(`soundings ${cellId} coordinates: expected ${expectedCoords}, got ${actualCoords}`);
}
const totalSrc = Object.values(sndSrcByCell).reduce((a, s) => a + s.size, 0);
if (totalSrc === EXPECTED_SOUNDG_SRC_TOTAL) ok(`soundings total source features: ${totalSrc}`);
else fail(`soundings total source features: expected ${EXPECTED_SOUNDG_SRC_TOTAL}, got ${totalSrc}`);

// ── (c,d,e,j,k,l,m) Per-feature checks ───────────────────────────────────────
const allFilesFeatures = [
  ['navigation-marks.geojson', navPath, navFc],
  ['depth-areas.geojson', depPath, depFc],
  ['depth-contours.geojson', cntPath, cntFc],
  ['soundings.geojson', sndPath, sndFc],
];

for (const [filename, , fc] of allFilesFeatures) {
  const expectedGeomType = EXPECTED_GEOM_TYPES[filename];
  let geomErrors = 0, nanErrors = 0, bboxErrors = 0, bannedErrors = 0;
  let provErrors = 0, cellErrors = 0, geomTypeErrors = 0, pidMissing = 0;

  for (const feat of fc.features || []) {
    const props = feat.properties || {};
    const geom = feat.geometry;
    const cellId = props.sourceCellId;
    const pid = props.pipelineFeatureId || 'UNKNOWN';

    // (c) No empty geometries
    if (!geom || !geom.coordinates || geom.coordinates.length === 0) {
      if (geomErrors < 3) errors.push(`Empty/null geometry in ${filename}: ${pid}`);
      geomErrors++;
      continue;
    }

    // (d) No NaN/Infinity
    const nanErrs = [];
    checkNanInf(geom, pid, nanErrs);
    if (nanErrs.length > 0) {
      if (nanErrors < 3) errors.push(nanErrs[0]);
      nanErrors++;
    }

    // (e) Bbox
    if (cellId) {
      const bboxErrs = [];
      checkBbox(geom, cellId, pid, bboxErrs);
      if (bboxErrs.length > 0) {
        if (bboxErrors < 3) errors.push(bboxErrs[0]);
        bboxErrors++;
      }
    }

    // (j) verticalDatumNapInferred must not appear
    if ('verticalDatumNapInferred' in props) {
      if (bannedErrors < 3) errors.push(`Banned field 'verticalDatumNapInferred' in ${filename}: ${pid}`);
      bannedErrors++;
    }
    const sp = props.sourceProperties || {};
    if ('verticalDatumNapInferred' in sp) {
      errors.push(`Banned field 'verticalDatumNapInferred' in sourceProperties of ${filename}: ${pid}`);
    }

    // (k) provenance and sourceCellId
    if (!props.provenance) {
      if (provErrors < 3) errors.push(`Missing 'provenance' in ${filename}: ${pid}`);
      provErrors++;
    }
    if (!cellId) {
      if (cellErrors < 3) errors.push(`Missing 'sourceCellId' in ${filename}: ${pid}`);
      cellErrors++;
    }

    // (l) Geometry type
    const actualType = geom.type;
    if (actualType !== expectedGeomType) {
      if (geomTypeErrors < 3)
        errors.push(`Geometry type mismatch in ${filename}: expected ${expectedGeomType}, got ${actualType} for ${pid}`);
      geomTypeErrors++;
    }

    // (m) pipelineFeatureId present
    if (!props.pipelineFeatureId) pidMissing++;
  }

  for (const [label, count] of [
    ['empty geometries', geomErrors],
    ['NaN/Infinity coords', nanErrors],
    ['bbox violations', bboxErrors],
    ['banned field violations', bannedErrors],
    ['missing provenance', provErrors],
    ['missing sourceCellId', cellErrors],
    ['geometry type mismatches', geomTypeErrors],
    ['missing pipelineFeatureId', pidMissing],
  ]) {
    if (count === 0) ok(`${filename}: ${label}: 0`);
    else fail(`${filename}: ${label}: ${count}`);
  }
}

// ── (f) No duplicate LNAMs within same cell in navigation-marks ───────────────
const lnamSeen = {};
let lnamDups = 0;
for (const feat of navFc.features || []) {
  const props = feat.properties || {};
  const cellId = props.sourceCellId || 'UNKNOWN';
  const sid = props.sourceStableId;
  if (sid !== null && sid !== undefined) {
    if (!lnamSeen[cellId]) lnamSeen[cellId] = new Set();
    if (lnamSeen[cellId].has(sid)) {
      if (lnamDups < 3) errors.push(`Duplicate LNAM '${sid}' in cell ${cellId} in navigation-marks.geojson`);
      lnamDups++;
    } else {
      lnamSeen[cellId].add(sid);
    }
  }
}
if (lnamDups === 0) ok('navigation-marks: no duplicate LNAMs within cell');
else fail(`navigation-marks: ${lnamDups} duplicate LNAM(s)`);

// ── (g) depthDatum and chartedValueRelationToDatum on all soundings ───────────
//
// S-57 sign convention (regression guard — must not be weakened):
//   Z > 0 → relation MUST be "below"  (charted depth below chart datum)
//   Z < 0 → relation MUST be "above"  (drying height above chart datum)
//   Z = 0 → relation MUST be "at"     (at chart datum)
//
let sndMissingDatum = 0, sndMissingRelation = 0;
let sndAbove = 0, sndBelow = 0, sndAt = 0;
// Regression counters: each tracks a specific sign-vs-relation mismatch.
let sndSignMismatch_posNotBelow = 0;  // Z>0 but relation !== "below"
let sndSignMismatch_negNotAbove = 0;  // Z<0 but relation !== "above"
let sndSignMismatch_zeroNotAt   = 0;  // Z==0 but relation !== "at"
const sndZByCell = {};
for (const feat of sndFc.features || []) {
  const props = feat.properties || {};
  if (!props.depthDatum) sndMissingDatum++;
  const rel = props.chartedValueRelationToDatum;
  if (!rel) sndMissingRelation++;
  else if (rel === 'above') sndAbove++;
  else if (rel === 'below') sndBelow++;
  else if (rel === 'at') sndAt++;
  const z = props.chartedValueMetres;
  const cellId = props.sourceCellId || 'UNKNOWN';
  if (z !== null && z !== undefined) {
    if (!sndZByCell[cellId]) sndZByCell[cellId] = [];
    sndZByCell[cellId].push(z);
    // Regression check: sign must match relation per S-57 contract.
    if (z > 0 && rel !== 'below') sndSignMismatch_posNotBelow++;
    if (z < 0 && rel !== 'above') sndSignMismatch_negNotAbove++;
    if (z === 0 && rel !== 'at')  sndSignMismatch_zeroNotAt++;
  }
}
if (sndMissingDatum === 0) ok('soundings: depthDatum present on all features');
else fail(`soundings: depthDatum missing on ${sndMissingDatum} features`);
if (sndMissingRelation === 0) ok('soundings: chartedValueRelationToDatum present on all features');
else fail(`soundings: chartedValueRelationToDatum missing on ${sndMissingRelation} features`);
// Regression gates — these will catch any re-introduction of the sign inversion.
if (sndSignMismatch_posNotBelow === 0) ok('soundings: Z>0 → relation="below" on all features (S-57 sign check)');
else fail(`soundings: S-57 sign inversion — ${sndSignMismatch_posNotBelow} features have Z>0 but relation!="below"`);
if (sndSignMismatch_negNotAbove === 0) ok('soundings: Z<0 → relation="above" on all features (S-57 sign check)');
else fail(`soundings: S-57 sign inversion — ${sndSignMismatch_negNotAbove} features have Z<0 but relation!="above"`);
if (sndSignMismatch_zeroNotAt === 0) ok('soundings: Z=0 → relation="at" on all features (S-57 sign check)');
else fail(`soundings: S-57 sign inversion — ${sndSignMismatch_zeroNotAt} features have Z=0 but relation!="at"`);

// ── (h) depthDatum on depth-areas and depth-contours ─────────────────────────
for (const [fname, fc] of [['depth-areas.geojson', depFc], ['depth-contours.geojson', cntFc]]) {
  const missing = (fc.features || []).filter(f => !(f.properties || {}).depthDatum).length;
  if (missing === 0) ok(`${fname}: depthDatum present on all features`);
  else fail(`${fname}: depthDatum missing on ${missing} features`);
}

// ── (i) napIdentityStatus == "UNVERIFIED" on all depth features ───────────────
for (const [fname, fc] of [
  ['depth-areas.geojson', depFc],
  ['depth-contours.geojson', cntFc],
  ['soundings.geojson', sndFc],
]) {
  const wrong = (fc.features || []).filter(f => (f.properties || {}).napIdentityStatus !== 'UNVERIFIED').length;
  if (wrong === 0) ok(`${fname}: napIdentityStatus='UNVERIFIED' on all features`);
  else fail(`${fname}: napIdentityStatus not 'UNVERIFIED' on ${wrong} features`);
}

// ── (n) pipelineFeatureId globally unique within each file ───────────────────
for (const [filename, , fc] of allFilesFeatures) {
  const pidCounts = {};
  for (const feat of fc.features || []) {
    const pid = (feat.properties || {}).pipelineFeatureId;
    if (pid) pidCounts[pid] = (pidCounts[pid] || 0) + 1;
  }
  const dups = Object.entries(pidCounts).filter(([, n]) => n > 1);
  if (dups.length === 0) ok(`${filename}: pipelineFeatureId globally unique`);
  else fail(`${filename}: ${dups.length} duplicate pipelineFeatureId(s): ${dups.slice(0, 3).map(([k]) => k).join(', ')}`);
}

// ── (o) JSON round-trip safety ────────────────────────────────────────────────
for (const [filename, filePath, fc] of allFilesFeatures) {
  const rtErrors = [];
  checkJsonRoundtrip(filePath, fc, rtErrors);
  if (rtErrors.length > 0) rtErrors.forEach(e => fail(e));
  else ok(`${filename}: JSON round-trip OK`);

  const idErrors = [];
  checkIdentifierTypes(fc, filename, idErrors);
  if (idErrors.length > 0) idErrors.slice(0, 3).forEach(e => fail(e));
  else ok(`${filename}: identifier types OK (LNAM=string, RCID=safe-int)`);
}

// ── SOUNDG signed distribution summary (informational) ───────────────────────
// S-57 contract: Z>0 = below datum (charted depth), Z<0 = above datum (drying height)
console.log(`\n  SOUNDG signed distribution:`);
console.log(`    below (Z>0, charted depth):  ${sndBelow}`);
console.log(`    above (Z<0, drying height):  ${sndAbove}`);
console.log(`    at    (Z==0):                ${sndAt}`);
for (const cellId of ['1R76W8LI', '1R7788RI']) {
  const zs = sndZByCell[cellId] || [];
  if (zs.length > 0) {
    console.log(`    ${cellId}: Z range [${Math.min(...zs).toFixed(2)}, ${Math.max(...zs).toFixed(2)}] over ${zs.length} coordinates`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  Checks passed: ${checksPassedCount}`);
console.log(`  Errors: ${errors.length}`);

if (errors.length > 0) {
  process.stderr.write('\nFAIL: Validation errors:\n');
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exit(1);
}
