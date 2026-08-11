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
      streams[dataset].write(`${JSON.stringify({
        type: 'Feature',
        geometry: feature.geometry,
        properties,
      })}\n`);
      counts[dataset] += 1;
    }
  }
}

for (const stream of Object.values(streams)) stream.end();
fs.writeFileSync(path.join(outputRoot, 'build-report.json'), `${JSON.stringify({
  sourceCatalog: path.relative(process.cwd(), catalogPath),
  catalogBuiltAt: catalog.builtAt,
  totalCells: catalog.totalCells,
  passCells: catalog.passCells,
  sourceFeatureCounts: counts,
  sourceLayers: DATASETS,
  propertyPolicy: {
    retained: [...KEEP, ...PORTRAYAL, 'COLOURPrimary'],
    omitted: [
      'provenance (cell identity remains in sourceCellId; full audit stays in validated GeoJSON/manifests)',
      'sourceProperties except CATLAM/OBJNAM/BOYSHP/BCNSHP/SCAMIN/COLOURPrimary',
      'sourceChecksum (available through the validated cell manifest/catalog)',
    ],
  },
}, null, 2)}\n`);

console.log(`[IENC PMTiles] Prepared ${catalog.totalCells} PASS cells: ${JSON.stringify(counts)}`);
