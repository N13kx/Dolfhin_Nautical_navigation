#!/usr/bin/env node
'use strict';
/**
 * discover-cells.cjs — auto-discover IENC source cells recursively from chart-source/.
 *
 * Source folders are ORGANISATIONAL ONLY. Their names (for example Zeeland,
 * Nederland, Friesland) never become nautical metadata and are never used to
 * infer cell identity, datum, producer, coverage, or safety semantics.
 *
 * For each *.000 file found anywhere below chart-source/:
 *   - derives candidate cellId from the SOURCE FILE BASENAME (pre-underscore or pre-dot segment)
 *   - computes SHA-256 of the source file
 *   - checks intermediate cache (intermediate/<cellId>/metadata.json + 8 class files)
 *   - checks full cell output cache (cells/<cellId>/cell-manifest.json + 4 output files)
 *   - verifies filename-derived cellId against DSID_DSNM from metadata (if available)
 *   - hard-fails duplicate/ambiguous cell IDs before processing
 *
 * Cache statuses:
 *   FULL_PASS        — cell-manifest.json PASS + SHA and cache-schema match
 *                      + all 4 output files present
 *                      → safe to skip expensive reprocessing
 *   INTERMEDIATE_HIT — intermediate/<cellId>/ complete + SHA match, but no PASS cell output
 *                      → safe to skip GDAL extraction; run normalize + validate
 *   DIRTY            — no usable cache; full extraction required (GDAL needed)
 *
 * Outputs JSON array of cell objects to stdout.
 * Usage: node discover-cells.cjs <rootDir>
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLASSES      = ['BCNSPP', 'BOYLAT', 'BOYSPP', 'LIGHTS', 'TOPMAR', 'DEPARE', 'DEPCNT', 'SOUNDG'];
const OUTPUT_FILES = ['navigation-marks.geojson', 'depth-areas.geojson', 'depth-contours.geojson', 'soundings.geojson'];
const PIPELINE_SCHEMA_VERSION = 1;

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function deriveCellIdFromFilename(filename) {
  // Candidate only. Official DSID_DSNM remains the verification source when available.
  const base = path.basename(filename, '.000');
  const underscoreIdx = base.indexOf('_');
  return underscoreIdx !== -1 ? base.slice(0, underscoreIdx) : base;
}

function findSourceFilesRecursive(chartSourceDir) {
  const found = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      // Do not traverse directory symlinks. File symlinks are allowed because existing
      // Replit provisioning uses them; the SHA is calculated from the resolved bytes.
      if ((entry.isFile() || entry.isSymbolicLink()) && entry.name.toLowerCase().endsWith('.000')) {
        found.push(path.relative(chartSourceDir, fullPath));
      }
    }
  }

  walk(chartSourceDir);
  return found.sort((a, b) => a.localeCompare(b));
}

function discoverCells(rootDir) {
  const chartSourceDir = path.join(rootDir, 'data', 'nautical', 'chart-source');
  const intermediateDir = path.join(rootDir, 'data', 'nautical', 'intermediate');
  const cellsDir        = path.join(rootDir, 'data', 'nautical', 'cells');

  if (!fs.existsSync(chartSourceDir)) {
    throw new Error(`chart-source directory not found: ${chartSourceDir}`);
  }

  const files = findSourceFilesRecursive(chartSourceDir);

  if (files.length === 0) {
    throw new Error(`No *.000 files found recursively in ${chartSourceDir}`);
  }

  // Duplicate cell IDs are unsafe: never choose one source silently based on folder or sort order.
  const byCandidateCellId = new Map();
  for (const relativePath of files) {
    const cellId = deriveCellIdFromFilename(path.basename(relativePath));
    const existing = byCandidateCellId.get(cellId) || [];
    existing.push(relativePath);
    byCandidateCellId.set(cellId, existing);
  }
  const duplicates = [...byCandidateCellId.entries()].filter(([, paths]) => paths.length > 1);
  if (duplicates.length > 0) {
    const detail = duplicates
      .map(([cellId, paths]) => `${cellId}: ${paths.join(', ')}`)
      .join('\n  ');
    throw new Error(
      `Duplicate/ambiguous IENC cellId(s) discovered. Keep exactly one intended source file per cell.\n  ${detail}`
    );
  }

  const cells = [];

  for (const filename of files) {
    const sourcePath = path.join(chartSourceDir, filename);

    // Resolve symlinks to compute SHA of the actual source bytes.
    const realPath = fs.realpathSync(sourcePath);

    // Candidate cellId from the file BASENAME; parent folders never influence identity.
    const cellId = deriveCellIdFromFilename(path.basename(filename));

    // Organisational source group only. Never treated as nautical truth.
    const relativeDir = path.dirname(filename);
    const sourceGroup = relativeDir === '.' ? null : relativeDir.split(path.sep)[0];

    // SHA-256 of source
    const sha256 = sha256File(realPath);

    // ── Intermediate cache check ─────────────────────────────────────
    const intDir    = path.join(intermediateDir, cellId);
    const metaPath  = path.join(intDir, 'metadata.json');
    let metadataCached       = false;
    let intermediateComplete = false;
    let metadata             = null;

    if (fs.existsSync(metaPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (metadata.sourceChecksum === sha256) {
          metadataCached = true;
          intermediateComplete = CLASSES.every(
            cls => fs.existsSync(path.join(intDir, `${cls}.geojson`))
          );
        }
      } catch {
        // corrupt metadata.json → treat as cache miss
      }
    }

    // ── Full cell-output cache check ─────────────────────────────────
    const cellDir          = path.join(cellsDir, cellId);
    const cellManifestPath = path.join(cellDir, 'cell-manifest.json');
    let cachedManifest     = null;
    let cellOutputComplete = false;

    if (fs.existsSync(cellManifestPath)) {
      try {
        cachedManifest = JSON.parse(fs.readFileSync(cellManifestPath, 'utf8'));
        if (
          cachedManifest.sourceSha256 === sha256 &&
          cachedManifest.validationStatus === 'PASS' &&
          cachedManifest.pipelineSchemaVersion === PIPELINE_SCHEMA_VERSION
        ) {
          cellOutputComplete = OUTPUT_FILES.every(
            f => fs.existsSync(path.join(cellDir, f))
          );
        }
      } catch {
        // corrupt manifest → treat as cache miss
      }
    }

    // ── Cache status ─────────────────────────────────────────────────
    let cacheStatus;
    if (cellOutputComplete) {
      cacheStatus = 'FULL_PASS';
    } else if (intermediateComplete) {
      cacheStatus = 'INTERMEDIATE_HIT';
    } else {
      cacheStatus = 'DIRTY';
    }

    // ── CellId identity verification from metadata ───────────────────
    let idVerified = false;
    let idConflict = false;
    let idConflictDetail = null;

    if (metadataCached && metadata && metadata.DSID_DSNM) {
      // DSID_DSNM is typically "<CellId>.000" — strip the extension
      const metaCellId = String(metadata.DSID_DSNM).replace(/\.000$/i, '').trim();
      if (metaCellId === cellId) {
        idVerified = true;
      } else if (metaCellId.length > 0) {
        idConflict = true;
        idConflictDetail = `filename-derived="${cellId}", DSID_DSNM-derived="${metaCellId}"`;
      }
    }

    cells.push({
      cellId,
      // filename is relative to chart-source so downstream path.join() remains compatible.
      filename,
      sourceRelativePath: filename,
      sourceGroup,
      sourcePath: realPath,
      sha256,
      // Intermediate cache
      metadataCached,
      intermediateComplete,
      metadata,
      // Cell output cache
      cellOutputComplete,
      cachedManifest,
      // Overall status
      cacheStatus,
      // Identity
      idVerified,
      idConflict,
      idConflictDetail,
    });
  }

  return cells;
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const [, , rootDir] = process.argv;
  if (!rootDir) {
    process.stderr.write('Usage: discover-cells.cjs <rootDir>\n');
    process.exit(1);
  }
  try {
    const cells = discoverCells(rootDir);
    process.stdout.write(JSON.stringify(cells, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { discoverCells, findSourceFilesRecursive, PIPELINE_SCHEMA_VERSION };
