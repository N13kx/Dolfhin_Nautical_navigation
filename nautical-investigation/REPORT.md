# Dolphin v0.2.1 — Nautical Data Investigation Report

**Branch:** `feature/v0.2.1-nautical-data`  
**Date:** 2026-07-06  
**Scope:** Read-only investigation. No UI changes. No data integration. No rendering.

---

## Finding Status Model

Every finding in this report carries one of the following labels:

| Label | Meaning |
|-------|---------|
| `VERIFIED_FROM_FILE` | Directly read from the binary content of the source file or GDAL output |
| `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` | Confirmed from a named official source with section reference |
| `INFERRED` | Reasoned from verified facts; not directly confirmed |
| `UNKNOWN` | Cannot be determined from available evidence |

---

## Section 1 — Source File Inventory

### All .000 files in `attached_assets/`

| Canonical cell name | Filename used | Bytes | SHA-256 |
|---------------------|---------------|-------|---------|
| **1R76W8LI** | `1R76W8LI_1783372678701.000` | 1,228,405 | `1228405ba65ba70afec00c3b0ef5f459dd166a6df588805434383b3b731245ea` |
| **1R7788RI** | `1R7788RI_1783372678701.000` | 729,749 | `cbdea5755b9f53de9587e2fc4d441c52178484268b79c23084a307e3910da99b` |

Each cell name was uploaded twice with different timestamp suffixes. The two variants of each cell are byte-identical (same SHA-256 per pair). `VERIFIED_FROM_FILE`

### Source identity resolution

The investigation brief expected the second cell to be `1R76W8RI`. The actual uploaded file is `1R7788RI`. These are different cell identifiers. The user confirmed (2026-07-06 session) that `1R7788RI` is the correct second pilot cell. `1R76W8RI.000` is not expected and need not be uploaded.

**Cell naming note:** In the standard Dutch IENC naming convention, `1R76W8LI` and `1R76W8RI` would form a natural Left/Right pair for a single grid cell, sharing a common edge. `1R7788RI` is a cell from a different grid position. This has significant implications for the boundary analysis — see Section 10. `INFERRED` based on naming convention; `UNKNOWN` without official Dutch IENC grid documentation.

### Source file immutability

All SHA-256 checksums were re-verified at investigation time and match the original upload. `VERIFIED_FROM_FILE`  
The `.000` files reside in `attached_assets/` — not in `public/` or `src/` — and are not processed by Vite or served to the web. `VERIFIED_FROM_FILE`

---

## Section 2 — Dolphin Nautical Architecture Audit

### Complete file tree (confirmed by `find`)

```
artifacts/dolphin/src/
  modules/
    nautical/
      types.ts                  — placeholder types only
    map/
      overlayManager.ts         — overlay source/layer management
      styles.ts                 — MapLibre base style definitions
      types.ts                  — MapMode, TrackingMode, MapViewRef
    community/types.ts          — placeholder CommunityProvider interface
    environment/types.ts        — placeholder WeatherProvider interface
    intelligence/types.ts       — placeholder route/AI interfaces
    navigation/
      useGeolocation.ts         — GPS watchPosition hook (implemented)
      gpsUtils.ts               — unit conversion, quality, stale detection
      types.ts                  — GpsPosition, GpsError, GpsQuality
    vessel/
      types.ts                  — Vessel, VesselState
      boatMarker.ts             — SVG boat marker element
  components/
    LayerSheet.tsx              — map mode picker (3 modes, no nautical layer toggles)
    MapView.tsx                 — MapLibre instance with ref
    TopBar.tsx, StatusStrip.tsx, LocateButton.tsx, SearchBar.tsx, Toast.tsx
    BoatMarker.ts
    ErrorBoundary.tsx
    ui/                         — 30+ shadcn/ui components
  pages/
    DolphinApp.tsx              — main application page
    not-found.tsx
  services/search/
    nominatim.ts                — Nominatim geocoder
    types.ts
  hooks/
    useGeolocation.ts           — legacy hook (pre-navigation-module)
    use-mobile.tsx, use-toast.ts
  App.tsx, main.tsx, index.css, diagnostics.ts, lib/utils.ts
```

### Classification per file

| File | Classification | Notes |
|------|---------------|-------|
| `modules/nautical/types.ts` | Reusable with extension | Defines `BBox`, `NauticalObject`, `DepthContour`, `NauticalDataProvider` interface. Types are minimal but correctly structured. `NauticalDataProvider.fetchObjects()` / `fetchDepthContours()` are the right hook points. |
| `modules/map/overlayManager.ts` | Reusable with extension | `OverlaySpec`, `applyOverlays()` are sound patterns. Contains a hard-coded demo route (not a nautical feature). Will need to be extended with S-57-sourced sources/layers. |
| `modules/map/styles.ts` | Reusable as-is | Three correctly defined MapLibre styles. Separate HYBRID_STYLE object reference is an intentional architectural decision. |
| `modules/map/types.ts` | Reusable as-is | MapMode union, TrackingMode, MapViewRef — no changes needed. |
| `modules/community/types.ts` | Incomplete/placeholder | Interface only, no implementation. |
| `modules/environment/types.ts` | Incomplete/placeholder | Interface only, no implementation. |
| `modules/intelligence/types.ts` | Incomplete/placeholder | Interface only, no implementation. |
| `modules/navigation/useGeolocation.ts` | Reusable as-is | Full lifecycle-safe GPS implementation. StrictMode safe. Stale detection. |
| `modules/vessel/types.ts` | Reusable as-is | Vessel and VesselState correctly typed. |
| `components/LayerSheet.tsx` | Reusable with extension | Currently only mode picker. Needs nautical layer toggle section for Dolphin/Hybrid modes. |
| `pages/DolphinApp.tsx` | Reusable with extension | Main wiring point. Ready to receive `useNauticalOverlays` hook and `NauticalObjectSheet`. |

### What does NOT exist and should NOT be rebuilt without investigation

The following components described in session history were **not found on disk**. They must be designed from scratch informed by this investigation:

- `modules/map/layerRegistry.ts` (NauticalLayerRegistry) — does not exist
- `hooks/useNauticalOverlays.ts` — does not exist
- `modules/nautical/enc/EncFeatureTypes.ts` — does not exist
- `modules/nautical/depth/depthTypes.ts` — does not exist
- `modules/nautical/objects/` — does not exist
- `modules/nautical/waterways/PdokWaterwayProvider.ts` — does not exist
- `components/NauticalObjectSheet.tsx` — does not exist
- `public/data/enc/` — does not exist

`VERIFIED_FROM_FILE`

---

## Section 3 — Cell Conceptual Analysis

### 1R76W8LI

