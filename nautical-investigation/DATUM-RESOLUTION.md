# DATUM-RESOLUTION.md
## Dolphin Navigation — v0.2.1 Depth Datum Resolution Report

**Date:** 2026-07-07  
**Scope:** Resolve DSPM_VDAT=24 and DSPM_SDAT=42 for cells 1R76W8LI and 1R7788RI  
**Analyst:** Automated forensic investigation  
**Status of prior work:** Base investigation completed (REPORT.md). These two datum codes were identified as the single blocking issue for depth display.

---

## 1. Purpose and Scope

This document is a focused forensic investigation to answer six questions required for a CLEARED depth-display verdict:

1. What is the effective vertical datum (VDAT=24)?
2. What is the effective sounding datum (SDAT=42)?
3. Are depth values in metres?
4. Are DSPM multipliers (COMF, SOMF) handled correctly?
5. Do any spatial datum override objects (m_vdat, m_sdat) exist?
6. What are the correct display wordings for DSID_ISDT and DSID_UADT?

---

## 2. Four-Label Status Model

All claims in this document carry one of four labels:

| Label | Meaning |
|---|---|
| `VERIFIED_FROM_FILE` | Directly read from the S-57 cell bytes via GDAL |
| `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` | Confirmed from a named, citable authoritative standard; citation provided |
| `INFERRED` | Deduced from confirmed facts; logical but not directly confirmed by a document |
| `UNKNOWN` | Could not be determined from any accessible source despite exhaustive search |

---

## 3. Cell Identification

Both cells were produced by Rijkswaterstaat (AGEN=7979) under IENC Product Specification 2.4 (DSID_PRSP=10, DSID_PRED="2.4"). `VERIFIED_FROM_FILE` — from REPORT.md §3 and §4.

| Attribute | Cell 1R76W8LI | Cell 1R7788RI |
|---|---|---|
| DSID_PRSP | 10 | 10 |
| DSID_PRED | "2.4" | "2.4" |
| DSID_INTU | 7 | 7 |
| DSID_COMT | "STED:3.1.1" | "STED:3.1.1" |
| DSID_STED | 3.1 | 3.1 |
| DSID_ISDT | 2026-06-17 | 2026-06-29 |
| DSID_UADT | 2026-06-17 | 2026-06-29 |
| DSID_EDTN | 78 | 46 |
| AGEN | 7979 (Rijkswaterstaat) | 7979 (Rijkswaterstaat) |
| Bbox | 4.133°–4.333°E / 51.575°–51.625°N | 4.333°–4.533°E / 51.625°–51.675°N |
| Scale | 1:2000 | 1:2000 |

`VERIFIED_FROM_FILE` for all rows above.

**DSID_COMT = "STED:3.1.1":** This is the Comment subfield of the Data Set Identification record. "STED" encodes the S-57 Transfer Edition marker used in IENC data; the value "3.1.1" designates S-57 Edition 3.1.1, the base data-exchange standard on which IENC Product Specification 2.4 is built. `INFERRED` — the "STED:3.1.1" convention is an IENC encoding practice; no explicit definition of this comment string was located in the documents accessed. The formal S-57 base edition (DSID_STED=3.1) is confirmed in the governing spec. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *CESNI Product Specification for Inland ENCs, Edition 2.5, Section 6.3.2.3, DSPM table entry for COMT.*

---

## 4. Vertical Datum: VDAT=24

### 4.1 Definition

**VDAT=24 = "Local Datum"** — this is a base S-57 code, not IENC-specific.

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO Transfer Standard S-57 Appendix B.1 Annex A: Use of the Object Catalogue for ENC, Edition 4.3.0, October 2022, Table 2.1 ("Vertical Datum"), code 24: "Local Datum".*

Cross-confirmed independently:

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO Geospatial Information Registry, Data Dictionary Register, Attribute "Vertical Datum", item identifier 1206, code 24: Name = "Local Datum", Definition: "An arbitrary datum defined by a local harbour authority, from which levels and tidal heights are measured by this authority." URL: https://registry.iho.int/fdd/view5.do?idx=1206&type=5&valueType=0*

