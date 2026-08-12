#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATASETS = ['navigation-marks', 'depth-areas', 'depth-contours', 'soundings'];
const KEEP = [
  'pipelineFeatureId', 'sourceCellId', 'sourceStableId',
  'dolphinKind', 'rawObjectClass',
  'chartedValueMetres', 'chartedValueRelationToDatum',
  'depthDatum', 'depthDatumCode', 'depthDatumStatus',
  'verticalDatum', 'verticalDatumCode', 'napIdentityStatus',
  'sourceKind', 'official', 'DRVAL1', 'DRVAL2', 'VALDCO',
];
const PORTRAYAL = ['CATLAM', 'OBJNAM', 'BOYSHP', 'BCNSHP', 'SCAMIN'];

function fail(message) {
  console.error(`[IENC PMTiles] ${message}`);
  process.exit(1);
}

const [inputRoot, outputRoot, mode = 'strict'] = process.argv.slice(2);
if (!inputRoot || !outputRoot) {
  fail('Usage: prepare-pmtiles-input.cjs INPUT_NAUTICAL_DIR OUTPUT_DIR [strict|allow-partial]');
}

const catalogPath = path.join(inputRoot, 'catalog.json');
if (!fs.existsSync(catalogPath)) fail(`Missing catalog: ${catalogPath}`);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
if (catalog.failCells !== 0 || catalog.passCells !== catalog.totalCells) {
  fail(`Catalog is not all-PASS (${catalog.passCells}/${catalog.totalCells}, fail=${catalog.failCells})`);
}
if (mode !== 'allow-partial' && (catalog.totalCells !== 61 || catalog.passCells !== 61)) {
  fail(`Strict Zeeland build requires 61/61 PASS cells, got ${catalog.passCells}/${catalog.totalCells}`);
}

fs.mkdirSync(outputRoot, { recursive: true });
const streams = Object.fromEntries(DATASETS.map((name) => [
  name,
  fs.createWriteStream(path.join(outputRoot, `${name}.ndjson`), { encoding: 'utf8' }),
]));
const counts = Object.fromEntries(DATASETS.map((name) => [name, 0]));

// ── Sparse sounding selection for soundings-sparse source layer ──────────
//
// Produces a deterministic geographic subset for zoom 10–11 portrayal:
//   - One shallowest "below"-datum sounding per 0.01° × 0.01° grid cell (~1 km).
//   - All "above" (drying heights) and "at" soundings are always included —
//     they are rare and carry safety-critical information.
//
// Every feature in soundings-sparse is a real validated SOUNDG feature.
// No values are averaged, interpolated, or synthesised.
// Selection is deterministic: same validated input → same output every build.
// ─────────────────────────────────────────────────────────────────────────
const SPARSE_GRID_DEG = 0.01;
/** Map from `${gridX}:${gridY}` → shallowest below-datum feature object. */
const sparseGrid = new Map();
/** All above/at soundings — included verbatim in the sparse layer. */
const sparseNonBelow = [];
const sparseStream = fs.createWriteStream(
  path.join(outputRoot, 'soundings-sparse.ndjson'), { encoding: 'utf8' },
);

