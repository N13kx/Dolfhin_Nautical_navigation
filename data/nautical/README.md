# Dolphin v0.2.1b — IENC Nautical Data Pipeline

## Overview

This directory contains the data pipeline for integrating two Dutch IENC
(Electronic Navigational Chart) pilot cells into the Dolphin Navigation app.
The pipeline transforms official IHO S-57 source cells into validated,
frontend-safe GeoJSON files.

**Not for navigation.** Output data is for development and demonstration only.

---

## Directory Structure

```
data/nautical/
├── raw/                        # Reserved for future raw data staging (currently empty)
├── intermediate/               # Generated — do NOT commit (gitignored)
│   ├── 1R76W8LI/
│   │   ├── metadata.json       # DSID/DSPM dataset metadata
│   │   ├── BCNSPP.geojson      # Raw GDAL-decoded features by class
│   │   ├── BOYLAT.geojson
│   │   ├── BOYSPP.geojson
│   │   ├── LIGHTS.geojson
│   │   ├── TOPMAR.geojson
│   │   ├── DEPARE.geojson
│   │   ├── DEPCNT.geojson
│   │   └── SOUNDG.geojson
│   └── 1R7788RI/
│       └── (same structure)
└── processed/                  # Committed — the normalized pipeline outputs
    ├── navigation-marks.geojson
    ├── depth-areas.geojson
    ├── depth-contours.geojson
    ├── soundings.geojson
    ├── pipeline-manifest.json       # Internal full audit (not served)
    └── pipeline-manifest.public.json # Frontend-safe (served at /nautical/)
```

---

## Source Files

| Cell ID   | Filename                            | SHA-256 |
|-----------|-------------------------------------|---------|
| 1R76W8LI  | 1R76W8LI_1783372678701.000          | `1228405ba65ba70afec00c3b0ef5f459dd166a6df588805434383b3b731245ea` |
| 1R7788RI  | 1R7788RI_1783372678701.000          | `cbdea5755b9f53de9587e2fc4d441c52178484268b79c23084a307e3910da99b` |

### Source File Governance

Both `.000` files are **gitignored** (and have been removed from the Git index).
Fresh clones will NOT contain the source files.

**Before running the pipeline on a fresh clone:**

1. Obtain both `.000` files from the official source (Rijkswaterstaat / IHO S-57).
2. Place them in `attached_assets/` with the exact filenames above.
3. Verify SHA-256 checksums match the canonical hashes in this table.
4. Run `./scripts/nautical/verify-checksums.sh` to confirm.

The pipeline aborts immediately if either source file is absent or has a
checksum mismatch.

---

## Reader Requirements

| Requirement       | Value |
|-------------------|-------|
| GDAL version      | **3.2.2 exact** (no other version accepted) |
| S57 driver        | Must be present (`ogrinfo --formats \| grep S57`) |
| SPLIT_MULTIPOINT  | NO |
| ADD_SOUNDG_DEPTH  | NO |
| LNAM_REFS         | YES |
| UPDATES           | APPLY |

If the GDAL version is not exactly `3.2.2`, the pipeline aborts with an
environment mismatch error. Do not install a different version or attempt
a fallback.

The nix-managed GDAL binary is at `$HOME/.nix-profile/bin/`.

---

## Pipeline Stages

### Stage 1 — Immutable Raw Source Truth
The `.000` files in `attached_assets/` are the immutable source of truth.
They are never modified by any pipeline step.

### Stage 2 — Reader-Preserving Decoded Intermediate
GDAL 3.2.2 decodes the S-57 binary into per-class GeoJSON files in
`data/nautical/intermediate/`. All GDAL-decoded attributes are preserved.
This stage does NOT claim to preserve the original ISO/IEC 8211 record
structure byte-for-byte — it records what GDAL exposes under the pinned
reader conditions.

### Stage 3 — Normalized Output (Dolphin Model)
The four GeoJSON files in `data/nautical/processed/` apply the Dolphin
data model: per-coordinate SOUNDG expansion, signed depth values, datum
schema, provenance, and deterministic `pipelineFeatureId` values.

---

## Normalization Rules

### Navigation Marks
Classes: BCNSPP, BOYLAT, BOYSPP, LIGHTS, TOPMAR.

| Class  | dolphinKind      |
|--------|------------------|
| BCNSPP | beacon-special   |
| BOYLAT | buoy-lateral     |
| BOYSPP | buoy-special     |
| LIGHTS | light            |
| TOPMAR | topmark          |