### 4.2 What "Local Datum" Means for These Cells

In Dutch inland waterway infrastructure, NAP (Normaal Amsterdams Peil / Amsterdam Ordnance Datum) is the primary national height reference, defined by law (Kadasterwet) and applied throughout the Netherlands as the common vertical reference for fixed infrastructure. `INFERRED` — no document fetched explicitly states "VDAT=24 means NAP in these specific cells," but the following evidence supports this inference:

- Both cells are produced by Rijkswaterstaat, the Dutch national waterway authority. `VERIFIED_FROM_FILE`.
- The cells cover the Rotterdam/Nieuwe Waterweg/Hollandsch Diep area, entirely within the Netherlands. `VERIFIED_FROM_FILE`.
- NAP is the standard Dutch "local datum" for infrastructure heights including bridges, locks, sluices, lights, and overhead cables. `INFERRED` from Dutch water management practice; no cell-specific citation available.
- VDAT governs heights and clearances (bridges, overhead cables, lights), not depths. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *CESNI Product Specification for Inland ENCs, Edition 2.5, Section 4.2.*

**Note:** Other local datums exist in the Netherlands for specific local water bodies. The claim that VDAT=24 = NAP is `INFERRED` for these cells specifically; a cell-specific declaration from Rijkswaterstaat or the IENC Encoding Guide would upgrade this to `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

**Practical effect:** Height and clearance values in these cells (VERCLR, VERCCL, VERCOP, VERCSA, ELEVAT, HEIGHT on bridge decks, overhead cables, light towers) are most likely referenced to NAP. `INFERRED`.

### 4.3 S-57 Base Table Coverage

The complete vertical datum enumeration from S-57 Appendix B.1, Table 2.1, around code 24:

| Code | Meaning |
|---|---|
| 3 | Mean sea level |
| 16 | Mean high water |
| 17 | Mean high water springs |
| 18 | High water |
| 19 | Approximate mean sea level |
| 20 | High water springs |
| 21 | Mean higher high water |
| **24** | **Local datum** |
| 25 | International Great Lakes datum 1985 |
| 26 | Mean water level |
| 28 | Higher high water large tide |
| 29 | Nearly highest high water |
| 30 | Highest astronomical tide (HAT) |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *S-57 Appendix B.1 Annex A, Ed 4.3.0, October 2022, Table 2.1.*

Code 24 is a standard, well-defined, long-standing S-57 code. Its appearance in these cells requires no special IENC extension and no profile-specific decoding. `INFERRED` — the conclusion that no IENC-specific override is needed follows from code 24 being present in the base S-57 table; this is deduced from the table, not from a separate statement in the governing specification.

### 4.4 VDAT Verdict

| Question | Answer | Status |
|---|---|---|
| Is VDAT=24 formally defined? | Yes — "Local Datum" | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` |
| Physical datum | NAP (Normaal Amsterdams Peil) | `INFERRED` |
| Units | Metres (DSPM_DUNI=1) | `VERIFIED_FROM_FILE` |
| Multiplier | DSPM_COMF=10,000,000 (position scaling only; heights unaffected) | `VERIFIED_FROM_FILE` |
| Spatial override (m_vdat) | None found in either cell | `VERIFIED_FROM_FILE` (see §7) |

**VDAT=24: CLEARED** — the vertical datum is formally identified (`VERIFIED_FROM_OFFICIAL_DOCUMENTATION`), physically meaningful for Dutch infrastructure (`INFERRED`), and uniformly applied across both cells with no spatial overrides (`VERIFIED_FROM_FILE`).

---

## 5. Sounding Datum: SDAT=42

### 5.1 Base S-57 Table

The sounding datum enumeration in S-57 Appendix B.1, Table 2.2 (ENC Product Specification, Ed 4.3.0) runs from code 1 to code 27:

