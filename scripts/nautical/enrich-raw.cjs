#!/usr/bin/env node
'use strict';
/**
 * enrich-raw.cjs — add pipeline provenance fields to a raw intermediate GeoJSON file.
 * Called by extract-raw.sh for each class/cell combination.
 * Usage: node enrich-raw.cjs <geojson_path> <cellId> <checksum> <className>
 */
const fs = require('fs');

const [, , geojsonPath, cellId, checksum, className] = process.argv;
if (!geojsonPath || !cellId || !checksum || !className) {
  process.stderr.write('Usage: enrich-raw.cjs <path> <cellId> <checksum> <className>\n');
  process.exit(1);
}

const fc = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
let count = 0;

for (const feat of fc.features || []) {
  const props = feat.properties || {};
  const lnam = props['LNAM'];
  props['sourceCellId'] = cellId;
  props['sourceChecksum'] = checksum;
  props['rawObjectClass'] = className;
  props['sourceStableId'] = (lnam !== null && lnam !== undefined) ? String(lnam) : null;
  feat.properties = props;
  count++;
}

fs.writeFileSync(geojsonPath, JSON.stringify(fc), 'utf8');
process.stdout.write(`    ${className}: ${count} features\n`);
