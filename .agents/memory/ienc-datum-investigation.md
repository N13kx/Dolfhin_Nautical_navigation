---
name: IENC Datum Investigation
description: Findings from forensic resolution of DSPM_VDAT=24 and DSPM_SDAT=42 in Dutch IENC cells used by Dolphin Navigation.
---

## Verdict: BLOCKED (SDAT=42 unresolved)

### VDAT=24 = "Local Datum" — CLEARED
- Confirmed from two independent official sources:
  1. S-57 Appendix B.1 Annex A, Ed 4.3.0 (October 2022), Table 2.1 — code 24 = "Local Datum"
  2. IHO Geospatial Information Registry, idx=1206, code 24
- For Dutch Rijkswaterstaat cells the physical local datum for heights = NAP (Normaal Amsterdams Peil). INFERRED — not stated in cell records explicitly.
- VDAT governs heights only (bridges, lights, cables), not depths.

### SDAT=42 — BLOCKED (UNKNOWN from all accessible sources)
- NOT in base S-57 SDAT table (S-57 Appendix B.1, Table 2.2; table ends at code 27)
- NOT in IHO Geospatial Information Registry in either 2020 or 2022 versions (registry jumps from 41=Ohio River Datum to 43=Dutch High Water Reference Level; code 42 is completely absent under all status filters)
- IENC Feature Catalogue 2.4 (corr.2) — the governing specification (DSID_PRED="2.4") — was inaccessible: PDF 504 timeouts, GitHub raw/CDN returned wrong 50 KB truncation, GitHub blob API returned first 50 KB of 722 KB file (VERDAT section unreached)
- Most likely physical candidate: OLW (Dutch Estuary Agreed Low Water, IHO code 45 in FC 2.5). INFERRED for Rotterdam estuarine cells. Must not be used as basis for display.

**Why:** Displaying depths under an unidentified sounding datum could endanger navigation. No mariner-facing depth labels until SDAT=42 is confirmed.

**How to apply:** Block any Dolphin depth display feature until SDAT=42 is resolved from an authoritative source.

### To resolve SDAT=42:
- Option A (best): Clone cesniti/iehg_gitbook branch edition-2.4 locally; parse VERDAT attribute enumeration with xmllint
  ```
  git clone --depth=1 --branch=edition-2.4 https://github.com/cesniti/iehg_gitbook.git /tmp/ienc-fc24
  xmllint --xpath "//Attribute[@acronym='VERDAT']/Enumeration" /tmp/ienc-fc24/.gitbook/assets/ienc_fc_24_corr2.xml
  ```
- Option B: Contact Rijkswaterstaat at ndt@rws.nl (Nationale RIS Autoriteit)
- Option C: Access IENC Kennisportaal section I.3 (login-protected)

### Other confirmed facts:
- No m_vdat or m_sdat spatial override objects in either cell (GDAL layer grep confirmed)
- CC0 licence — Rijkswaterstaat data is unrestricted (UUID cef0d4a1-27f2-4b6a-8e51-6e75adbb46ac)
- DSPM_DUNI=1 → metres; COMF=10,000,000 / SOMF=10 → GDAL applies automatically (no app-layer scaling)
- GDAL Z-sign: negative = below datum (navigable), positive = above datum (shoal/dry)
- RI cell SOUNDG Z-values are all positive (0.9–10.0 m) — features above sounding datum, NOT navigable depths
- DSID_ISDT = issue date; DSID_UADT = update application date (CESNI checks 1522–1523)
- DSID_COMT = "STED:3.1.1" — S-57 Edition 3.1.1 marker (IENC encoding convention, INFERRED)
- Deliverable: nautical-investigation/DATUM-RESOLUTION.md (forensic document with four-label evidence model)