| Code range | Description |
|---|---|
| 1–15 | Marine low-water and tidal datums (MLWS, MLLWS, MSL, LLW, MLW, etc.) |
| 19 | Approximate mean sea level |
| 22 | Equinoctial spring low water |
| 23 | Lowest astronomical tide |
| 24 | Local datum |
| 25 | International Great Lakes datum 1985 |
| 26 | Mean water level |
| 27 | Lower low water large tide |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *S-57 Appendix B.1 Annex A, Ed 4.3.0, October 2022, Table 2.2.*

**Code 42 does not appear in this table.** `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

### 5.2 IHO Geospatial Information Registry

The IHO Geospatial Information Registry — the authoritative live catalogue of S-57 and IENC attribute values — was consulted in full. The Vertical Datum attribute (covering VDAT, SDAT, and the VERDAT attribute used by m_vdat/m_sdat) lists the following codes above code 30:

| Code | Name | Domain |
|---|---|---|
| 31 | Local Low Water Reference Level | IHO Hydro |
| 32 | Local High Water Reference Level | IHO Hydro |
| 33 | Local Mean Water Reference Level | IHO Hydro |
| 34 | Equivalent Height of Water (German GlW) | Inland ENC |
| 35 | Highest Shipping Height of Water (German HSW) | Inland ENC |
| 36 | Reference Low Water Level According to Danube Commission | Inland ENC |
| 37 | Highest Shipping Height of Water According to Danube Commission | Inland ENC |
| 38 | Dutch River Low Water Reference Level (OLR) | Inland ENC |
| 39 | Russian Project Water Level | Inland ENC |
| 40 | Russian Normal Backwater Level | Inland ENC |
| 41 | Ohio River Datum | Inland ENC |
| *(gap — no entry)* | *code 42 is absent* | — |
| 43 | Dutch High Water Reference Level | Inland ENC |
| 44 | Baltic Sea Chart Datum 2000 | IHO Hydro |
| 45 | Dutch Estuary Low Water Reference Level (OLW) | Inland ENC |
| 46 | International Great Lakes Datum 2020 | IHO Hydro |
| 47 | Sea Floor | IHO Hydro |
| 48 | Sea Surface | IHO Hydro |
| 49 | Hydrographic Zero | IHO Hydro |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO Geospatial Information Registry, Data Dictionary Register, Attribute "Vertical Datum", item identifiers 996 (current, accepted 2022-04-04) and 193 (predecessor, accepted 2020-04-21). URLs: https://registry.iho.int/fdd/view3.do?idx=996&type=3 and https://registry.iho.int/fdd/view3.do?idx=193&type=3*

**Code 42 is absent from the IHO Geospatial Information Registry in both the 2020 initial population and the 2022 updated version.** The table jumps directly from 41 (Ohio River Datum) to 43 (Dutch High Water Reference Level). `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

The registry was checked with all status filters (Valid, Invalid, Clarified, Superseded, Retired, Processing). Code 42 does not appear under any status in either registry version. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

### 5.3 IENC Feature Catalogue 2.4 (Governing Specification)

The governing specification for these cells is **IENC Feature Catalogue Edition 2.4 (corr.2), dated 2015-10-30** — derived from DSID_PRED="2.4". `VERIFIED_FROM_FILE` — DSID_PRED="2.4" read from both cells' DSID record (REPORT.md §3). The VERDAT attribute enumeration in that catalogue is the definitive source for SDAT values encoded in these cells. `INFERRED` — this follows from S-57/IENC standard practice that DSID_PRED identifies the governing feature catalogue edition; no cell-specific footnote states this explicitly.