All TOPMAR features carry `associationRefsVerifiedInGdalOutput: false` —
GDAL does not expose S-57 FFPT parent-association links for these features.

### Depth Fields
- `depthDatum`: "Approximate LAT"
- `depthDatumCode`: 42 (VERIFIED_FROM_OFFICIAL_DOCUMENTATION)
- `verticalDatum`: "Local Datum"
- `verticalDatumCode`: 24 (VDAT=24; NAP identity UNVERIFIED)
- `napIdentityStatus`: "UNVERIFIED"

`verticalDatumNapInferred` must never appear in output files or manifests.

### SOUNDG Signed Model
Each MultiPoint SOUNDG feature is expanded to one Point per coordinate.
- `chartedValueMetres`: raw Z value (sign preserved, never `abs()`)
- `chartedValueRelationToDatum`:
  - `"below"` — Z > 0 (charted depth below chart datum; S-57 positive = navigable water depth)
  - `"above"` — Z < 0 (drying height above chart datum; S-57 negative = exposed feature)
  - `"at"` — Z == 0

### pipelineFeatureId Algorithm
- Normal feature: `<cellId>/<CLASS>/<RCID>`
- SOUNDG expanded coordinate: `<cellId>/SOUNDG/<RCID>/<coordIndex>` (0-based)
- Fallback (RCID absent/zero): `<cellId>/<CLASS>/FIDN<FIDN>-FIDS<FIDS>`
- If both RCID and FIDN/FIDS are absent: **hard pipeline failure**

`pipelineFeatureId` is a technical pipeline artifact, never an official
source identifier. Never rendered in the UI.

---

## Validation Rules

The pipeline enforces exact counts (no tolerance):

| Cell      | BCNSPP | BOYLAT | BOYSPP | LIGHTS | TOPMAR | DEPARE | DEPCNT | SOUNDG src | SOUNDG coords |
|-----------|--------|--------|--------|--------|--------|--------|--------|------------|---------------|
| 1R76W8LI  | 2      | 0      | 0      | 25     | 1      | 532    | 528    | 4          | 757           |
| 1R7788RI  | 0      | 12     | 5      | 13     | 14     | 393    | 390    | 5          | 1327          |
| Combined  | 2      | 12     | 5      | 38     | 15     | 925    | 918    | 9          | **2084**      |

Additional gates: no NaN/Infinity Z, per-cell bbox ±0.005°, no duplicate LNAMs,
geometry type integrity, `pipelineFeatureId` uniqueness, JSON round-trip safety.

---

## Manifest Sequencing

```
normalize.sh   → deletes existing manifests at start
validate.sh    → exits 0 or aborts (no manifest written on failure)
write-manifests.sh → only after validate exits 0:
                     writes pipeline-manifest.json (validationResult: "PASS")
                     writes pipeline-manifest.public.json (validation.status: "PASS")
publish.sh     → re-gates on validate.sh, then stages publish with rollback
```

A `validation.status: "PASS"` in the public manifest guarantees that
`validate.sh` exited 0 in the same pipeline run that produced the four output files.

---

## Publish Procedure

`publish.sh` uses a **validated staged publish with rollback** (not claimed to
be fully filesystem-atomic). The existing destination is preserved as a backup
until the new directory is confirmed in place.

Destination: `artifacts/dolphin/public/nautical/`

Allowlist (exactly 5 files):
1. `navigation-marks.geojson`
2. `depth-areas.geojson`
3. `depth-contours.geojson`
4. `soundings.geojson`
5. `pipeline-manifest.public.json`

Never copies from `raw/` or `intermediate/`. No symlinks.

---

## Re-Running the Pipeline

```bash
./scripts/nautical/verify-checksums.sh
./scripts/nautical/extract-metadata.sh
./scripts/nautical/extract-raw.sh
./scripts/nautical/normalize.sh
./scripts/nautical/validate.sh
./scripts/nautical/write-manifests.sh
./scripts/nautical/publish.sh
```

Each script gates on its prerequisites. Running `publish.sh` alone will
re-run validate as a gate. Running the full chain explicitly is required
for a fresh pipeline run.

---

## Stated Limitations

- VDAT=24 NAP identity is UNVERIFIED — not confirmed from official documentation
- Bridge and overhead clearances are not in scope
- Data is not real-time water depth
- Not for navigation
- Rijkswaterstaat data licence has not been reviewed for public redistribution
- TOPMAR parent-association semantics cannot be fully verified from GDAL decoded output alone
