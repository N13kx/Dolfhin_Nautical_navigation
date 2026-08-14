'use strict';

const fs = require('fs');
const path = require('path');

function loadReleaseConfig(rootDir) {
  const configPath = path.join(rootDir, 'data', 'nautical', 'release-source-sets.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function sourceSetForCell(config, cellId) {
  const inland = config.sourceSets['inland-mandatory-14'];
  const zeeland = config.sourceSets['zeeland-validated-61'];
  if (inland.cells.includes(cellId)) return 'inland-mandatory-14';
  if (zeeland.cells.includes(cellId)) return 'zeeland-validated-61';
  throw new Error(`Cell ${cellId} is not approved for the DOL-020e release`);
}

function validateReleaseSelection(config, cells) {
  const ids = new Set(cells.map(cell => cell.cellId));
  const inland = config.sourceSets['inland-mandatory-14'];
  const missingInland = inland.cells.filter(id => !ids.has(id));
  const inlandPresent = cells.filter(cell => inland.cells.includes(cell.cellId));
  const zeeland = config.sourceSets['zeeland-validated-61'];
  const zeelandPresent = cells.filter(cell => zeeland.cells.includes(cell.cellId));
  const unknown = cells.filter(cell => !inland.cells.includes(cell.cellId) && !zeeland.cells.includes(cell.cellId));
  const errors = [];

  if (cells.length !== config.expectedTotalCells) errors.push(`Expected ${config.expectedTotalCells} cells, found ${cells.length}`);
  if (inlandPresent.length !== inland.cellCount) errors.push(`Expected ${inland.cellCount} inland cells, found ${inlandPresent.length}`);
  if (zeelandPresent.length !== config.sourceSets['zeeland-validated-61'].cellCount) errors.push(`Expected 61 Zeeland cells, found ${zeelandPresent.length}`);
  if (missingInland.length) errors.push(`Missing mandatory inland cells: ${missingInland.join(', ')}`);
  const missingZeeland = zeeland.cells.filter(id => !ids.has(id));
  if (missingZeeland.length) errors.push(`Missing validated Zeeland cells: ${missingZeeland.join(', ')}`);
  if (unknown.length) errors.push(`Unapproved cells present: ${unknown.map(cell => cell.cellId).join(', ')}`);
  return { errors, inlandPresent, zeelandPresent };
}

module.exports = { loadReleaseConfig, sourceSetForCell, validateReleaseSelection };