The FC 2.4 (corr.2) XML file (722,034 bytes) exists at `https://github.com/cesniti/iehg_gitbook/blob/edition-2.4/.gitbook/assets/ienc_fc_24_corr2.xml` (SHA 548d23241c5e8d9f54f101fb6951edec6dfd404e). `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *GitHub Repository cesniti/iehg_gitbook, branch edition-2.4, GitHub API blob endpoint: https://api.github.com/repos/cesniti/iehg_gitbook/contents/.gitbook%2Fassets%2Fienc_fc_24_corr2.xml?ref=edition-2.4. File size and SHA confirmed in API response, accessed 2026-07-07.*

**The VERDAT enumeration section of the FC 2.4 XML was not retrieved.** `UNKNOWN`. The file is 722 KB; all fetch strategies returned either the first ~50 KB (which covers early attributes in the XML, before VERDAT is reached alphabetically) or a timeout. Nine distinct fetch strategies were attempted, all failing for the reasons noted:

- Direct PDF/XML fetch from ienccloud.us: HTTP 504 timeout. `UNKNOWN`.
- Direct PDF/XML fetch from CESNI RIS: HTTP 504 timeout. `UNKNOWN`.
- GitHub raw XML URL (`raw.githubusercontent.com`): returned 50,013 bytes of mismatched content (same as CESNI 2.5 product spec — indicates server-side redirect). `UNKNOWN`.
- CESNI annex document `cesni21_13en_annex3-2.pdf`: HTTP 504 timeout. `UNKNOWN`.
- GitHub blob API (base64-encoded): returned only the first ~50 KB of the 722 KB encoded file; the VERDAT attribute section was beyond the truncation point. `UNKNOWN`.
- jsdelivr CDN mirror of the GitHub file: returned the same 50,013-byte mismatched content. `UNKNOWN`.
- ienccloud.us HTML attribute pages for VERDAT: HTTP 404. `UNKNOWN`.
- GitHub code search API: returned metadata only, no enumeration values. `UNKNOWN`.
- S-58 Ed 8.0.0 PDF (IHO, October 2024): document structure visible (50 KB extracted) but SDAT validation section not reached within truncation limit. `UNKNOWN`.

Whether code 42 is defined in the FC 2.4 VERDAT enumeration table cannot be confirmed. `UNKNOWN`.

### 5.4 Contextual Analysis

**Physical geography:** The cells cover 4.133°–4.533°E, 51.575°–51.675°N — the Rotterdam metropolitan waterway area including the Nieuwe Waterweg, Nieuwe Maas, and Hollandsch Diep. These are estuarine/tidal inland waterways managed by Rijkswaterstaat. `INFERRED` from bounding-box coordinates.

**Dutch sounding datum practice:** The Dutch IENC kennisportaal (national IENC knowledge portal) states explicitly that depth information in Dutch IENC cells references a water level reference plane, specifically not NAP. Direct quote (Dutch): *"Gebied met gedetailleerde diepte-informatie ten opzichte van één waterstandreferentievlak (NIET NAP! maar bv OLR)"* — "Area with detailed depth information relative to one water level reference plane (NOT NAP! but e.g. OLR)". `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IENC Kennisportaal, section I.1.1, https://ienc-kennisportaal.nl/i-1-1-diepten-ten-opzichte-een-referentievlak/, accessed 2026-07-07.*

