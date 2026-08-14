#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadReleaseConfig, validateReleaseSelection } = require('./release-config.cjs');

const rootDir = process.argv[2];
if (!rootDir) throw new Error('Usage: validate-dol020e-release.cjs <rootDir>');

const config = loadReleaseConfig(rootDir);
const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'nautical', 'catalog.json'), 'utf8'));
const selection = validateReleaseSelection(config, catalog.cells || []);
const errors = [...selection.errors];

if (catalog.totalCells !== 75 || catalog.passCells !== 75 || catalog.failCells !== 0) {
  errors.push(`Combined validation must be 75/75 PASS; got total=${catalog.totalCells}, pass=${catalog.passCells}, fail=${catalog.failCells}`);
}

const expected = config.sourceSets['inland-mandatory-14'].auditedMetadata;
for (const cell of selection.inlandPresent) {
  const manifestPath = path.join(rootDir, 'data', 'nautical', 'cells', cell.cellId, 'cell-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const checks = [
    ['sourceSet', manifest.sourceSet, 'inland-mandatory-14'],
    ['producer/AGEN', Number(manifest.producer), expected.agen],
    ['HDAT', Number(manifest.hdat), expected.hdat],
    ['SDAT', Number(manifest.sdat), expected.sdat],
    ['VDAT', Number(manifest.vdat), expected.vdat],
    ['update number', Number(manifest.updateNumber), expected.updateNumber],
    ['depth datum label', manifest.depthDatum, null],
    ['vertical datum label', manifest.verticalDatum, null],
    ['depth datum status', manifest.depthDatumStatus, 'UNVERIFIED'],
    ['vertical datum status', manifest.verticalDatumStatus, 'UNVERIFIED'],
    ['NAP identity', manifest.napIdentityStatus, 'UNVERIFIED'],
    ['SOUNDG count', manifest.featureCounts.soundings, 0],
    ['DEPCNT count', manifest.featureCounts['depth-contours'], 0],
  ];
  for (const [label, actual, wanted] of checks) {
    if (actual !== wanted) errors.push(`${cell.cellId}: ${label} expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
  }
}

const bredaSource = path.join(rootDir, 'data', 'nautical', 'chart-source', 'inland-private', '1R7WK003.000');
const bredaText = execFileSync('ogrinfo', [
  '-al', '-q',
  '-oo', 'SPLIT_MULTIPOINT=NO',
  '-oo', 'ADD_SOUNDG_DEPTH=NO',
  '-oo', 'LNAM_REFS=YES',
  '-oo', 'UPDATES=APPLY',
  bredaSource,
], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
for (const name of ['Belcrumhaven', 'Mark', 'Markkanaal']) {
  if (!bredaText.includes(name)) errors.push(`1R7WK003: audited Breda-area name missing from complete S-57 source content: ${name}`);
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`FAIL: ${error}\n`);
  process.exit(1);
}

console.log(`DOL-020e release validation PASS: ${selection.zeelandPresent.length} Zeeland + ${selection.inlandPresent.length} inland = ${catalog.passCells} cells`);
