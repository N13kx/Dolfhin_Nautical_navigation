#!/usr/bin/env node
'use strict';
/**
 * normalize.cjs — normalize IENC intermediate GeoJSON into per-cell + flat outputs.
 *
 * DOL-013: generic, discovery-driven. Replaces hardcoded two-cell CELLS constant.
 *
 * Produces per-cell output in data/nautical/cells/<cellId>/:
 *   navigation-marks.geojson
 *   depth-areas.geojson
 *   depth-contours.geojson
 *   soundings.geojson
 *
 * ALSO produces flat merged files in data/nautical/processed/ for frontend
 * compatibility (DOL-013b will migrate the frontend to per-cell paths):
 *   navigation-marks.geojson
 *   depth-areas.geojson
 *   depth-contours.geojson
 *   soundings.geojson
 *
 * FULL_PASS cells (cell-manifest.json PASS + SHA match + all 4 files present):
 *   → their features are read from existing cells/<cellId>/ output (not re-normalized)
 *   → they contribute to the flat merged files unchanged
 *
 * INTERMEDIATE_HIT / newly-extracted cells:
 *   → processed from intermediate/<cellId>/*.geojson
 *   → written to cells/<cellId>/ + flat merged files
 *
 * Safety semantics (binding — must not be weakened):
 *   - Raw source files are never touched.
 *   - chartedValueMetres stores the original signed Z unchanged.
 *   - NEVER abs() during normalization.
 *   - Z > 0 = charted depth below datum = relation "below"
 *   - Z < 0 = drying height above datum = relation "above"
 *   - Z = 0 = at datum                  = relation "at"
 *   - SDAT 42 = Approximate LAT (VERIFIED_FROM_OFFICIAL_DOCUMENTATION)
 *   - VDAT 24 = Local Datum (NAP identity UNVERIFIED)
 *   - verticalDatumNapInferred must never appear in output.
 */
const fs   = require('fs');
const path = require('path');
const { discoverCells } = require('./discover-cells.cjs');

const NAV_CLASSES = ['BCNSPP', 'BOYLAT', 'BOYSPP', 'LIGHTS', 'TOPMAR'];

const DOLPHIN_KIND_MAP = {
  BCNSPP: 'beacon-special',
  BOYLAT: 'buoy-lateral',
  BOYSPP: 'buoy-special',
  LIGHTS: 'light',
  TOPMAR: 'topmark',
};

const DATUM_SCHEMA = {
  depthDatum:           'Approximate LAT',
  depthDatumCode:       42,
  depthDatumStatus:     'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
  verticalDatum:        'Local Datum',
  verticalDatumCode:    24,
  napIdentityStatus:    'UNVERIFIED',
};

const BANNED_FIELDS = new Set(['verticalDatumNapInferred']);

// ── Helpers (unchanged from validated Task #7 implementation) ─────────────────

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
    `RCID=${JSON.stringify(rcid)}. Hard pipeline failure.`
  );
}

function checkZ(z, featureId) {
  if (z === null || z === undefined) throw new Error(`NULL Z in SOUNDG coord for ${featureId}`);
  if (typeof z !== 'number')         throw new Error(`Non-numeric Z (${JSON.stringify(z)}) for ${featureId}`);
  if (Number.isNaN(z))               throw new Error(`NaN Z for ${featureId}`);
  if (!Number.isFinite(z))           throw new Error(`Infinity Z for ${featureId}`);
}