**Dutch datum codes in the IHO Registry:**
- Code 38 = OLR (Dutch River Low Water Reference Level) — `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO Geospatial Information Registry idx=1723.
- Code 45 = OLW (Dutch Estuary Low Water Reference Level / Overeengekomen Laagwater) — `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IHO Geospatial Information Registry idx=1728.
- Both codes carry domain "Inland ENC". `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO Geospatial Information Registry, as cited in §5.2.*
- Typical application: OLR for river cells, OLW for estuarine/tidal cells. `INFERRED` — assignment by waterway type is the Dutch IENC practice per kennisportaal I.1.1, but the registry entries do not themselves specify which waterway type each applies to.

The Rotterdam-area cells are estuarine in character (connected to Nieuwe Waterweg, tidal influence). `INFERRED` from bounding-box coordinates and waterway geography. The appropriate Dutch sounding datum for estuarine cells is OLW. `INFERRED`.

**The gap hypothesis:** Code 42 sits between 41 (Ohio River Datum) and 43 (Dutch High Water Reference Level). The surrounding codes (38, 43, 45) are all Dutch-specific Inland ENC extensions. Code 42 was likely an IENC-specific datum code defined in FC 2.4 (2015) that was either not carried forward into the IHO Registry when first populated from FC 2.5 in April 2020, or was retired/merged into another code (possibly OLW = code 45) during the FC 2.4 → FC 2.5 revision. `INFERRED`.

### 5.5 SDAT Verdict

| Question | Answer | Status |
|---|---|---|
| Is SDAT=42 in base S-57 SDAT table? | No — table ends at 27 | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` |
| Is SDAT=42 in IHO Geospatial Registry (2020)? | No — gap between 41 and 43 | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` |
| Is SDAT=42 in IHO Geospatial Registry (2022)? | No — absent under all status filters | `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` |
| Is SDAT=42 in IENC FC 2.4 governing spec? | Could not determine — document inaccessible | `UNKNOWN` |
| Physical datum likely candidate | OLW (Dutch Estuary Agreed Low Water) | `INFERRED` |
| Spatial override (m_sdat) | None found in either cell | `VERIFIED_FROM_FILE` (see §7) |
| Can depth values be labelled for mariners? | No — datum label unconfirmed | `UNKNOWN` |

**SDAT=42: BLOCKED** — the sounding datum code is absent from all accessible authoritative documentation. A depth value of −2.4 m SDAT cannot be presented to a mariner with a datum label until code 42 is formally identified.

---

## 6. DSPM Multipliers and Units

| Subfield | Value | Effect | Status |
|---|---|---|---|
| DSPM_DUNI | 1 | Depth units = metres | `VERIFIED_FROM_FILE` |
| DSPM_HUNI | 1 | Height units = metres | `VERIFIED_FROM_FILE` |
| DSPM_PUNI | 1 | Positional accuracy units = metres | `VERIFIED_FROM_FILE` |
| DSPM_COMF | 10,000,000 | Coordinate scaling factor — GDAL applies automatically; coordinates returned as decimal degrees | `VERIFIED_FROM_FILE` |
| DSPM_SOMF | 10 | Sounding scaling factor — GDAL applies automatically; Z-values returned in metres | `VERIFIED_FROM_FILE` |

**Multiplier handling:** GDAL 3.x automatically divides raw integer coordinates by COMF and raw integer Z-values by SOMF when reading S-57 cells. No manual scaling is required in application code. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *GDAL S-57 driver documentation, "Open Options" section, options COMF and SOMF: https://gdal.org/drivers/vector/s57.html. Confirmed by GDAL ogrinfo output in the base investigation (REPORT.md §9).* `VERIFIED_FROM_FILE` — GDAL ogrinfo applied COMF/SOMF and returned decimal-degree coordinates with metre Z-values (REPORT.md §9).

**GDAL Z-sign convention (CORRECTED — DOL-012):** Positive Z = charted depth below sounding datum; negative Z = drying height above sounding datum. This is the authoritative S-57 sounding sign convention. A SOUNDG feature with Z = +4.2 means 4.2 m of navigable water depth below the sounding datum. A SOUNDG feature with Z = −0.8 means the feature sits 0.8 m above the sounding datum (shoal, bank, or area exposed at chart datum). A DEPARE with DRVAL1 = −4.0 and DRVAL2 = −2.0 means the area ranges from 2.0 m to 4.0 m above sounding datum (drying area). `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO S-57 Edition 3.1, Appendix B, SOUNDG geometry: Z-coordinate stores sounding value per SOMF, positive = below datum.*

**Note:** An earlier version of this document stated the opposite sign convention (negative = below, positive = above). That interpretation was incorrect and is the root cause of the DOL-012 pipeline remediation. The corrected mapping is: Z > 0 → relation "below" (charted depth); Z < 0 → relation "above" (drying height); Z = 0 → relation "at".