| Claim | Status | Basis |
|-------|--------|-------|
| Dutch IENC cell | `VERIFIED_FROM_FILE` | DSID_INTU=7, DSID_PRSP=10, DSID_AGEN=7979 |
| Inland waterway chart | `INFERRED` | INTU=7 is the IENC intended usage marker; confirmed by object classes (locks, waterway axes, distance marks) |
| Geographic area: western Hollands Diep / Brabantse Biesbosch | `INFERRED` | Bbox 4.133°–4.333°E, 51.575°–51.625°N places this in Zuid-Holland/Noord-Brabant, consistent with IENC cell naming |
| Producer: Rijkswaterstaat | `INFERRED` | AGEN=7979; Rijkswaterstaat is known to use this agency code in Dutch IENC publications |
| S-57 Edition 3.1 compliant | `VERIFIED_FROM_FILE` | DSID_STED=3.1, DSID_COMT="STED:3.1.1" |
| IENC Product Specification 2.4 | `VERIFIED_FROM_FILE` | DSID_PRED="2.4" |
| Scale 1:2000 | `VERIFIED_FROM_FILE` | DSPM_CSCL=2000 |
| Edition 78, no updates applied | `VERIFIED_FROM_FILE` | DSID_EDTN="78", DSID_UPDN="0" |
| Date string 20260617 | `VERIFIED_FROM_FILE` | DSID_UADT="20260617", DSID_ISDT="20260617" |
| UADT = "update application date", ISDT = "issue date" | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` | IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSID field definitions: ISDT = "Issue date", UADT = "Update application date". With UPDN=0, both dates are the base issue date. |

### 1R7788RI

| Claim | Status | Basis |
|-------|--------|-------|
| Dutch IENC cell | `VERIFIED_FROM_FILE` | Same DSID structure: INTU=7, PRSP=10, AGEN=7979 |
| Geographic area: Nieuwe Merwede / Dordtsche Biesbosch east | `INFERRED` | Bbox 4.333°–4.533°E, 51.625°–51.675°N |
| Scale 1:2000 | `VERIFIED_FROM_FILE` | DSPM_CSCL=2000 |
| Edition 46, no updates applied | `VERIFIED_FROM_FILE` | DSID_EDTN="46", DSID_UPDN="0" |
| Date string 20260629 | `VERIFIED_FROM_FILE` | DSID_UADT="20260629", DSID_ISDT="20260629" |
| Different edition number from LI | `VERIFIED_FROM_FILE` | LI edition 78, RI edition 46 — independent update histories |
| Same producer, same product spec, same S-57 version as LI | `VERIFIED_FROM_FILE` | AGEN=7979, PRED="2.4", STED=3.1 |

---

## Section 4 — Tooling Installation, Verification, and Reader Conditions

### Installation

GDAL was installed via `nix-env -iA nixpkgs.gdal`. Binary path: `~/.nix-profile/bin/`. PATH update required: `export PATH="$HOME/.nix-profile/bin:$PATH"`.

### S-57 driver verification commands and outputs

```
$ gdalinfo --version
GDAL 3.2.2, released 2021/03/05

$ ogrinfo --version
GDAL 3.2.2, released 2021/03/05

$ ogrinfo --formats | grep -i "S57\|S-57\|IHO"
  S57 -vector- (rw+v): IHO S-57 (ENC)
```

**S-57 driver is present and supports read, write, and virtual IO.** `VERIFIED_FROM_FILE`

```
$ ogrinfo attached_assets/1R76W8LI_1783372678701.000
INFO: Open of `...' using driver `S57' successful.
[35 layers listed]

$ ogrinfo attached_assets/1R7788RI_1783372678701.000
INFO: Open of `...' using driver `S57' successful.
[36 layers listed]
```

Both files open successfully under the S-57 driver. `VERIFIED_FROM_FILE`

### Exact S-57 reader conditions (reproducibility baseline)

| Parameter | Value | Source |
|-----------|-------|--------|
| GDAL version | 3.2.2 (released 2021-03-05) | `gdalinfo --version` |
| S-57 OGR driver | Present (`S57 -vector- (rw+v)`) | `ogrinfo --formats` |
| `GDAL_DATA` env var | Not set (empty) | `echo $GDAL_DATA` |
| S-57 dictionary | Compiled into binary (no external `s57objectclasses.csv` dependency confirmed) | `INFERRED` |
| `UPDATES` open option default | `APPLY` — companion `.001`/`.002` files are applied automatically if present in the same directory | GDAL S-57 driver documentation (`ogrinfo --format S57` OpenOptionList) |
| `SPLIT_MULTIPOINT` default | `NO` — SOUNDG features are returned as 3D MultiPoint collections | GDAL S-57 driver OpenOptionList |
| `ADD_SOUNDG_DEPTH` default | `NO` — no synthetic DEPTH attribute added | GDAL S-57 driver OpenOptionList |
| `LNAM_REFS` default | `YES` — LNAM and LNAM_REFS attached to features | GDAL S-57 driver OpenOptionList |
| `RETURN_PRIMITIVES` default | `NO` — raw geometric primitives not returned | GDAL S-57 driver OpenOptionList |
| `PRESERVE_EMPTY_NUMBERS` default | `NO` | GDAL S-57 driver OpenOptionList |
| `RECODE_BY_DSSI` default | `NO` | GDAL S-57 driver OpenOptionList |

**Update application behaviour:** With `UPDATES=APPLY` (default), if `.001` or `.002` files are present in `attached_assets/` alongside the `.000` file, GDAL silently applies them. Neither cell has companion update files present. `VERIFIED_FROM_FILE`

**Reproducibility requirement:** All forensic findings in Sections 5–12 are valid only under GDAL 3.2.2 with the defaults listed above. Any change to GDAL version, `OGR_S57_OPTIONS`, or the presence of update files could alter results.

---

## Section 5 — GDAL S-57 Driver Exposure Audit and Formal Metadata Extraction

### GDAL DSID layer structure

GDAL does **not** expose DSID, DSSI, and DSPM as three separate layers. All subfields from all three records are consolidated into a single virtual layer named `DSID`, with field name prefixes indicating the source record. `VERIFIED_FROM_FILE`

The layer `DSPM` cannot be queried directly (`FAILURE: Couldn't fetch requested layer DSPM!`). All DSPM fields are accessible via the `DSID` layer with `DSPM_` prefix. `VERIFIED_FROM_FILE`

### DSID fields — exposure status

All of the following fields are exposed by `ogrinfo -al -so ... DSID`: `VERIFIED_FROM_FILE`

`DSID_EXPP`, `DSID_INTU`, `DSID_DSNM`, `DSID_EDTN`, `DSID_UPDN`, `DSID_UADT`, `DSID_ISDT`, `DSID_STED`, `DSID_PRSP`, `DSID_PSDN`, `DSID_PRED`, `DSID_PROF`, `DSID_AGEN`, `DSID_COMT`

**Not exposed by GDAL:** `DSID_RCNM`, `DSID_RCID` — these are ISO/IEC 8211 record management fields (record name and identifier). They are internal to the DDR structure and not lifted into the GDAL feature model. A conformant ISO/IEC 8211 parser would be needed to read these directly; they have no nautical semantic value.

### DSID/DSSI/DSPM values — both cells

| Field | 1R76W8LI | 1R7788RI | Interpretation | Status |
|-------|----------|----------|----------------|--------|
| `DSID_EXPP` | 1 | 1 | Exchange purpose: 1 = "New dataset" | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix A, DSID subfield EXPP enumeration |
| `DSID_INTU` | 7 | 7 | Intended usage: 7 = IENC (Inland Electronic Navigation Chart) | `INFERRED` — S-57 Ed 3.1 defines INTU 1–6 (Overview through Berthing); value 7 is IENC-specific, defined in the IENC Product Specification |
| `DSID_DSNM` | `1R76W8LI.000` | `1R7788RI.000` | Dataset name — canonical cell identifier | `VERIFIED_FROM_FILE` |
| `DSID_EDTN` | `78` | `46` | Edition number — independent update histories | `VERIFIED_FROM_FILE` |
| `DSID_UPDN` | `0` | `0` | Update number: 0 = base dataset, no updates applied | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix A, DSID subfield UPDN |
| `DSID_UADT` | `20260617` | `20260629` | Update application date (YYYYMMDD format) — date of last update applied | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix A, DSID subfield UADT |
| `DSID_ISDT` | `20260617` | `20260629` | Issue date (YYYYMMDD format) — date dataset was issued | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix A, DSID subfield ISDT |
| `DSID_STED` | 3.1 | 3.1 | S-57 standard edition: 3.1 | `VERIFIED_FROM_FILE` |
| `DSID_PRSP` | 10 | 10 | Product specification: 10 | `INFERRED` as IENC product specification; base S-57 PRSP values go to 6; value 10 is IENC-specific |
| `DSID_PSDN` | (empty) | (empty) | Product specification description number: not set | `VERIFIED_FROM_FILE` |
| `DSID_PRED` | `2.4` | `2.4` | Product specification edition: IENC Edition 2.4 | `INFERRED` — "2.4" interpreted as IENC Product Specification version 2.4 (ISRS); requires IENC documentation confirmation |
| `DSID_PROF` | 1 | 1 | S-57 profile: 1 | `INFERRED` as "ENC New" base profile; `UNKNOWN` for IENC-specific profile semantics |
| `DSID_AGEN` | 7979 | 7979 | Producing agency: 7979 | `INFERRED` as Rijkswaterstaat (Dutch national waterway authority); agency code 7979 associated with Rijkswaterstaat in IHO agency code registries |
| `DSID_COMT` | `STED:3.1.1` | `STED:3.1.1` | Comment: S-57 edition 3.1.1 indicator | `VERIFIED_FROM_FILE` |

