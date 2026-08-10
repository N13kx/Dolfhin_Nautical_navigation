#!/usr/bin/env node
'use strict';
/**
 * validate.cjs — validate per-cell IENC GeoJSON outputs and write cell-manifest.json.
 *
 * DOL-013: generic, discovery-driven. Separates validation into:
 *   A. Universal safety invariants — applied to EVERY cell regardless of origin.
 *   B. Pilot regression fixtures   — applied ONLY to cells listed in pilot-fixtures.json.
 *
 * For each cell that is NOT FULL_PASS, validates cells/<cellId>/*.geojson and writes
 * cells/<cellId>/cell-manifest.json.
 *
 * For FULL_PASS cells, the existing cell-manifest.json is reused without re-validation.
 *
 * Overall exit code:
 *   0 — all cells PASS (universal + pilot regression where applicable)
 *   1 — one or more cells FAIL
 *
 * SOUNDG sign contract (binding — regression gates enforce this):
 *   Z > 0 → relation "below"  (charted depth below chart datum)
 *   Z < 0 → relation "above"  (drying height above chart datum)
 *   Z = 0 → relation "at"
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { discoverCells, PIPELINE_SCHEMA_VERSION } = require('./discover-cells.cjs');

// ── Geometry helpers (unchanged from Task #7) ─────────────────────────────────

function* iterCoordinates(geom) {
  if (!geom) return;
  const t = geom.type, c = geom.coordinates;
  if (!c) return;
  if (t === 'Point')       { yield c; }
  else if (t === 'MultiPoint' || t === 'LineString') { for (const p of c) yield p; }
  else if (t === 'Polygon') { for (const ring of c) for (const p of ring) yield p; }
  else if (t === 'MultiLineString') { for (const l of c) for (const p of l) yield p; }
  else if (t === 'MultiPolygon') { for (const poly of c) for (const ring of poly) for (const p of ring) yield p; }
}

function checkNanInf(geom, pid, errors) {
  for (const coord of iterCoordinates(geom)) {
    for (const v of coord) {
      if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) {
        errors.push(`NaN/Infinity coordinate in geometry of ${pid}`);
        return;
      }
    }
  }
}

function computeBbox(features) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const feat of features) {
    for (const coord of iterCoordinates(feat.geometry)) {
      if (coord.length < 2) continue;
      const [lon, lat] = coord;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return (minLon === Infinity)
    ? null
    : { minLon, minLat, maxLon, maxLat };
}

function checkJsonRoundtrip(filePath, fc, errors) {
  const filename  = path.basename(filePath);
  const rawBytes  = fs.readFileSync(filePath);
  let reparsed;
  try {
    reparsed = JSON.parse(rawBytes.toString('utf8'));
  } catch (e) {
    errors.push(`JSON re-parse failed for ${filename}: ${e.message}`);
    return;
  }
  if ((reparsed.features || []).length !== (fc.features || []).length)
    errors.push(`Feature count mismatch after re-parse for ${filename}`);
  const reencoded = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: fc.features }), 'utf8');
  if (reencoded.length !== rawBytes.length)
    errors.push(`Byte count mismatch for ${filename}: written=${rawBytes.length}, reencoded=${reencoded.length}`);
}

function checkIdentifierTypes(fc, filename, errors) {
  for (const feat of fc.features || []) {
    const props = feat.properties || {};
    const pid   = props.pipelineFeatureId || 'UNKNOWN';
    const sid   = props.sourceStableId;
    if (sid !== null && sid !== undefined && typeof sid !== 'string')
      errors.push(`sourceStableId not string in ${filename} feature ${pid}: type=${typeof sid}`);
    const sp   = props.sourceProperties || {};
    const lnam = sp.LNAM;
    if (lnam !== null && lnam !== undefined && typeof lnam !== 'string')
      errors.push(`LNAM in sourceProperties not string in ${filename} feature ${pid}: type=${typeof lnam}`);
    const rcid = sp.RCID;
    if (rcid !== null && rcid !== undefined && typeof rcid === 'number') {
      if (!Number.isInteger(rcid)) errors.push(`RCID non-integer float in ${filename} feature ${pid}: ${rcid}`);
      else if (Math.abs(rcid) > Number.MAX_SAFE_INTEGER) errors.push(`RCID exceeds safe int in ${filename} feature ${pid}: ${rcid}`);
    }
    try { JSON.stringify(sp); } catch (e) {
      errors.push(`sourceProperties not JSON-safe in ${filename} feature ${pid}: ${e.message}`);
    }
  }
}

// ── Universal validation for one cell ────────────────────────────────────────

const EXPECTED_GEOM_TYPES = {
  'navigation-marks.geojson': 'Point',
  'depth-areas.geojson':      'Polygon',
  'depth-contours.geojson':   'LineString',
  'soundings.geojson':        'Point',
};
const OUTPUT_FILE_NAMES = Object.keys(EXPECTED_GEOM_TYPES);

function validateCellUniversal(cellId, cellDir) {
  const errors = [];
  let checksPassedCount = 0;
  const ok   = msg => { checksPassedCount++; };
  const fail = msg => { errors.push(msg); };

  const fileData = {};
  for (const name of OUTPUT_FILE_NAMES) {
    const filePath = path.join(cellDir, name);
    if (!fs.existsSync(filePath)) { fail(`Output file missing: ${name}`); fileData[name] = null; continue; }
    let fc;
    try { fc = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { fail(`JSON parse failed for ${name}: ${e.message}`); fileData[name] = null; continue; }
    fileData[name] = { filePath, fc };
  }
  if (Object.values(fileData).some(v => v === null)) {
    return { errors, checksPassedCount, fileData };
  }

  const { fc: navFc } = fileData['navigation-marks.geojson'];
  const { fc: depFc } = fileData['depth-areas.geojson'];
  const { fc: cntFc } = fileData['depth-contours.geojson'];
  const { fc: sndFc } = fileData['soundings.geojson'];

  // ── (c,d,j,k,l,m) Per-feature structural checks ──────────────────────────
  const allFiles = OUTPUT_FILE_NAMES.map(n => [n, fileData[n].filePath, fileData[n].fc]);

  for (const [filename, , fc] of allFiles) {
    const expectedGeomType = EXPECTED_GEOM_TYPES[filename];
    let geomE=0, nanE=0, bannedE=0, provE=0, sourceShaE=0, cellE=0, geomTypeE=0, pidMiss=0;

    for (const feat of fc.features || []) {
      const props  = feat.properties || {};
      const geom   = feat.geometry;
      const cellId2 = props.sourceCellId;
      const pid    = props.pipelineFeatureId || 'UNKNOWN';

      if (!geom || !geom.coordinates || geom.coordinates.length === 0) { geomE++; continue; }
      const nanErrs = []; checkNanInf(geom, pid, nanErrs);
      if (nanErrs.length > 0) { if (nanE < 3) errors.push(nanErrs[0]); nanE++; }

      // Banned fields
      if ('verticalDatumNapInferred' in props) { if (bannedE < 3) errors.push(`Banned field 'verticalDatumNapInferred' in ${filename}: ${pid}`); bannedE++; }
      const sp = props.sourceProperties || {};
      if ('verticalDatumNapInferred' in sp) errors.push(`Banned field in sourceProperties of ${filename}: ${pid}`);

      if (!props.provenance) { if (provE < 3) errors.push(`Missing 'provenance' in ${filename}: ${pid}`); provE++; }
      if (!cellId2)          { if (cellE < 3) errors.push(`Missing 'sourceCellId' in ${filename}: ${pid}`); cellE++; }
      if (geom.type !== expectedGeomType) { if (geomTypeE < 3) errors.push(`Geometry type mismatch in ${filename}: expected ${expectedGeomType}, got ${geom.type} for ${pid}`); geomTypeE++; }
      if (!props.pipelineFeatureId) pidMiss++;
      // A valid source SHA-256 must be present in either supported location.
      const sourceChecksums = [props.sourceChecksum, props.provenance && props.provenance.checksum];
      const hasSourceSha256 = sourceChecksums.some(value =>
        typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
      );
      if (!hasSourceSha256) {
        if (sourceShaE < 3) errors.push(`Missing or invalid source SHA-256 in ${filename}: ${pid}`);
        sourceShaE++;
      }
    }

    for (const [label, count] of [
      ['empty geometries', geomE], ['NaN/Infinity coords', nanE],
      ['banned field violations', bannedE], ['missing provenance', provE],
      ['missing or invalid source SHA-256', sourceShaE],
      ['missing sourceCellId', cellE], ['geometry type mismatches', geomTypeE],
      ['missing pipelineFeatureId', pidMiss],
    ]) {
      if (count === 0) ok(`${filename}: ${label}: 0`);
      else fail(`${filename}: ${label}: ${count}`);
    }
  }

  // ── (f) No duplicate LNAMs within cell ────────────────────────────────────
  const lnamSeen = new Set(); let lnamDups = 0;
  for (const feat of navFc.features || []) {
    const sid = (feat.properties || {}).sourceStableId;
    if (sid !== null && sid !== undefined) {
      if (lnamSeen.has(sid)) lnamDups++;
      else lnamSeen.add(sid);
    }
  }
  if (lnamDups === 0) ok('navigation-marks: no duplicate LNAMs within cell');
  else fail(`navigation-marks: ${lnamDups} duplicate LNAM(s)`);

  // ── (g) depthDatum + chartedValueRelationToDatum + S-57 sign gates ────────
  let sndMissingDatum=0, sndMissingRelation=0;
  let signPos_notBelow=0, signNeg_notAbove=0, signZero_notAt=0;
  let sndBelow=0, sndAbove=0, sndAt=0;
  const sndZValues = [];

  for (const feat of sndFc.features || []) {
    const props = feat.properties || {};
    if (!props.depthDatum) sndMissingDatum++;
    const rel = props.chartedValueRelationToDatum;
    if (!rel) sndMissingRelation++;
    else if (rel === 'below') sndBelow++;
    else if (rel === 'above') sndAbove++;
    else if (rel === 'at')    sndAt++;
    const z = props.chartedValueMetres;
    if (z !== null && z !== undefined) {
      sndZValues.push(z);
      if (z > 0 && rel !== 'below') signPos_notBelow++;
      if (z < 0 && rel !== 'above') signNeg_notAbove++;
      if (z === 0 && rel !== 'at')  signZero_notAt++;
    }
  }
  if (sndMissingDatum    === 0) ok('soundings: depthDatum present on all features');
  else fail(`soundings: depthDatum missing on ${sndMissingDatum} features`);
  if (sndMissingRelation === 0) ok('soundings: chartedValueRelationToDatum present on all features');
  else fail(`soundings: chartedValueRelationToDatum missing on ${sndMissingRelation} features`);
  // S-57 sign regression gates (BINDING — must not be weakened)
  if (signPos_notBelow  === 0) ok('soundings: Z>0 → relation="below" (S-57 sign check)');
  else fail(`soundings: S-57 sign inversion — ${signPos_notBelow} features have Z>0 but relation!="below"`);
  if (signNeg_notAbove  === 0) ok('soundings: Z<0 → relation="above" (S-57 sign check)');
  else fail(`soundings: S-57 sign inversion — ${signNeg_notAbove} features have Z<0 but relation!="above"`);
  if (signZero_notAt    === 0) ok('soundings: Z=0 → relation="at" (S-57 sign check)');
  else fail(`soundings: S-57 sign inversion — ${signZero_notAt} features have Z=0 but relation!="at"`);

  // ── (h) depthDatum on depth-areas + depth-contours ───────────────────────
  for (const [fname, fc] of [['depth-areas.geojson', depFc], ['depth-contours.geojson', cntFc]]) {
    const missing = (fc.features || []).filter(f => !(f.properties || {}).depthDatum).length;
    if (missing === 0) ok(`${fname}: depthDatum present on all features`);
    else fail(`${fname}: depthDatum missing on ${missing} features`);
  }

  // ── (i) napIdentityStatus UNVERIFIED on all depth features ───────────────
  for (const [fname, fc] of [
    ['depth-areas.geojson', depFc],
    ['depth-contours.geojson', cntFc],
    ['soundings.geojson', sndFc],
  ]) {
    const wrong = (fc.features || []).filter(f => (f.properties || {}).napIdentityStatus !== 'UNVERIFIED').length;
    if (wrong === 0) ok(`${fname}: napIdentityStatus='UNVERIFIED' on all features`);
    else fail(`${fname}: napIdentityStatus not 'UNVERIFIED' on ${wrong} features`);
  }

  // ── (n) pipelineFeatureId globally unique within cell ────────────────────
  for (const [filename, , fc] of allFiles) {
    const pidCounts = {};
    for (const feat of fc.features || []) {
      const pid = (feat.properties || {}).pipelineFeatureId;
      if (pid) pidCounts[pid] = (pidCounts[pid] || 0) + 1;
    }
    const dups = Object.entries(pidCounts).filter(([, n]) => n > 1);
    if (dups.length === 0) ok(`${filename}: pipelineFeatureId unique within cell`);
    else fail(`${filename}: ${dups.length} duplicate pipelineFeatureId(s): ${dups.slice(0,3).map(([k])=>k).join(', ')}`);
  }

  // ── (o) JSON round-trip ───────────────────────────────────────────────────
  for (const [filename, filePath, fc] of allFiles) {
    const rtE = []; checkJsonRoundtrip(filePath, fc, rtE);
    if (rtE.length > 0) rtE.forEach(e => fail(e));
    else ok(`${filename}: JSON round-trip OK`);
    const idE = []; checkIdentifierTypes(fc, filename, idE);
    if (idE.length > 0) idE.slice(0,3).forEach(e => fail(e));
    else ok(`${filename}: identifier types OK`);
  }

  // ── Compute bbox from all features ────────────────────────────────────────
  const allFeatures = allFiles.flatMap(([,,fc]) => fc.features || []);
  const bbox = computeBbox(allFeatures);

  // ── Feature counts (for manifest) ─────────────────────────────────────────
  const featureCounts = {
    'navigation-marks': (navFc.features || []).length,
    'depth-areas':      (depFc.features || []).length,
    'depth-contours':   (cntFc.features || []).length,
    'soundings':        (sndFc.features || []).length,
  };

  // SOUNDG source feature count from pipelineFeatureId structure
  const sndSrcKeys = new Set();
  for (const feat of sndFc.features || []) {
    const pid = (feat.properties || {}).pipelineFeatureId || '';
    const parts = pid.split('/');
    if (parts.length >= 3) sndSrcKeys.add(parts.slice(0, 3).join('/'));
  }
  const sndSrcCount = sndSrcKeys.size;

  return {
    errors,
    checksPassedCount,
    fileData,
    bbox,
    featureCounts,
    sndSrcCount,
    sndBelow,
    sndAbove,
    sndAt,
    sndZValues,
  };
}

// ── Pilot regression fixtures ─────────────────────────────────────────────────

function validatePilotFixtures(cellId, fileData, fixtures, errors, ok) {
  if (!(cellId in fixtures)) return; // not a pilot cell — no fixture checks

  const fix    = fixtures[cellId];
  const navFc  = fileData['navigation-marks.geojson'].fc;
  const depFc  = fileData['depth-areas.geojson'].fc;
  const cntFc  = fileData['depth-contours.geojson'].fc;
  const sndFc  = fileData['soundings.geojson'].fc;

  // Nav counts by dolphinKind
  const navCounts = {};
  for (const feat of navFc.features || []) {
    const kind = (feat.properties || {}).dolphinKind || 'UNKNOWN';
    navCounts[kind] = (navCounts[kind] || 0) + 1;
  }
  const kindMap = {
    'nav_beacon-special': 'beacon-special',
    'nav_buoy-lateral':   'buoy-lateral',
    'nav_buoy-special':   'buoy-special',
    'nav_light':          'light',
    'nav_topmark':        'topmark',
  };
  for (const [fixKey, dolphinKind] of Object.entries(kindMap)) {
    if (fixKey in fix) {
      const expected = fix[fixKey];
      const actual   = navCounts[dolphinKind] || 0;
      if (actual === expected) ok(`[PILOT] ${cellId}/nav_${dolphinKind}: ${actual}`);
      else errors.push(`[PILOT] ${cellId}/nav_${dolphinKind}: expected ${expected}, got ${actual}`);
    }
  }

  // DEPARE count
  if ('DEPARE' in fix) {
    const actual = (depFc.features || []).length;
    if (actual === fix.DEPARE) ok(`[PILOT] ${cellId}/DEPARE: ${actual}`);
    else errors.push(`[PILOT] ${cellId}/DEPARE: expected ${fix.DEPARE}, got ${actual}`);
  }

  // DEPCNT count
  if ('DEPCNT' in fix) {
    const actual = (cntFc.features || []).length;
    if (actual === fix.DEPCNT) ok(`[PILOT] ${cellId}/DEPCNT: ${actual}`);
    else errors.push(`[PILOT] ${cellId}/DEPCNT: expected ${fix.DEPCNT}, got ${actual}`);
  }

  // SOUNDG source features
  if ('SOUNDG_sourceFeatures' in fix) {
    const sndSrcKeys = new Set();
    for (const feat of sndFc.features || []) {
      const pid   = (feat.properties || {}).pipelineFeatureId || '';
      const parts = pid.split('/');
      if (parts.length >= 3) sndSrcKeys.add(parts.slice(0,3).join('/'));
    }
    const actual = sndSrcKeys.size;
    if (actual === fix.SOUNDG_sourceFeatures) ok(`[PILOT] ${cellId}/SOUNDG_sourceFeatures: ${actual}`);
    else errors.push(`[PILOT] ${cellId}/SOUNDG_sourceFeatures: expected ${fix.SOUNDG_sourceFeatures}, got ${actual}`);
  }

  // SOUNDG coordinates
  if ('SOUNDG_coordinates' in fix) {
    const actual = (sndFc.features || []).length;
    if (actual === fix.SOUNDG_coordinates) ok(`[PILOT] ${cellId}/SOUNDG_coordinates: ${actual}`);
    else errors.push(`[PILOT] ${cellId}/SOUNDG_coordinates: expected ${fix.SOUNDG_coordinates}, got ${actual}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: validate.cjs <root_dir>');
  process.exit(1);
}

const cellsBaseDir  = path.join(rootDir, 'data', 'nautical', 'cells');
const fixturesPath  = path.join(rootDir, 'test', 'nautical', 'pilot-fixtures.json');
const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');

let pilotFixtures = {};
if (fs.existsSync(fixturesPath)) {
  pilotFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  // Strip comment key
  delete pilotFixtures['_comment'];
  console.log(`  Pilot fixtures loaded for: ${Object.keys(pilotFixtures).join(', ')}`);
} else {
  console.log(`  WARNING: pilot-fixtures.json not found at ${fixturesPath} — pilot regression skipped`);
}

const cells = discoverCells(rootDir);
console.log(`  Validating ${cells.length} cell(s)...\n`);

const pipelineRunId = `${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}-${crypto.randomBytes(4).toString('hex')}`;
const validatedAt   = new Date().toISOString();

let overallPass = true;
const cellManifests = [];

for (const cell of cells) {
  const cellDir = path.join(cellsBaseDir, cell.cellId);

  if (cell.cacheStatus === 'FULL_PASS') {
    // Reuse existing PASS manifest — skip re-validation
    console.log(`  [SKIP — FULL_PASS] ${cell.cellId}: existing PASS manifest reused`);
    cellManifests.push(cell.cachedManifest);
    continue;
  }

  console.log(`  Validating: ${cell.cellId}`);
  const okMsgs  = [];
  const errors  = [];
  const ok   = msg => { okMsgs.push(msg);  process.stdout.write(`    OK  ${msg}\n`); };
  const fail = msg => { errors.push(msg);  process.stderr.write(`    FAIL ${msg}\n`); };

  const result = validateCellUniversal(cell.cellId, cellDir);
  // Relay ok counts
  result.errors.forEach(e => fail(e));

  // Pilot fixtures (if applicable)
  if (result.fileData && !Object.values(result.fileData).some(v => v === null)) {
    validatePilotFixtures(cell.cellId, result.fileData, pilotFixtures, errors, ok);
  }

  // SOUNDG signed distribution (informational)
  if (result.sndZValues) {
    console.log(`\n    SOUNDG distribution for ${cell.cellId}:`);
    console.log(`      below (Z>0, charted depth): ${result.sndBelow}`);
    console.log(`      above (Z<0, drying height): ${result.sndAbove}`);
    console.log(`      at    (Z==0):               ${result.sndAt}`);
    if (result.sndZValues.length > 0) {
      const min = Math.min(...result.sndZValues);
      const max = Math.max(...result.sndZValues);
      console.log(`      Z range: [${min.toFixed(2)}, ${max.toFixed(2)}] over ${result.sndZValues.length} coordinates`);
    }
  }

  const cellStatus = errors.length === 0 ? 'PASS' : 'FAIL';
  if (cellStatus === 'FAIL') overallPass = false;

  // Load metadata for manifest
  let meta = {};
  const metaPath = path.join(intermediateDir, cell.cellId, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  // Write cell-manifest.json
  const manifest = {
    cellId:                 cell.cellId,
    sourceFilename:         cell.filename,
    sourceSha256:           cell.sha256,
    pipelineSchemaVersion:     PIPELINE_SCHEMA_VERSION,
    pipelineRunId,
    validatedAt,
    validationStatus:       cellStatus,
    edition:                meta.DSID_EDTN || null,
    issueDate:              meta.DSID_ISDT || null,
    updateApplicationDate:  meta.DSID_UADT || null,
    producer:               meta.DSID_AGEN || null,
    vdat:                   meta.DSPM_VDAT || null,
    sdat:                   meta.DSPM_SDAT || null,
    depthDatum:             'Approximate LAT',
    depthDatumStatus:       'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
    napIdentityStatus:      'UNVERIFIED',
    bbox:                   result.bbox || null,
    featureCounts:          result.featureCounts || {},
    validationErrors:       errors,
  };

  const manifestPath = path.join(cellDir, 'cell-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n    ${cellStatus}: ${cell.cellId} — wrote cell-manifest.json (${errors.length} error(s))`);
  cellManifests.push(manifest);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n  Cell results:');
for (const m of cellManifests) {
  const errCount = (m.validationErrors || []).length;
  console.log(`    ${m.validationStatus.padEnd(5)} ${m.cellId}${errCount > 0 ? ` (${errCount} error(s))` : ''}`);
}

if (!overallPass) {
  const failedCells = cellManifests.filter(m => m.validationStatus !== 'PASS').map(m => m.cellId);
  process.stderr.write(`\nFAIL: ${failedCells.length} cell(s) failed validation: ${failedCells.join(', ')}\n`);
  process.exit(1);
}

console.log('\n  All cells PASS.\n');