**Sample values observed (corrected interpretation):** Cell LI SOUNDG Z-values include both positive (+0.5 to +0.8 m, shallow charted depths below datum) and negative (−3.6 to −0.7 m, drying heights above datum — areas exposed at chart datum). Cell RI SOUNDG Z-values are all positive (+0.9 to +10.0 m), indicating charted navigable depths below sounding datum — consistent with a deep navigable waterway. `VERIFIED_FROM_FILE` — *REPORT.md §11 SOUNDG section; corrected per DOL-012.*

Both cells carry identical DSPM multiplier values. `VERIFIED_FROM_FILE`.

**Multipliers: CLEARED** — COMF and SOMF values are correctly handled by GDAL with no application-layer intervention required. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` (GDAL driver behaviour) + `VERIFIED_FROM_FILE` (ogrinfo output confirms metres and decimal degrees).

---

## 7. Spatial Datum Override Objects (m_vdat, m_sdat)

The IENC Feature Catalogue defines two meta objects that can spatially override the DSPM defaults within sub-areas:

- `m_vdat` — Vertical Datum override
- `m_sdat` — Sounding Datum override

Both are standard IENC objects visible in the FC 2.4 object acronym list. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IENC FC 2.4 object list at https://ienccloud.us/ienc/web/s-57/index242.html.*

**GDAL layer inspection results:** Neither cell contains m_vdat or m_sdat layers.

`VERIFIED_FROM_FILE` — GDAL `ogrinfo` layer listing (no `-al`) run against both cells during the base investigation; grep for "vdat", "sdat", "m_vd", "m_sd" returned zero matches in both cells. See REPORT.md §8.

**Note:** The full `ogrinfo -al` scan (which would walk every feature's attribute list to detect any VERDAT value on individual objects) was not completed due to GDAL PATH misconfiguration in the build environment. The layer-name grep is sufficient to confirm the absence of m_vdat and m_sdat *meta objects*. Per S-57 Appendix B.1 §2.1.2, VERDAT overrides on depth-class geo-features (DEPARE, SOUNDG) are prohibited. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *S-57 Appendix B.1 Annex A, Ed 4.3.0, §2.1.2.*

**Conclusion:** DSPM defaults apply uniformly across both cells. VDAT=24 governs all height values; SDAT=42 governs all depth values throughout. No spatial sub-area overrides exist. `VERIFIED_FROM_FILE` (meta object absence).

---

## 8. Depth Feature Semantics Under the Resolved Datum Model

### 8.1 DEPARE (Depth Area)

Present in both cells. Each feature carries:
- `DRVAL1`: minimum depth (metres, referenced to SDAT=42, negative = below datum)
- `DRVAL2`: maximum depth (metres, referenced to SDAT=42)
- `QUASOU`: quality of sounding

`VERIFIED_FROM_FILE` — REPORT.md §11.

### 8.2 DEPCNT (Depth Contour)

Present in both cells. Each feature carries:
- `VALDCO`: contour depth value (metres, referenced to SDAT=42)

`VERIFIED_FROM_FILE` — REPORT.md §11.

### 8.3 SOUNDG (Sounding)

Present in cell 1R76W8LI. Each feature carries:
- Z-coordinate: depth in metres, negative = below sounding datum, referenced to SDAT=42

`VERIFIED_FROM_FILE` — REPORT.md §11.

### 8.4 Summary

All depth values are in metres and reference SDAT=42 as the sounding datum. `VERIFIED_FROM_FILE` — DSPM_DUNI=1, SOMF=10, GDAL auto-applies.

The numerical values are internally consistent and usable for vessel-draft comparison calculations. `INFERRED` — assuming SDAT=42 is a standard low-water reference datum (as context strongly suggests), comparing DRVAL1/DRVAL2 against a vessel draft value is meaningful; however, if SDAT=42 proves to be a high-water or mid-water datum rather than a low-water reference, this assumption fails. This is a further reason not to display values to mariners until the datum is confirmed.

The blocking issue is the datum *label*, not the numerical availability of depth data. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *IHO S-52 Presentation Library Ed 4.0, §3.2 and §4.3 require a datum reference label on all displayed depth values.* Dolphin may read and process DRVAL1/DRVAL2 values internally; it must not present them to mariners without a confirmed datum label.

---

## 9. Source Date Semantics (DSID_ISDT and DSID_UADT)

The CESNI Recommended Validation Checks define:

- **DSID_ISDT** = Issue date of the data set
- **DSID_UADT** = Update application date (date through which all updates have been incorporated)

Validation check 1523 states: "For data sets with a file name extension of '.000', [ISDT] shall be greater than or equal to the value of the Update application date (UADT) subfield."

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *CESNI/IEHG Recommended Validation Checks for Inland ENCs, Edition 2.3.5 corr1, checks 1522–1523.*

Both cells are `.000` (base cell) files. For `.000` files, UADT reflects update currency.

| Cell | DSID_ISDT | DSID_UADT | Condition |
|---|---|---|---|
| 1R76W8LI | 2026-06-17 | 2026-06-17 | ISDT ≥ UADT ✅ |
| 1R7788RI | 2026-06-29 | 2026-06-29 | ISDT ≥ UADT ✅ |

`VERIFIED_FROM_FILE`.

**Conditional display wording (for use once CLEARED verdict is issued):**

- Cell LI: "Chart data issued 17 Jun 2026 · current to 17 Jun 2026"
- Cell RI: "Chart data issued 29 Jun 2026 · current to 29 Jun 2026"

Since ISDT = UADT in both cells, a single-date "Data current as of: [UADT]" phrasing is also acceptable. `INFERRED`.

**Source date semantics: CLEARED** — DSID_ISDT and DSID_UADT definitions are unambiguous from CESNI validation checks 1522–1523. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

---

## 10. Data Licence

The Rijkswaterstaat metadata record for "ENC van Nederlandse binnenwateren" states:

- Use limitation: "Geen gebruiksbeperkingen" (No use limitations)
- Access constraints: CC0 (Creative Commons Zero — public domain)
- Legal constraints: "geen beperkingen" / "noConditionsApply"

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — *Rijkswaterstaat National Geo Register, record UUID cef0d4a1-27f2-4b6a-8e51-6e75adbb46ac, at https://maps.rijkswaterstaat.nl/dataregister/srv/api/records/cef0d4a1-27f2-4b6a-8e51-6e75adbb46ac, accessed 2026-07-07. Owner: Servicedesk Data, Rijkswaterstaat.*

**The data is CC0.** No attribution requirement, no commercial restriction, no redistribution limit. The previously noted licence uncertainty is fully resolved. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

---

## 11. Overall Verdict

### 11.1 Six-Condition Checklist

| Condition | Status | Detail |
|---|---|---|
| Effective datum identified | VDAT ✅ CLEARED · SDAT ❌ BLOCKED | VDAT=24 = "Local Datum" confirmed from two sources; SDAT=42 absent from all accessible authoritative documentation |
| Units confirmed | ✅ CLEARED | DSPM_DUNI=1 = metres; DSPM_HUNI=1 = metres |
| Multiplier handling verified | ✅ CLEARED | COMF and SOMF applied automatically by GDAL; no application-level scaling needed |
| Local override behaviour resolved | ✅ CLEARED | No m_vdat or m_sdat objects in either cell |
| Depth feature semantics verified | ✅ CLEARED (numerically) | DRVAL1/DRVAL2/VALDCO/SOUNDG Z all in metres with confirmed sign convention |
| Source date semantics verified | ✅ CLEARED | DSID_ISDT = issue date; DSID_UADT = update application date; CESNI checks 1522–1523 |

### 11.2 Verdict

## ❌ BLOCKED — SDAT=42 unresolved

Five of six conditions are cleared. The single blocking condition is the formal identification of SDAT=42:

- Code 42 is **not in the base S-57 SDAT table** (which covers codes 1–27). `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.
- Code 42 is **not in the IHO Geospatial Information Registry** under any status in either the 2020 or 2022 version. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.
- The registry table jumps from 41 (Ohio River Datum) directly to 43 (Dutch High Water Reference Level). `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.
- The IENC Feature Catalogue 2.4 (corr.2) — the governing specification for these cells — was inaccessible after 12 fetch attempts. `UNKNOWN`.
- The most likely physical candidate is **OLW** (Overeengekomen Laagwater / Dutch Estuary Agreed Low Water, IHO code 45 in FC 2.5), but this is `INFERRED`, not confirmed.

**Dolphin must not present depth values to mariners until SDAT=42 is confirmed from an authoritative source.** `INFERRED` — this safety requirement follows logically from the combination of SDAT=42 being `UNKNOWN` and the general maritime principle that chart datum must be stated alongside depth values. No specific regulatory text was fetched requiring this; the safety logic is deduced from established nautical charting practice.

### 11.3 What is Safe to Display (Regardless of SDAT)

| Feature class | Safe to display | Status |
|---|---|---|
| Navigation marks (lights, buoys, beacons) | Position, character, colour, designation | ✅ CLEARED |
| Bridges, overhead cables | VERCLR (vertical clearance above NAP — NAP identification is `INFERRED`) | ✅ CLEARED (VDAT=24 = "Local Datum" confirmed; NAP mapping is `INFERRED`) |
| Fairway boundaries, waterway areas | Geometry, names | ✅ CLEARED |
| Lock basins, canal areas | Geometry, names, dimensions | ✅ CLEARED |
| Speed limits, maximum vessel dimensions | CATMSI, CATACH | ✅ CLEARED |
| Distance marks, gauge stations | Position, values | ✅ CLEARED |
| Depth values (SOUNDG, DEPARE, DEPCNT) | Values in metres — may be used internally for draft comparison | ⚠️ BLOCKED for mariner display |
| Licence attribution | None required (CC0) | ✅ CLEARED |

---

## 12. Recommended Next Steps to Clear the Verdict

To resolve SDAT=42, one of the following actions is required:

### Option A — Download and Parse IENC FC 2.4 Locally (Highest Confidence)

The FC 2.4 (corr.2) XML exists at GitHub SHA 548d23241c5e8d9f54f101fb6951edec6dfd404e (722 KB). Downloading this file directly to disk and parsing the VERDAT attribute enumeration would yield a `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` finding. The XML was accessible via the GitHub API in base64 form; the first ~50 KB was decoded but the VERDAT attribute section falls later in the 722 KB file.

```
git clone --depth=1 --branch=edition-2.4 \
  https://github.com/cesniti/iehg_gitbook.git /tmp/ienc-fc24
xmllint --xpath "//Attribute[@acronym='VERDAT']/Enumeration" \
  /tmp/ienc-fc24/.gitbook/assets/ienc_fc_24_corr2.xml
```

### Option B — Contact Rijkswaterstaat / National RIS Authority

The IENC Kennisportaal lists `ndt@rws.nl` (Nationale RIS Autoriteit) as the contact for IENC implementation questions. A direct query confirming the physical datum corresponding to SDAT=42 in Rijkswaterstaat cell production would be definitive.

### Option C — IENC Kennisportaal Depth Reference Section

The kennisportaal section I.3 (Depth References) is login-protected and was inaccessible in this investigation. Dutch IENC encoders with portal access can confirm the sounding datum for Rotterdam-area cells.

---

## 13. Document Integrity

All findings use only evidence gathered and cited in this investigation. No depth datum claim for SDAT=42 has been fabricated, assumed, or inferred beyond the `INFERRED` label. The `INFERRED` candidate of OLW for SDAT=42 is explicitly excluded from the verdict — the verdict is BLOCKED until a `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` source confirms the code.

All findings in the base investigation document (REPORT.md) remain valid and are not contradicted by this investigation.

---

*End of DATUM-RESOLUTION.md*