function checkBanned(props, context) {
  for (const field of BANNED_FIELDS) {
    if (field in props) {
      throw new Error(`Banned field '${field}' found for ${context}. Hard pipeline failure.`);
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

// ── Per-cell normalization ────────────────────────────────────────────────────

function normalizeCellFromIntermediate(cellId, checksum, intermediateDir, processedAt) {
  const meta          = loadMetadata(intermediateDir, cellId);
  const actualChecksum = meta.sourceChecksum || checksum;
  const navFeatures   = [];
  const depFeatures   = [];
  const cntFeatures   = [];
  const sndFeatures   = [];
  let sndSrcCount = 0;
  let sndCoordCount = 0;

  // Navigation marks
  console.log(`\n    [nav-marks] ${cellId}`);
  for (const className of NAV_CLASSES) {
    const feats = loadIntermediate(intermediateDir, cellId, className);
    let count = 0;
    for (const feat of feats) {
      const props         = feat.properties || {};
      const lnam          = props['LNAM'];
      const sourceStableId = lnam !== null && lnam !== undefined ? String(lnam) : null;
      const pid           = getPipelineFeatureId(cellId, className, props);
      const outProps = {
        dolphinKind:      DOLPHIN_KIND_MAP[className],
        rawObjectClass:   className,
        sourceProperties: { ...props },
        sourceKind:       'official',
        official:         true,
        sourceCellId:     cellId,
        sourceStableId,
        pipelineFeatureId: pid,
        provenance:       makeProvenance(cellId, actualChecksum, processedAt),
      };
      if (className === 'TOPMAR') outProps.associationRefsVerifiedInGdalOutput = false;
      checkBanned(outProps, `${cellId}/${className}/${pid}`);
      navFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
      count++;
    }
    console.log(`      ${cellId}/${className}: ${count}`);
  }

  // Depth areas
  console.log(`\n    [depth-areas] ${cellId}`);
  const depFeats = loadIntermediate(intermediateDir, cellId, 'DEPARE');
  for (const feat of depFeats) {
    const props = feat.properties || {};
    const lnam  = props['LNAM'];
    const pid   = getPipelineFeatureId(cellId, 'DEPARE', props);
    const outProps = {
      rawObjectClass: 'DEPARE',
      DRVAL1: props['DRVAL1'] !== undefined ? props['DRVAL1'] : null,
      DRVAL2: props['DRVAL2'] !== undefined ? props['DRVAL2'] : null,
      ...DATUM_SCHEMA,
      sourceKind:       'official',
      sourceCellId:     cellId,
      sourceStableId:   lnam !== null && lnam !== undefined ? String(lnam) : null,
      sourceChecksum:   actualChecksum,
      pipelineFeatureId: pid,
      provenance:       makeProvenance(cellId, actualChecksum, processedAt),
      sourceProperties: { ...props },
    };
    checkBanned(outProps, `${cellId}/DEPARE/${pid}`);
    depFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
  }
  console.log(`      ${cellId}/DEPARE: ${depFeats.length}`);

  // Depth contours
  console.log(`\n    [depth-contours] ${cellId}`);
  const cntFeats = loadIntermediate(intermediateDir, cellId, 'DEPCNT');
  for (const feat of cntFeats) {
    const props = feat.properties || {};
    const lnam  = props['LNAM'];
    const pid   = getPipelineFeatureId(cellId, 'DEPCNT', props);
    const outProps = {
      rawObjectClass: 'DEPCNT',
      VALDCO: props['VALDCO'] !== undefined ? props['VALDCO'] : null,
      ...DATUM_SCHEMA,
      sourceKind:       'official',
      sourceCellId:     cellId,
      sourceStableId:   lnam !== null && lnam !== undefined ? String(lnam) : null,
      sourceChecksum:   actualChecksum,
      pipelineFeatureId: pid,
      provenance:       makeProvenance(cellId, actualChecksum, processedAt),
      sourceProperties: { ...props },
    };
    checkBanned(outProps, `${cellId}/DEPCNT/${pid}`);
    cntFeatures.push({ type: 'Feature', geometry: feat.geometry, properties: outProps });
  }
  console.log(`      ${cellId}/DEPCNT: ${cntFeats.length}`);

  // Soundings — expand MultiPoint to Points
  console.log(`\n    [soundings] ${cellId}`);
  const sndSrcFeats = loadIntermediate(intermediateDir, cellId, 'SOUNDG');
  for (const feat of sndSrcFeats) {
    const props = feat.properties || {};
    const geom  = feat.geometry;
    if (!geom) throw new Error(`NULL geometry in SOUNDG for ${cellId}. Hard failure.`);
    if (geom.type !== 'MultiPoint')
      throw new Error(`Expected MultiPoint for SOUNDG in ${cellId}, got '${geom.type}'. Hard failure.`);
    const lnam           = props['LNAM'];
    const sourceFeatureLnam = lnam !== null && lnam !== undefined ? String(lnam) : null;
    sndSrcCount++;
    const coords = geom.coordinates || [];
    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      if (!Array.isArray(coord) || coord.length < 3)
        throw new Error(`SOUNDG coord ${i} in ${cellId} has < 3 elements: ${JSON.stringify(coord)}. Hard failure.`);
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      const z   = Number(coord[2]);
      const pid = getSoundgFeatureId(cellId, props, i);
      checkZ(z, pid);
      // S-57 sign convention (BINDING — never invert):
      //   Z > 0 → charted depth BELOW chart datum  → relation = "below"
      //   Z < 0 → drying height ABOVE chart datum  → relation = "above"
      //   Z = 0 → at chart datum                   → relation = "at"
      // chartedValueMetres stores original signed Z. NEVER apply abs() here.
      const relation = z > 0 ? 'below' : z < 0 ? 'above' : 'at';
      const outProps = {
        chartedValueMetres:            z,
        chartedValueRelationToDatum:   relation,
        ...DATUM_SCHEMA,
        sourceFeatureLnam,
        sourceCellId:     cellId,
        sourceChecksum:   actualChecksum,
        pipelineFeatureId: pid,
        provenance:       makeProvenance(cellId, actualChecksum, processedAt),
      };
      checkBanned(outProps, pid);
      sndFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: outProps,
      });
      sndCoordCount++;
    }
  }
  console.log(`      ${cellId}/SOUNDG: ${sndSrcCount} source features, ${sndCoordCount} coordinates`);

  return { navFeatures, depFeatures, cntFeatures, sndFeatures, sndSrcCount, sndCoordCount };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [, , rootDir] = process.argv;
if (!rootDir) {
  console.error('Usage: normalize.cjs <root_dir>');
  process.exit(1);
}

const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');
const processedDir    = path.join(rootDir, 'data', 'nautical', 'processed');
const cellsBaseDir    = path.join(rootDir, 'data', 'nautical', 'cells');
fs.mkdirSync(processedDir, { recursive: true });
fs.mkdirSync(cellsBaseDir, { recursive: true });

// Delete stale flat manifests (sequencing rule)
for (const manifest of ['pipeline-manifest.json', 'pipeline-manifest.public.json']) {
  const mp = path.join(processedDir, manifest);
  if (fs.existsSync(mp)) { fs.unlinkSync(mp); console.log(`  Deleted stale manifest: ${manifest}`); }
}

const processedAt = new Date().toISOString();

// Discover cells
const cells = discoverCells(rootDir);
console.log(`\n  Discovered ${cells.length} cell(s):`);
for (const c of cells) {
  console.log(`    ${c.cellId} [${c.cacheStatus}] sha=${c.sha256.slice(0,16)}...`);
}

// Identity conflict check
for (const c of cells) {
  if (c.idConflict) {
    throw new Error(
      `CellId identity conflict for ${c.filename}: ${c.idConflictDetail}. ` +
      `Source identity cannot be verified. Pipeline aborted.`
    );
  }
}

// Accumulate for flat merged output
const allNav = [];
const allDep = [];
const allCnt = [];
const allSnd = [];
let totalSndSrc = 0;

const OUTPUT_FILES = [
  'navigation-marks.geojson',
  'depth-areas.geojson',
  'depth-contours.geojson',
  'soundings.geojson',
];

console.log('\n  Processing cells:');

for (const cell of cells) {
  const cellDir = path.join(cellsBaseDir, cell.cellId);
  fs.mkdirSync(cellDir, { recursive: true });

  if (cell.cacheStatus === 'FULL_PASS') {
    // Read existing per-cell output into flat merge — skip re-normalization
    console.log(`\n  [SKIP — FULL_PASS] ${cell.cellId}`);
    for (const [file, arr] of [
      ['navigation-marks.geojson', allNav],
      ['depth-areas.geojson', allDep],
      ['depth-contours.geojson', allCnt],
      ['soundings.geojson', allSnd],
    ]) {
      const p = path.join(cellDir, file);
      if (!fs.existsSync(p)) throw new Error(`FULL_PASS cell ${cell.cellId} missing output file: ${file}`);
      const fc = JSON.parse(fs.readFileSync(p, 'utf8'));
      arr.push(...(fc.features || []));
    }
    continue;
  }

  // Verify intermediate is available (should be guaranteed by build.sh)
  if (!cell.intermediateComplete) {
    throw new Error(
      `Cell ${cell.cellId} is not FULL_PASS and intermediate is incomplete. ` +
      `Run build.sh — it must extract GDAL data for DIRTY cells before normalize.`
    );
  }

  // Normalize from intermediate
  const { navFeatures, depFeatures, cntFeatures, sndFeatures, sndSrcCount } =
    normalizeCellFromIntermediate(cell.cellId, cell.sha256, intermediateDir, processedAt);

  // Write per-cell output
  const cellOutputs = [
    ['navigation-marks.geojson', navFeatures],
    ['depth-areas.geojson',      depFeatures],
    ['depth-contours.geojson',   cntFeatures],
    ['soundings.geojson',        sndFeatures],
  ];
  for (const [filename, features] of cellOutputs) {
    const outPath = path.join(cellDir, filename);
    fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8');
  }
  console.log(`\n    Written: cells/${cell.cellId}/ (${navFeatures.length} nav, ${depFeatures.length} dep, ${cntFeatures.length} cnt, ${sndFeatures.length} snd)`);

  // Accumulate for flat merge
  allNav.push(...navFeatures);
  allDep.push(...depFeatures);
  allCnt.push(...cntFeatures);
  allSnd.push(...sndFeatures);
  totalSndSrc += sndSrcCount;
}

// Write flat merged files (frontend compatibility)
console.log('\n  Writing flat processed/ files (frontend compat)...');
const flatOutputs = [
  ['navigation-marks.geojson', allNav],
  ['depth-areas.geojson',      allDep],
  ['depth-contours.geojson',   allCnt],
  ['soundings.geojson',        allSnd],
];
for (const [filename, features] of flatOutputs) {
  const outPath = path.join(processedDir, filename);
  const content = JSON.stringify({ type: 'FeatureCollection', features });
  fs.writeFileSync(outPath, content, 'utf8');
  const size = fs.statSync(outPath).size;
  console.log(`    ${filename}: ${features.length} features, ${size.toLocaleString()} bytes`);
}

console.log(`
  Summary:
    navigation-marks:  ${allNav.length} features (${cells.length} cells)
    depth-areas:       ${allDep.length} features
    depth-contours:    ${allCnt.length} features
    soundings:         ${allSnd.length} features (from ${totalSndSrc} source features)
`);