for (const cell of [...catalog.cells].sort((a, b) => a.cellId.localeCompare(b.cellId))) {
  if (cell.validationStatus !== 'PASS') fail(`Cell ${cell.cellId} is not PASS`);
  for (const dataset of DATASETS) {
    const relativeFile = cell.files?.[dataset];
    if (typeof relativeFile !== 'string' || relativeFile.includes('..') || path.isAbsolute(relativeFile)) {
      fail(`Unsafe ${dataset} file reference for ${cell.cellId}`);
    }
    const file = path.join(inputRoot, relativeFile);
    const collection = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
      fail(`${file} is not a FeatureCollection`);
    }
    if (collection.features.length !== cell.featureCounts[dataset]) {
      fail(`${cell.cellId}/${dataset} count mismatch (${collection.features.length} != ${cell.featureCounts[dataset]})`);
    }

    for (const feature of collection.features) {
      if (!feature || feature.type !== 'Feature' || !feature.geometry) continue;
      const source = feature.properties ?? {};
      const sourceProperties = source.sourceProperties ?? {};
      const properties = {};
      for (const key of KEEP) {
        const value = source[key];
        if (value !== undefined && value !== null && typeof value !== 'object') properties[key] = value;
      }
      if (properties.official === undefined && properties.sourceKind === 'official') properties.official = true;
      for (const key of PORTRAYAL) {
        const value = sourceProperties[key] ?? source[key];
        if (value !== undefined && value !== null && typeof value !== 'object') properties[key] = value;
      }
      const colour = sourceProperties.COLOUR ?? source.COLOUR;
      if (Array.isArray(colour) && colour.length > 0) properties.COLOURPrimary = String(colour[0]);
      if (!properties.dolphinKind) {
        properties.dolphinKind = dataset === 'depth-areas' ? 'depth-area'
          : dataset === 'depth-contours' ? 'depth-contour'
            : dataset === 'soundings' ? 'sounding' : undefined;
      }
      const outFeature = {
        type: 'Feature',
        geometry: feature.geometry,
        properties,
      };
      streams[dataset].write(`${JSON.stringify(outFeature)}\n`);
      counts[dataset] += 1;

      // ── Accumulate soundings into the sparse grid ──────────────────
      if (dataset === 'soundings') {
        const coords = feature.geometry.coordinates;
        const relation = properties.chartedValueRelationToDatum;
        if (relation !== 'below') {
          // Drying heights (above) and datum-level (at) — always include.
          sparseNonBelow.push(outFeature);
        } else {
          // Below-datum: keep the shallowest feature per ~1 km grid cell.
          const lon = Number(Array.isArray(coords) ? coords[0] : 0);
          const lat = Number(Array.isArray(coords) ? coords[1] : 0);
          const gx = Math.floor(lon / SPARSE_GRID_DEG);
          const gy = Math.floor(lat / SPARSE_GRID_DEG);
          const key = `${gx}:${gy}`;
          // chartedValueMetres is positive for below-datum; smaller = shallower.
          const depth = Number(properties.chartedValueMetres ?? 0);
          const existing = sparseGrid.get(key);
          if (!existing || depth < Number(existing.properties.chartedValueMetres ?? Infinity)) {
            sparseGrid.set(key, outFeature);
          }
        }
      }
    }
  }
}

for (const stream of Object.values(streams)) stream.end();

// Write soundings-sparse: grid-selected below-datum + all above/at soundings.
const sparseBelow = [...sparseGrid.values()];
for (const f of sparseBelow) sparseStream.write(`${JSON.stringify(f)}\n`);
for (const f of sparseNonBelow) sparseStream.write(`${JSON.stringify(f)}\n`);
sparseStream.end();
const sparseCount = sparseBelow.length + sparseNonBelow.length;

const sourceFeatureCounts = { ...counts, 'soundings-sparse': sparseCount };
fs.writeFileSync(path.join(outputRoot, 'build-report.json'), `${JSON.stringify({
  sourceCatalog: path.relative(process.cwd(), catalogPath),
  catalogBuiltAt: catalog.builtAt,
  totalCells: catalog.totalCells,
  passCells: catalog.passCells,
  sourceFeatureCounts,
  sourceLayers: [...DATASETS, 'soundings-sparse'],
  propertyPolicy: {
    retained: [...KEEP, ...PORTRAYAL, 'COLOURPrimary'],
    omitted: [
      'provenance (cell identity remains in sourceCellId; full audit stays in validated GeoJSON/manifests)',
      'sourceProperties except CATLAM/OBJNAM/BOYSHP/BCNSHP/SCAMIN/COLOURPrimary',
      'sourceChecksum (available through the validated cell manifest/catalog)',
    ],
  },
  soundingsSparseStrategy: {
    gridDegrees: SPARSE_GRID_DEG,
    description: 'One shallowest below-datum sounding per 0.01-degree grid cell; all above/at soundings included',
    syntheticFeatures: false,
    valuesModified: false,
  },
}, null, 2)}\n`);

console.log(`[IENC PMTiles] Prepared ${catalog.totalCells} PASS cells: ${JSON.stringify(counts)}`);
console.log(`[IENC PMTiles] soundings-sparse: ${sparseBelow.length} grid cells + ${sparseNonBelow.length} above/at = ${sparseCount} total`);
