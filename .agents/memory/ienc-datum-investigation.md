---
name: IENC Datum Investigation
description: Findings on VDAT/SDAT values in Dutch S-57 pilot cells; confirmed values; pipeline outcome.
---

## VDAT=24 / SDAT=42 — Confirmed from cell metadata

GDAL S-57 extraction from both cells returns:
- `DSPM_VDAT = 24` — S-57 code for Local Datum (NAP identity UNVERIFIED)
- `DSPM_SDAT = 42` — S-57 code for Approximate LAT (VERIFIED from official documentation)
- `DSPM_HDAT = 2` — WGS-84

This is confirmed in `data/nautical/intermediate/<cellId>/metadata.json` for both `1R76W8LI` and `1R7788RI`.

**Why SDAT=42 is VERIFIED:** The cell metadata (`extract-metadata.cjs` reading the DSID layer) shows SDAT=42 directly from the source. S-57 Appendix B1 code 42 = "Approximate LAT". This is used as `depthDatum: "Approximate LAT"` in normalized output.

**Why VDAT=24 is UNVERIFIED:** S-57 Appendix B1 code 24 = "Local Datum". NAP (Normaal Amsterdams Peil) is the likely referent for Dutch charts but the standard does not explicitly equate VDAT=24 to NAP in the accessible specs. `napIdentityStatus: "UNVERIFIED"` is set on all depth features; `verticalDatumNapInferred` is banned.

## Pipeline outcome — Task #7 complete

Branch: `feature/v0.2.1b-official-ienc-integration`

All steps exit 0, 72/72 validation checks pass. Output:
- navigation-marks.geojson: 72 features
- depth-areas.geojson: 925 features
- depth-contours.geojson: 918 features
- soundings.geojson: 2084 features (from 9 source SOUNDG features)

Published to `artifacts/dolphin/public/nautical/` (5 files, validated staged publish).

## GDAL field name discovery

GDAL S-57 GeoJSON output prefixes all fields: `DSID_DSNM`, `DSID_EDTN`, `DSPM_VDAT`, `DSPM_SDAT`, `DSPM_HDAT`. All DSID and DSPM fields are in the single `DSID` layer (not a separate DSPM layer). Use full prefixed names when reading.

## Node.js / no Python

Python3 is absent from the Replit environment. All pipeline scripts are `.cjs` (CommonJS) because `scripts/package.json` has `"type": "module"`. `.js` files in that package are ESM; rename to `.cjs` for `require()`.

## ogr2ogr empty-layer handling

When a S-57 layer is absent from a cell, ogr2ogr exits non-zero and may write an empty or 0-byte file. Fix: pre-seed the output file with `{"type":"FeatureCollection","features":[]}` before running ogr2ogr, then validate JSON after. Capture and log the ogr2ogr exit code and stderr explicitly (do not use `|| true` silently).