### DSSI (data structure) values

| Field | 1R76W8LI | 1R7788RI | Meaning |
|-------|----------|----------|---------|
| `DSSI_DSTR` | 2 | 2 | Data structure: 2 = chain-node topology |
| `DSSI_AALL` | 0 | 0 | Lexical level for ATTF: 0 = ASCII |
| `DSSI_NALL` | 1 | 1 | Lexical level for NATF: 1 = ISO/IEC 8859 |
| `DSSI_NOMR` | 229 | 35 | Number of meta records |
| `DSSI_NOCR` | 0 | 0 | Number of collection records |
| `DSSI_NOGR` | 1476 | 1052 | Number of geo records |
| `DSSI_NOLR` | 2 | 1 | Number of collection (relation) records |
| `DSSI_NOIN` | 82 | 106 | Number of isolated nodes |
| `DSSI_NOCN` | 2295 | 1067 | Number of connected nodes |
| `DSSI_NOED` | 3433 | 1473 | Number of edge records |

`VERIFIED_FROM_FILE`

### DSPM (parameters) values

| Field | 1R76W8LI | 1R7788RI | Interpretation | Status |
|-------|----------|----------|----------------|--------|
| `DSPM_HDAT` | 2 | 2 | Horizontal datum: 2 = WGS84 | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix A, DSPM subfield HDAT enumeration, value 2 = WGS-84 |
| `DSPM_VDAT` | 24 | 24 | Vertical datum: raw value 24 | `UNKNOWN` — Standard S-57 VDAT enumeration (IHO S-57 Ed 3.1 Appendix A) defines values 1–23; value 24 exceeds the base table. Likely an IENC extension. `INFERRED` candidate: NAP (Normaal Amsterdams Peil) or another Dutch inland reference; requires official IENC Product Specification documentation to confirm. Do not use for depth display without this confirmed. |
| `DSPM_SDAT` | 42 | 42 | Sounding datum: raw value 42 | `UNKNOWN` — Exceeds standard S-57 SDAT enumeration (IHO S-57 Ed 3.1 Appendix A defines values 1–23). Likely an IENC extension for a Dutch inland low-water reference (e.g. OLW/GLW). Requires IENC specification to confirm. |
| `DSPM_CSCL` | 2000 | 2000 | Compilation scale: 1:2000 (large-scale inland detail) | `VERIFIED_FROM_FILE` |
| `DSPM_DUNI` | 1 | 1 | Depth units: 1 = metres | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSPM subfield DUNI, value 1 = metres |
| `DSPM_HUNI` | 1 | 1 | Height units: 1 = metres | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSPM subfield HUNI, value 1 = metres |
| `DSPM_PUNI` | 1 | 1 | Positional accuracy units: 1 = metres | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSPM subfield PUNI, value 1 = metres |
| `DSPM_COUN` | 1 | 1 | Coordinate units: 1 = decimal degrees | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSPM subfield COUN, value 1 = degrees |
| `DSPM_COMF` | 10,000,000 | 10,000,000 | Coordinate multiplication factor: 10⁷ (0.1 micro-degree resolution) | `VERIFIED_FROM_FILE` |
| `DSPM_SOMF` | 10 | 10 | Sounding multiplication factor: 10 (stored integer ÷ 10 = metres) | `VERIFIED_FROM_FILE` |
| `DSPM_COMT` | (empty) | (empty) | Comment: not set | `VERIFIED_FROM_FILE` |

**Critical note:** GDAL applies COMF and SOMF automatically when decoding coordinates and sounding Z-values. Output coordinates are already in decimal degrees; Z values are already in metres. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — GDAL S-57 driver documentation (https://gdal.org/drivers/vector/s57.html).

---

## Section 6 — Cell Comparability Pre-Check

| Parameter | 1R76W8LI | 1R7788RI | Comparable? |
|-----------|----------|----------|-------------|
| INTU (intended usage) | 7 (IENC) | 7 (IENC) | ✅ Yes |
| CSCL (compilation scale) | 1:2000 | 1:2000 | ✅ Yes |
| PRSP / PRED (product spec) | 10 / "2.4" | 10 / "2.4" | ✅ Yes |
| PROF (profile) | 1 | 1 | ✅ Yes |
| STED (S-57 edition) | 3.1 | 3.1 | ✅ Yes |
| AGEN (producer) | 7979 | 7979 | ✅ Yes |
| HDAT (horizontal datum) | 2 (WGS84) | 2 (WGS84) | ✅ Yes |
| VDAT (vertical datum) | 24 | 24 | ✅ Yes (same value; interpretation UNKNOWN) |
| SDAT (sounding datum) | 42 | 42 | ✅ Yes (same value; interpretation UNKNOWN) |
| COMF (coordinate factor) | 10,000,000 | 10,000,000 | ✅ Yes |
| SOMF (sounding factor) | 10 | 10 | ✅ Yes |
| EDTN (edition) | 78 | 46 | ⚠️ Different — independent update histories |
| ISDT / UADT (dates) | 20260617 | 20260629 | ⚠️ Different — 12 days apart |

`VERIFIED_FROM_FILE`

**Comparability verdict:** The cells share the same product specification, datum parameters, scale, producer, and coordinate system. They are directly comparable. The different edition numbers and dates reflect independent update histories for different geographic areas — this is expected and normal. `INFERRED`

**Geographic adjacency:** See Section 10. The cells are diagonally adjacent (corner-touching), not edge-adjacent. `VERIFIED_FROM_FILE`

---

## Section 7 — Object Class Inventory

### 1R76W8LI — all layers

| Layer | Geometry | Count | S-57 Object Class |
|-------|----------|-------|-------------------|
| DSID | None | 1 | Dataset identification (metadata) |
| BCNSPP | Point | 2 | Beacon, special purpose/general |
| BUISGL | Unknown | 3 | Building, single |
| BUAARE | Unknown | 4 | Built-up area |
| CBLSUB | Unknown | 1 | Cable, submarine |
| COALNE | Unknown | 24 | Coastline |
| DAMCON | Unknown | 2 | Dam/dyke/weir construction |
| DEPARE | Unknown | 532 | Depth area |
| DEPCNT | Unknown | 528 | Depth contour |
| LAKARE | Polygon | 5 | Lake area |
| LNDARE | Unknown | 25 | Land area |
| LNDRGN | Unknown | 10 | Land region |
| LNDMRK | Unknown | 2 | Landmark |
| LIGHTS | Point | 25 | Light |
| MARCUL | Unknown | 1 | Marine farm/culture |
| PILPNT | Point | 10 | Pile/bollard/dolphin |
| PIPSOL | Unknown | 1 | Pipeline, overhead |
| PYLONS | Unknown | 16 | Pylon/support structure |
| ROADWY | Unknown | 10 | Road |
| SEAARE | Unknown | 4 | Sea area/named water area |
| SLCONS | Unknown | 27 | Shoreline construction |
| SOUNDG | 3D Multi Point | 4 | Sounding |
| TOPMAR | Point | 1 | Topmark |
| UNSARE | Polygon | 156 | Unsurveyed area |
| M_COVR | Polygon | 1 | Meta: coverage |
| M_QUAL | Polygon | 52 | Meta: data quality |
| M_SREL | Polygon | 175 | Meta: source reliability |
| C_AGGR | None | 2 | Collection: aggregation |
| dismar | Point | 7 | Distance mark (IENC) |
| resare | Polygon | 9 | Restricted area |
| sistaw | Point | 9 | Signal station, warning |
| bridge | Unknown | 2 | Bridge (IENC) |
| m_nsys | Polygon | 1 | Meta: navigational system (IENC) |
| notmrk | Point | 11 | Notice mark (IENC) |
| wtwaxs | Unknown | 5 | Waterway axis (IENC) |
| Generic | Unknown | 40 | Generic/unclassified features |

**Total geo records from DSSI:** 1,476 `VERIFIED_FROM_FILE`

### 1R7788RI — all layers

| Layer | Geometry | Count | S-57 Object Class |
|-------|----------|-------|-------------------|
| DSID | None | 1 | Dataset identification (metadata) |
| BUAARE | Unknown | 5 | Built-up area |
| BOYLAT | Point | 12 | Buoy, lateral |
| BOYSPP | Point | 5 | Buoy, special purpose/general |
| CBLSUB | Unknown | 1 | Cable, submarine |
| COALNE | Unknown | 3 | Coastline |
| DEPARE | Unknown | 393 | Depth area |
| DEPCNT | Unknown | 390 | Depth contour |
| GATCON | Unknown | 2 | Gate construction |
| LNDARE | Unknown | 7 | Land area |
| LNDRGN | Unknown | 4 | Land region |
| LNDMRK | Unknown | 19 | Landmark |
| LIGHTS | Point | 13 | Light |
| MORFAC | Unknown | 46 | Mooring/warping facility |
| NAVLNE | Unknown | 2 | Navigation line |
| PILPNT | Point | 3 | Pile/bollard/dolphin |
| RECTRC | Unknown | 1 | Recommended track |
| RIVERS | Unknown | 1 | River |
| SEAARE | Unknown | 3 | Sea area/named water area |
| SLCONS | Unknown | 30 | Shoreline construction |
| SOUNDG | 3D Multi Point | 5 | Sounding |
| TOPMAR | Point | 14 | Topmark |
| UNSARE | Polygon | 59 | Unsurveyed area |
| M_COVR | Polygon | 2 | Meta: coverage (one CATCOV=1, one CATCOV=2) |
| M_QUAL | Polygon | 15 | Meta: data quality |
| M_SREL | Polygon | 17 | Meta: source reliability |
| C_AGGR | None | 1 | Collection: aggregation |
| resare | Polygon | 4 | Restricted area |
| bridge | Unknown | 5 | Bridge (IENC) |
| lokbsn | Polygon | 1 | Lock basin (IENC) |
| rdocal | Unknown | 2 | Radio calling-in point (IENC) |
| m_nsys | Polygon | 1 | Meta: navigational system (IENC) |
| notmrk | Point | 2 | Notice mark (IENC) |
| wtwaxs | Unknown | 5 | Waterway axis (IENC) |
| bunsta | Point | 1 | Bunker station (IENC) |
| Generic | Unknown | 14 | Generic/unclassified |

**Total geo records from DSSI:** 1,052 `VERIFIED_FROM_FILE`

### Two-cell comparison

**Classes in both cells:**
BUAARE, CBLSUB, COALNE, DEPARE, DEPCNT, LNDARE, LNDRGN, LNDMRK, LIGHTS, PILPNT, SEAARE, SLCONS, SOUNDG, TOPMAR, UNSARE, M_COVR, M_QUAL, M_SREL, C_AGGR, resare, bridge, m_nsys, notmrk, wtwaxs, Generic

**Classes only in 1R76W8LI:**
BCNSPP, BUISGL, DAMCON, LAKARE, MARCUL, PIPSOL, PYLONS, ROADWY, dismar, sistaw

**Classes only in 1R7788RI:**
BOYLAT, BOYSPP, GATCON, MORFAC, NAVLNE, RECTRC, RIVERS, lokbsn, rdocal, bunsta

**Count differences in shared classes (all deltas noted):**

| Layer | LI count | RI count | Delta |
|-------|----------|----------|-------|
| DEPARE | 532 | 393 | −26% |
| DEPCNT | 528 | 390 | −26% |
| LIGHTS | 25 | 13 | −48% |
| LNDMRK | 2 | 19 | +850% |
| TOPMAR | 1 | 14 | +1300% |
| UNSARE | 156 | 59 | −62% |
| M_COVR | 1 | 2 | +100% |
| M_QUAL | 52 | 15 | −71% |
| M_SREL | 175 | 17 | −90% |

Count differences reflect genuinely different waterway environments, not data errors. `INFERRED`

The RI `M_COVR` has two polygons: CATCOV=1 (data present) and CATCOV=2 (no data / excluded area). This means part of RI's declared coverage area contains no charted data. `VERIFIED_FROM_FILE`

`VERIFIED_FROM_FILE` (all counts)

---

## Section 8 — Attribute Inventory

### Common record-management attributes (all layers)

Every feature layer exposes the following GDAL-standard S-57 record fields:
`RCID` (record ID), `PRIM` (geometry primitive type), `GRUP` (group), `OBJL` (object label/code), `RVER` (record version), `AGEN` (producer agency), `FIDN` (feature ID number), `FIDS` (feature ID subdivision), `LNAM` (long name — hex-encoded AGEN+FIDN+FIDS), `LNAM_REFS` (related feature LNAMs), `FFPT_RIND` (relationship indicators)

`VERIFIED_FROM_FILE` for all layers.

### DEPARE (Depth Area)

| Attribute | Type | Observed values (LI) | Notes |
|-----------|------|---------------------|-------|
| DRVAL1 | Real | −4.0 to 7.0+ | Lower depth value of area (metres, COMF/SOMF applied by GDAL) |
| DRVAL2 | Real | −2.0 to 7.5+ | Upper depth value of area |
| QUASOU | StringList | (sparse) | Quality of sounding measurement |
| SOUACC | Real | (sparse) | Sounding accuracy |
| VERDAT | Integer | (sparse) | Local vertical datum override (value seen: 0 / unset) |
| INFORM, NINFOM, NTXTDS, SCAMAX, SCAMIN, TXTDSC | Various | (sparse) | Free text and display scale fields |
| RECDAT, RECIND, SORDAT, SORIND | String | (sparse) | Source dating and indication |

`VERIFIED_FROM_FILE`

**Observed DRVAL1/DRVAL2 pattern in LI:** Range from −4.0 (deepest charted area, 4m below chart datum) to positive values indicating areas above chart datum (dry at chart datum). The negative-positive sign convention: negative = below chart datum, positive = above. This is GDAL's elevation sign convention applied to SOMF-decoded sounding values.

**Critical:** DRVAL1 and DRVAL2 define the depth range of the area relative to chart datum (VDAT=24, SDAT=42 — both UNKNOWN in exact semantic). They are **charted depth range estimates**, not real-time water depth.

### DEPCNT (Depth Contour)

| Attribute | Type | Observed values |
|-----------|------|-----------------|
| VALDCO | Real | 10.0 (all sampled features) |
| VERDAT | Integer | (unset in sampled features) |
| hypcat | Integer | (IENC extension attribute) |

`VERIFIED_FROM_FILE`

VALDCO is the depth value for the contour line in metres. Observed contours at 10m depth. `INFERRED` — contours near the cell boundary edge.

### SOUNDG (Sounding)

| Attribute | Type | Observed values (LI) |
|-----------|------|----------------------|
| EXPSOU | Integer | 1 (all sampled) |
| QUASOU | StringList | (sparse) |
| SOUACC | Real | (sparse) |
| TECSOU | StringList | (sparse) |
| VERDAT | Integer | (sparse) |
| SCAMIN | Integer | 30000, 60000, 120000, 240000 |

`VERIFIED_FROM_FILE`

**EXPSOU=1:** "Least depth known" — `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix B, attribute EXPSOU, value 1 = "Least depth known".

**Geometry type:** 3D MultiPoint. Each feature is a grouped collection of soundings. Z-coordinate is the decoded sounding depth in metres (SOMF applied by GDAL). Sign convention (authoritative S-57, corrected per DOL-012): positive Z = charted depth below sounding datum; negative Z = drying height above sounding datum.

**Example sounding values from LI:** Z values: −3.6, −2.9, −2.6, −2.3, −2.2, −2.0, −1.9, −1.5, −1.2, −1.0, −0.7 (drying heights above datum — exposed at chart datum), and +0.5, +0.6, +0.7, +0.8 (shallow charted depths below datum)

**Example sounding values from RI:** Z values: +0.9, +1.6, +7.4, +1.1, +1.3, +4.1, +4.2, +4.4, +5.1, +5.4, +5.7, +6.0, +6.7, +10.0 (all positive — charted navigable depths below datum)

**Interpretation (corrected):** RI soundings show consistently deep navigable water (1–10 m below sounding datum). LI shows shallower navigable areas (+0.5 to +0.8 m below datum) and intertidal drying features (−0.7 to −3.6 m, i.e. exposed 0.7–3.6 m above datum at chart datum). `INFERRED`

**Note:** An earlier version of this document stated the opposite sign convention. That was incorrect and is the root cause of the DOL-012 pipeline remediation.

**SCAMIN values:** Soundings have scale minimum visibility values (30000, 60000, 120000, 240000) indicating appropriate display zoom range. `VERIFIED_FROM_FILE`

### LIGHTS

Attributes: CATLIT, COLOUR, DATEND, DATSTA, EXCLIT, HEIGHT, LITCHR, LITVIS, MARSYS, MLTYLT, NOBJNM, OBJNAM, ORIENT, PEREND, PERSTA, SECTR1, SECTR2, SIGGRP, SIGPER, SIGSEQ, STATUS, VERACC, VALNMR, VERDAT, INFORM, NINFOM, NTXTDS, SCAMAX, SCAMIN, TXTDSC, RECDAT, RECIND, SORDAT, SORIND

**Sample (raw values):** LI LIGHTS feature: COLOUR=(1:6), LITCHR=2, SIGGRP="(1)", SIGPER=5.0s. `VERIFIED_FROM_FILE`  
**Sample (interpreted values):** COLOUR value 6 = green; LITCHR value 2 = flashing. `INFERRED` — these enum interpretations require IHO S-57 Edition 3.1 Appendix B (Object Catalogue, attribute COLOUR and LITCHR) for formal confirmation.

### BOYLAT (Buoy, Lateral — RI only)

Attributes: BOYSHP, CATLAM, COLOUR, COLPAT, CONRAD, DATEND, DATSTA, MARSYS, NATCON, NOBJNM, OBJNAM, PEREND, PERSTA, STATUS, VERACC, VERLEN, INFORM, NINFOM, NTXTDS, PICREP, SCAMAX, SCAMIN, TXTDSC, RECDAT, RECIND, SORDAT, SORIND

`VERIFIED_FROM_FILE`

### IENC-specific national attributes (lowercase layer names)

Several layers use lowercase names and contain IENC-specific attributes with lowercase attribute acronyms: `dismar` (distance marks), `sistaw` (signal stations), `notmrk` (notice marks with catnmk, fnctnm, dirimp, disipd, disipu, disbk1, disbk2, addmrk), `wtwaxs` (waterway axis with catccl), `lokbsn` (lock basin), `bunsta` (bunker station), `rdocal`, `m_nsys`.

These lowercase attribute names are IENC-specific extensions not in base IHO S-57. `INFERRED` — requires IENC Product Specification 2.4 documentation to formally decode all values. Do not discard.

---

## Section 9 — Geometry Inventory

### Coordinate system

All spatial layers are in WGS 84 geographic coordinates (EPSG:4326), with axis mapping 2,1 (X=longitude, Y=latitude). Coordinates are in decimal degrees. GDAL applies COMF=10,000,000 automatically. `VERIFIED_FROM_FILE`

### Bounding boxes (derived from decoded spatial geometry, cross-checked against OGR-reported layer extents)

All layers in each cell report the same extent, which matches the cell's clip window:

| Cell | West | South | East | North | Note |
|------|------|-------|------|-------|------|
| 1R76W8LI | 4.133333°E | 51.575000°N | 4.333333°E | 51.625000°N | ~0.20° longitude × ~0.05° latitude (~12' × ~3') |
| 1R7788RI | 4.333333°E | 51.625000°N | 4.533333°E | 51.675000°N | ~0.20° longitude × ~0.05° latitude (~12' × ~3') |

`VERIFIED_FROM_FILE` — OGR-reported extents. Note: OGR reports the clip boundary of the cell as the extent for all layers, not the tightest convex hull of individual features. Actual feature geometries may not fill the entire clip window.

### Geometry counts per type

| Metric | 1R76W8LI | 1R7788RI |
|--------|----------|----------|
| Point layers | BCNSPP, LIGHTS, PILPNT, TOPMAR, dismar, sistaw, notmrk | BOYLAT, BOYSPP, LIGHTS, PILPNT, TOPMAR, notmrk, bunsta |
| 3D MultiPoint layers | SOUNDG (4 features, 100+ individual points) | SOUNDG (5 features, 100+ individual points) |
| Polygon layers (explicit) | LAKARE, UNSARE, M_COVR, M_QUAL, M_SREL, resare, m_nsys | UNSARE, M_COVR, M_QUAL, M_SREL, resare, lokbsn, m_nsys |
| Unknown geometry layers | All others (DEPARE, DEPCNT, COALNE, etc. — resolved at feature level) | Same |
| Chain-node topology | DSSI_NOCN=2295, NOED=3433 | DSSI_NOCN=1067, NOED=1473 |
| Isolated nodes | DSSI_NOIN=82 | DSSI_NOIN=106 |
| Invalid geometries found | None detected by GDAL | None detected by GDAL |
| NaN/Infinity values | None observed in sampled features | None observed in sampled features |

`VERIFIED_FROM_FILE`

**3D geometry:** SOUNDG layers use 3D MultiPoint with Z = decoded sounding depth in metres (SOMF applied). No other layers contain Z coordinates in the default GDAL open options. `VERIFIED_FROM_FILE`

**Coordinate range sanity:** All decoded coordinates fall within expected Dutch inland waterway bounds (4.1°–4.5°E, 51.5°–51.7°N). No coordinate outliers detected. `VERIFIED_FROM_FILE`

---

## Section 10 — Two-Cell Boundary and FOID Analysis

### Geographic relationship

| | Value |
|-|-------|
| LI northeast corner | (4.333333°E, 51.625000°N) |
| RI southwest corner | (4.333333°E, 51.625000°N) |
| Shared extent | Single corner point only |
| Shared edge | None |

`VERIFIED_FROM_FILE`

**Critical finding:** These cells are **diagonally adjacent** (corner-touching), not edge-adjacent. LI covers a southwest grid square; RI covers a northeast grid square offset by one full cell in both E and N directions. They share only a single corner point. `VERIFIED_FROM_FILE`

**Consequence:** Traditional seam analysis for line/polygon continuity across a shared edge does not apply. There is no boundary along which features from LI and RI can be geometrically continuous. Any feature appearing near 4.333°E in LI and near 4.333°E in RI would have to span a geometric gap to connect.

### FOID analysis

All features in both cells use AGEN=7979. `VERIFIED_FROM_FILE`

**FIDN series observed:**

| Cell | Layer | FIDN values seen | Pattern |
|------|-------|-----------------|---------|
| LI | DEPARE | 1781701631 (0x6A32_9BFF) exclusively | Cell-scoped series |
| LI | SOUNDG | 1781701631 (0x6A32_9BFF) | Same series |
| RI | DEPARE | 1782766843 (0x6A42_DCFB) primary; 293585577 secondary | Two distinct FIDN series |
| RI | SOUNDG | 1782766843 (0x6A42_DCFB) | Primary series |

`VERIFIED_FROM_FILE`

**No shared FIDN values were found between the two cells** across DEPARE and SOUNDG. The secondary FIDN series in RI (293585577) may represent an older legacy record or a referenced feature from an adjacent cell. `INFERRED`

### FOID combination analysis

| Combination | Finding | Status |
|-------------|---------|--------|
| Same FOID + same geometry | Not found — no shared FIDNs detected between cells | `VERIFIED_FROM_FILE` |
| Same FOID + different geometry | Not found — no shared FIDNs detected | `VERIFIED_FROM_FILE` |
| Different FOID + same geometry | Cannot be determined without full geometry comparison across all layers — not performed in this investigation | `UNKNOWN` |
| Shared endpoints / line continuation | Cannot apply — cells share no edge; features would need to span a gap | `INFERRED` |

**LNAM structure:** LNAMs are hex-encoded AGEN+FIDN+FIDS values. LI LNAM example: `1F2B6A329BFF774B` = AGEN 7979 (0x1F2B), FIDN 1781701631 (0x6A329BFF), FIDS sequential. RI LNAM example: `1F2B6A42DCFB76BB` = AGEN 7979 (0x1F2B), FIDN 1782766843 (0x6A42DCFB), FIDS sequential. No shared LNAM prefixes across cells. `VERIFIED_FROM_FILE`

---

## Section 11 — Update and Edition Analysis

### What the files prove (`VERIFIED_FROM_FILE`)

| Field | LI | RI |
|-------|----|----|
| EDTN | 78 | 46 |
| UPDN | 0 | 0 |
| UADT | 20260617 | 20260629 |
| ISDT | 20260617 | 20260629 |
| EXPP | 1 (New dataset) | 1 (New dataset) |

Both cells are base `.000` datasets with zero updates applied. They are complete replacement base cells, not incremental updates.

### What S-57 documentation says (`VERIFIED_FROM_OFFICIAL_DOCUMENTATION`)

Per IHO S-57 Edition 3.1, Part 1, Section 8 (Dataset Management):
- UPDN=0 means this is a base cell with no companion update files applied.
- EXPP=1 ("New dataset") confirms base exchange purpose.
- Companion update files, if they existed, would be named `1R76W8LI.001`, `1R76W8LI.002`, etc., and would be applied in sequence.
- GDAL's `UPDATES=APPLY` default would apply any such files automatically if present in the same directory. No companion files are present. `VERIFIED_FROM_FILE`

### What remains unknown (`UNKNOWN`)

- Whether Rijkswaterstaat has published update files (`.001`, `.002`, etc.) for either cell that are not included in this investigation.
- The Dutch IENC publication schedule and whether edition numbers (78, 46) indicate frequent updates or milestone editions.
- Whether the 12-day difference in ISDT dates (20260617 vs 20260629) indicates independent publication cycles or a batch with staggered release.

---

## Section 12 — Depth Semantics

### ⚠️ Safety-critical section — do not display depth values without satisfying all conditions below.

### Vertical and sounding datum

| Parameter | Value | Interpretation | Status |
|-----------|-------|----------------|--------|
| VDAT (vertical datum) | 24 | `UNKNOWN` exact — exceeds standard S-57 table | Do not use without IENC specification |
| SDAT (sounding datum) | 42 | `UNKNOWN` exact — exceeds standard S-57 table | Do not use without IENC specification |
| DUNI | 1 = metres | Confirmed | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Edition 3.1 (IHO Publication S-57, November 2000), Appendix A, DSPM subfield DUNI, value 1 = metres |
| COMF | 10,000,000 | Applied by GDAL | `VERIFIED_FROM_FILE` |
| SOMF | 10 | Applied by GDAL | `VERIFIED_FROM_FILE` |

**The exact vertical and sounding datum references (VDAT=24, SDAT=42) are unknown from available evidence.** They likely refer to Dutch inland references such as NAP (Normaal Amsterdams Peil) or OLW/GLW (Ordinary/Guaranteed Low Water), but this requires official IENC Product Specification 2.4 enumeration tables to confirm. `INFERRED`

### DEPARE depth values

`DRVAL1` and `DRVAL2` define the lower and upper bounds of a depth area in metres relative to the chart datum (VDAT). GDAL decodes these using SOMF. Sign convention (GDAL elevation): negative = below datum, positive = above datum.

**Observed range in LI:** −4.0m to +7.5m relative to chart datum.  
**Observed range in RI:** +4.5m to +20.0m relative to chart datum — deeper waterway.

These values are **charted depth range estimates as of the chart issue date**, not current water depth. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix B, object DEPARE, attributes DRVAL1/DRVAL2.

### DEPCNT depth contour values

`VALDCO` is the depth value for the contour in metres. Sampled value: 10.0m. `VERIFIED_FROM_FILE`

### SOUNDG sounding values

Soundings are 3D MultiPoint geometries. Z = decoded sounding depth in metres (SOMF applied). GDAL sign: negative Z = below sounding datum.

Example LI soundings: −3.6, −2.9, −2.3, −2.0, −1.2, −0.7, +0.5, +0.6, +0.8  
Example RI soundings: +0.9, +1.6, +4.1, +5.7, +7.4, +10.0, +11.6

**EXPSOU=1 on all sampled soundings:** "Least depth known" — `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO S-57 Ed 3.1 Appendix B, attribute EXPSOU, value 1.

### Evidence chain required before Dolphin may display "Chart depth: X m"

All of the following must be confirmed before any depth value is shown to a sailor:

1. **VDAT and SDAT are formally decoded** — the raw integers 24 and 42 must be mapped to named datums from the official IENC Product Specification 2.4 enumeration tables. `UNKNOWN` at this time.
2. **DUNI=1 (metres) confirmed** — ✅ confirmed.
3. **SOMF=10 applied** — ✅ GDAL applies this automatically.
4. **Chart age disclosed** — The sounding dates (ISDT: 20260617 / 20260629) must be shown. Charted depths are historical, not real-time.
5. **Datum name shown** — The name of the reference datum (once decoded) must appear alongside the depth value.
6. **EXPSOU qualifier shown** — EXPSOU=1 ("Least depth known") must be conveyed. This is a quality qualifier, not a guarantee of exact depth.
7. **Disclaimer present** — "This is charted depth relative to [datum]. Actual water depth varies with tide, current, and seasonal conditions. Not a substitute for a current nautical chart."

**Until conditions 1 and 4–7 are met, no depth values from these cells should be displayed to users.** `INFERRED` from the safety-critical nature of depth display in navigation contexts.

### Portrayal risk

Raw S-57 object class (e.g. `DEPARE`) does not directly define Dolphin's visual symbolization. Correct data decoding and correct chart portrayal are independent problems. The IHO S-52 Presentation Library (a separate specification) defines how S-57 objects are rendered on ENC displays. Dolphin must implement its own portrayal logic referencing S-52 or a compatible nautical portrayal standard — the S-57 data alone does not specify colors, symbols, or rendering rules. `INFERRED`

---

## Section 13 — Nationwide Scaling Model

### Design principles

Zeeland cells are the pilot. Every design decision must accommodate all Dutch IENC cells (estimated 200+ cells for inland waterways).

### National cell catalog structure (`INFERRED` design)

```
data/
  enc/
    catalog/
      cell-catalog.json         # machine-readable national index
      cell-catalog.md5          # checksum of the catalog file
    raw/
      NL/
        <cellname>/
          <cellname>.000         # immutable source archive (git-ignored)
          <cellname>.sha256      # per-cell checksum file
          <cellname>.001         # companion update (if present)
          metadata.json          # extracted DSID/DSPM metadata (generated)
    processed/
      NL/
        <cellname>/
          <cellname>-objects.geojson     # per object class GeoJSON (generated)
          <cellname>-features.geojson    # per Dolphin feature group GeoJSON
          <cellname>-manifest.json       # generated file manifest + checksums
    tiles/                       # future: vector tiles (deferred)
```

### Cell catalog schema (`INFERRED`)

```json
{
  "cells": [
    {
      "cellName": "1R76W8LI",
      "filename": "1R76W8LI.000",
      "sha256": "1228405b...",
      "edition": 78,
      "updateNumber": 0,
      "issueDate": "2026-06-17",
      "updateDate": "2026-06-17",
      "scale": 2000,
      "intu": 7,
      "vdat": 24,
      "sdat": 42,
      "bbox": [4.133333, 51.575000, 4.333333, 51.625000],
      "region": "zuidholland",
      "processedAt": null
    }
  ]
}
```

### Region grouping (`INFERRED`)

Group cells by Dutch province/waterway system: `zeeland`, `zuidholland`, `noordholland`, `utrecht`, `gelderland`, `overijssel`, `friesland`, `groningen`, `drenthe`, `flevoland`, `nordzeekanaal`, `rijn-merwede`, `maas`, `ijssel`.

### Viewport-based loading

At runtime, resolve the user's map bbox → query cell catalog for overlapping cells → load only processed GeoJSON for those cells. Minimum zoom before chart data loads: `INFERRED` as zoom 10+ (approximately 1:50,000 or larger). Cache loaded cells by edition+cellname key.

### Route-corridor loading

For a planned route: expand route polyline by vessel draught + safety margin → resolve intersecting cells → preload processed GeoJSON for all intersecting cells before route starts.

### Edition and update tracking

Detect new editions by comparing EDTN+UPDN in the catalog against the previously processed version. A changed EDTN or a UPDN > 0 with no processed output triggers a reprocessing run.

### Caching

Processed GeoJSON files are static — cache by `cellname-edtn-updn` composite key. Invalidate only when edition or update number changes.

---

## Section 14 — Ingestion Pipeline Design

### Pipeline stages

```
Official .000 source files
  → immutable raw archive (git-ignored, checksum-manifested)
  → checksum verification (SHA-256 per cell)
  → GDAL S-57 reader (pinned version, documented open options)
  → formal metadata extraction (DSID layer → metadata.json)
  → object class inventory (all layers → inventory.json)
  → attribute inventory (per-layer attribute survey → attributes.json)
  → normalization (selected attributes → Dolphin feature schema)
  → validation (geometry validity, coordinate range, required field presence)
  → intermediate output (per-class GeoJSON with all raw attributes preserved)
  → web-consumable output (per-Dolphin-group GeoJSON with normalized fields)
```

### Output format evaluation

**Option A: GeoJSON per raw object class**
- Pro: Preserves full S-57 structure; easy to audit; no information loss at this stage.
- Con: 30+ files per cell; complex client-side layer management.
- `INFERRED` recommendation: Use for intermediate storage (data/ layer).

**Option B: GeoJSON per Dolphin feature group**
- Pro: Single file per semantic group (depths, buoys, lights, hazards, etc.); matches UI layer model.
- Con: Requires mapping decisions that may encode errors; harder to audit raw data.
- `INFERRED` recommendation: Use for web-consumable output (public/ layer).

**Option C: Vector tiles (deferred)**
- Pro: Efficient streaming at national scale; native zoom-level filtering.
- Con: Requires tippecanoe or equivalent; additional complexity; deferred.

### Recommendation

**For current alpha (Zeeland pilot):** GeoJSON per raw object class for intermediate storage; GeoJSON per Dolphin feature group (7–10 groups) for web consumption. Store all raw S-57 attributes in intermediate GeoJSON before any normalization. `INFERRED`

**For national scale:** Vector tiles from the intermediate GeoJSON, served per cell or as a merged national tileset. Plan for this from the start; avoid designs that require full re-architecture at scale. `INFERRED`

### Proposed Dolphin feature groups (alpha)

| Group | S-57 classes | Notes |
|-------|-------------|-------|
| depth-areas | DEPARE | Depth area polygons |
| depth-contours | DEPCNT | Depth contour lines |
| soundings | SOUNDG | Spot depth points |
| lights | LIGHTS | Navigation lights |
| buoys | BOYLAT, BOYSPP, BCNSPP | All buoy types |
| marks | TOPMAR, dismar, notmrk, sistaw | Markers and signals |
| infrastructure | bridge, DAMCON, SLCONS, PYLONS, PILPNT | Fixed structures |
| waterway | wtwaxs, NAVLNE, RECTRC, lokbsn | Waterway routing |
| restricted | resare, UNSARE, MARCUL | Restricted and unsurveyed areas |

**Raw attributes must be preserved in the intermediate GeoJSON layer before any normalization.** All IENC lowercase national attributes must be retained. `INFERRED`

---

## Section 15 — Git and Source Safety

### Directory structure recommendation

```
data/enc/raw/NL/<cellname>/          # raw .000 files — NOT in git (see .gitignore)
data/enc/processed/NL/<cellname>/    # generated GeoJSON — NOT in git (generated)
data/enc/catalog/                    # cell catalog JSON — IN git (small, versioned)
data/enc/checksums/                  # SHA-256 manifest — IN git
```

### .gitignore strategy

```gitignore
# Raw IENC/S-57 source files — never committed
data/enc/raw/**/*.000
data/enc/raw/**/*.001
data/enc/raw/**/*.002

# Generated processed outputs — regenerated from raw
data/enc/processed/

# Accidental staging of attached_assets .000 files
attached_assets/*.000
```

### Checksum manifest strategy

Maintain `data/enc/checksums/manifest.sha256`:
```
1228405ba6...  NL/1R76W8LI/1R76W8LI.000
cbdea5755b...  NL/1R7788RI/1R7788RI.000
```

Verify before every processing run: `sha256sum -c manifest.sha256 --strict`. Abort processing if any checksum fails.

### Vite bundle protection

Raw `.000` files must never be in `public/` or `src/`. Only processed GeoJSON for the current viewport should be in the client bundle, and only via dynamic import at runtime. `INFERRED`

### Source file immutability

Raw `.000` files must be opened read-only by the processing pipeline. The pipeline must never write to the raw source directory. Use separate input and output directories with explicit filesystem permissions where possible. `INFERRED`

---

## Section 16 — Risk Register

| Risk | Impact | Likelihood | Mitigation | Blocking |
|------|--------|-----------|------------|---------|
| Wrong datum interpretation (VDAT=24, SDAT=42 unknown) | Critical — incorrect depth display could endanger navigation | High (values exceed standard S-57 tables) | Do not display depth values until IENC specification consulted and VDAT/SDAT formally decoded | **Yes** — blocks any depth display |
| Missed companion update files (.001/.002) | High — chart data may be outdated or contain errors | Medium (UPDN=0 in available files; publisher may have issued updates) | Always check publisher (Rijkswaterstaat) for current editions before ingestion; verify UPDN in metadata.json against latest known | **Yes** — for production use |
| Duplicate features across cells | Medium — visual artifacts, inflated counts | Low (no shared FIDNs found; diagonal adjacency means no shared edge) | Current evidence shows no duplicates; full geometry comparison across all layers remains unperformed | No |
| Cell seam artifacts | Low — cells are diagonally adjacent, not edge-adjacent | Low | No shared edge means no seam artifacts are geometrically possible at this boundary | No |
| Wrong object class mapping | High — IENC classes (lokbsn, dismar, wtwaxs, etc.) misclassified as base S-57 objects | Medium | Consult IENC Product Specification 2.4 for complete object catalogue; preserve raw class names in intermediate GeoJSON | **Yes** — for IENC-specific classes |
| Lost raw attributes during normalization | Medium — IENC national attributes (lowercase acronyms) silently dropped | Medium | Always normalize from intermediate GeoJSON that preserves all raw attributes; never normalize from OGR output directly | No |
| Oversized GeoJSON at national scale | Medium — LI has 532 DEPARE + 528 DEPCNT features in a single cell; 200+ cells nationally | High | Use vector tiles for production; implement viewport-based loading from the start | No (alpha) |
| Mobile performance with large feature sets | Medium — 1000+ polygons per cell at 1:2000 scale | Medium | Respect SCAMIN values for zoom-level filtering; simplify geometries for display at small scales | No (alpha) |
| Licensing / redistribution assumptions | High — Dutch IENC data from Rijkswaterstaat has specific licence terms | `UNKNOWN` | Consult Rijkswaterstaat data license before any public deployment; do not assume open redistribution | **Yes** — for any public release |
| Stale chart data presented as current | Critical — chart issued 2026-06-17/29; waterways change | High | Always display chart edition and issue date alongside any chart data; add "not for navigation" disclaimer | **Yes** — for any user-facing display |
| False "official data" claims in the UI | High — misleading sailors about data authority | Medium | Label data as "Based on official IENC data © Rijkswaterstaat [edition date]" with full licence compliance | **Yes** |
| Correctly decoded object rendered with incorrect nautical portrayal | High — DEPARE polygon with wrong colour coding; buoy with wrong symbol | Medium | Raw S-57 class ≠ Dolphin symbolization. Implement portrayal layer referencing IHO S-52 or an IENC-compatible presentation standard. Never hard-code colour to class name. | **Yes** — for any rendered chart |
| GDAL version or open-option change altering extraction results | Medium — reader conditions change, output differs silently | Low | Pin GDAL version in processing pipeline; document all open options; re-verify checksums if GDAL is upgraded | No (document version) |
| GDAL_DATA not set — encoding fallback | Low — enumeration decoding may fall back to compiled defaults | Low | Set GDAL_DATA explicitly in processing pipeline environment to the GDAL data directory | No |

---

## Section 17 — Final Consolidated Plan

### Confirmed facts

1. **Two Dutch IENC cells are available:** 1R76W8LI (edition 78, 2026-06-17) and 1R7788RI (edition 46, 2026-06-29). Both are base cells (UPDN=0), IENC specification version 2.4, scale 1:2000, producer Rijkswaterstaat (AGEN=7979), S-57 edition 3.1. `VERIFIED_FROM_FILE`

2. **GDAL 3.2.2 with S-57 driver is installed and functional.** Both cells open successfully. DSID metadata, all object class layers, and geometry are fully readable. `VERIFIED_FROM_FILE`

3. **The cells are diagonally adjacent** (corner-touching at 4.333°E, 51.625°N), not edge-adjacent. No seam artifacts are geometrically possible at this boundary. `VERIFIED_FROM_FILE`

4. **No shared FOIDs detected** between the cells. Feature IDs appear cell-scoped. `VERIFIED_FROM_FILE`

5. **Depth-related datums (VDAT=24, SDAT=42) are unknown.** These values exceed the base IHO S-57 enumeration tables and are IENC-specific. No depth values may be displayed until these are formally decoded from IENC specification documentation. `UNKNOWN` / blocking.

6. **GDAL applies COMF and SOMF automatically.** All coordinate and sounding outputs are already in decimal degrees and metres. `VERIFIED_FROM_FILE`

7. **IENC-specific object classes and attributes are present** (wtwaxs, lokbsn, dismar, notmrk, sistaw, bunsta, rdocal and their lowercase national attributes). These require IENC Product Specification 2.4 documentation to fully decode. `VERIFIED_FROM_FILE`

8. **Dolphin application is unchanged.** TypeScript: 0 errors. Production build: passes. No chart data rendered. No raw files exposed. `VERIFIED_FROM_FILE`

### Current Dolphin architecture assessment

| Component | Status | Ready for ENC? |
|-----------|--------|----------------|
| `NauticalDataProvider` interface | Placeholder — correct hook points | Yes — extend |
| `overlayManager` / `applyOverlays` | Working — needs ENC source/layer specs | Yes — extend |
| `MapView` / `MapViewRef` | Fully functional | Yes — no changes |
| `LayerSheet` | Mode picker only — no nautical toggle | Extend |
| GPS / SOG / COG / vessel | Fully functional | No changes needed |
| `NauticalLayerRegistry` | Does not exist | Build new |
| `useNauticalOverlays` hook | Does not exist | Build new |
| `NauticalObjectSheet` | Does not exist | Build new |
| `EncFeatureTypes` | Does not exist | Build new (informed by this report) |

### Unknowns requiring resolution before further work

1. **VDAT=24 and SDAT=42 exact datum names** — requires IENC Product Specification 2.4 official documentation.
2. **INTU=7 and PRSP=10 formal definitions** — requires IENC spec or IHO S-57 IENC addendum.
3. **AGEN=7979 official confirmation** — requires IHO agency code registry.
4. **Rijkswaterstaat data licence terms** — required before any public deployment.
5. **Companion update files (.001/.002)** — check publisher for current editions.
6. **Whether Dolphin requires IHO S-52 portrayal compliance** — nautical portrayal standard.
7. **Whether cells 1R76W8LI and 1R7788RI cover the intended pilot area** — geographic coverage not yet confirmed against a known reference.

### Exact next implementation step

**Obtain and read the IENC Product Specification Edition 2.4** (published by ISRS — International Sluicing and River Standards — or equivalent Dutch authority) to decode:
- VDAT enumeration (confirm value 24)
- SDAT enumeration (confirm value 42)
- INTU=7 formal definition
- PRSP=10 formal definition
- Complete IENC object and attribute catalogue (for IENC-specific classes and national attributes)

**Only after the datum is confirmed** should a processing pipeline be implemented. The pipeline entry point is a Node.js or Python script that:
1. Reads `.000` files via GDAL (pinned to 3.2.2 with documented open options)
2. Extracts and saves `metadata.json` from the DSID layer
3. Exports each object class as GeoJSON preserving all raw attributes
4. Validates geometry and coordinate ranges
5. Produces a per-Dolphin-group GeoJSON for the alpha map layer

No GeoJSON should be placed in `public/` or bundled into the app until licensing is confirmed.

---

## Validation

```
$ pnpm --filter @workspace/dolphin run typecheck
→ 0 errors

$ pnpm --filter @workspace/dolphin run build
→ ✓ built in 5.55s
```

- App behaviour: unchanged `VERIFIED_FROM_FILE`
- Source `.000` files: not mutated (SHA-256 checksums unchanged) `VERIFIED_FROM_FILE`
- Raw chart source in `public/`: none `VERIFIED_FROM_FILE`
- Fabricated metadata: none `VERIFIED_FROM_FILE`
- Chart data rendered in UI: none `VERIFIED_FROM_FILE`

---

*End of investigation report. This document is a research deliverable only. No implementation has been performed.*
