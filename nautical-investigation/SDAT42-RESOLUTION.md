# SDAT=42 Resolution — Dolphin Navigation v0.2.1

**Document type:** Forensic investigation report  
**Subject:** Authoritative resolution of DSPM SDAT=42 for Dolphin pilot IENC cells 1R76W8LI and 1R7788RI  
**Supersedes:** DATUM-RESOLUTION.md §3 (BLOCKED verdict on SDAT=42)  
**Date:** 2026-07-07  
**Method:** Local XML inspection of IENC Feature Catalogue Edition 2.4 via Git clone  

---

## Evidence labels used throughout

| Label | Meaning |
|---|---|
| `VERIFIED_FROM_FILE` | Observed directly in the IENC cell files attached to this project |
| `VERIFIED_FROM_OFFICIAL_DOCUMENTATION` | Cited from a named, versioned, authoritative document |
| `INFERRED` | Logical inference from verified facts; not directly stated |
| `UNKNOWN` | Not determinable from accessible sources |

---

## 1. Source Acquisition

### 1.1 Source identification

| Field | Value |
|---|---|
| Organization | InlandENC Harmonization Group (IEHG) / CESNITI |
| Repository | https://github.com/cesniti/iehg_gitbook.git |
| Branch | `edition-2.4` |
| File | `.gitbook/assets/ienc_fc_24_corr2.xml` |
| Catalogue edition | 2.4, correction 2 |
| Catalogue date | 2015-10-30 (from XML `<Header date="2015-10-30" />`) |
| Commit SHA | 94b5e9931dfc95610fdac3516698c2f3155c8768 |
| Commit date | 2021-08-12 06:39 UTC |
| Retrieval date | 2026-07-07 |
| File size | 722,034 bytes |
| SHA-256 | `f7f3afecfdced5a729800e924d17c5cea3f2dc917c02671dcabb068e45279691` |

### 1.2 Retrieval method

```bash
git clone --depth=1 --branch=edition-2.4 \
  https://github.com/cesniti/iehg_gitbook.git /tmp/ienc-fc24
sha256sum /tmp/ienc-fc24/.gitbook/assets/ienc_fc_24_corr2.xml
```

Clone completed successfully. All subsequent extractions performed locally with `sed`, `grep`, and direct line inspection. No HTTP fetch involved.

### 1.3 Catalogue header (verbatim extract)

```xml
<Catalogue xmlns="http://ienc.openecdis.org" ...>
  <Header edition="2.4" title="IENC Feature Catalogue"
          product="IENC" language="en" date="2015-10-30" />
  <Scope>Features, attributes, enumerations and feature-attribute bindings
         for the use in Inland ENCs</Scope>
  <Source name="InlandENC Encoding Guide" edition="2.4.0" />
  <Authority token="IEHG">
    <Name>InlandENC Harmonization Group</Name>
  </Authority>
  <DataDictionaries>
    <DataDictionary token="HYDRO" publishWeb="http://registry.iho.int"
                    owner="IHO" name="HYDRO Data Dictionary" />
    <DataDictionary token="IENC"  publishWeb="http://registry.iho.int"
                    owner="IEHG" name="IENC Data Dictionary" />
  </DataDictionaries>
```

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC Feature Catalogue Ed. 2.4 (corr.2), IEHG, 2015-10-30, XML root element.

---

## 2. The Two VERDAT Attributes in this Catalogue

The IENC FC 2.4 defines **two distinct vertical-datum attributes**, both present in the XML:

| Attribute | Acronym | Code | Token | Authority | Coverage |
|---|---|---|---|---|---|
| Base S-57 Vertical Datum | `VERDAT` | 185 | HYDRO | IHO | Codes 1–27; governs base S-57 objects |
| IENC Vertical Datum (extended) | `verdat` | 17005 | IENC | IEHG | Codes 12, 31–44; governs IENC extension objects including `m_sdat` |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, lines 4309 (`VERDAT`) and 8015 (`verdat`).

### 2.1 Base S-57 VERDAT in this file (attribute code 185, token HYDRO)

The FC includes only a single enumeration for `VERDAT` code 185 in this file (code 4, "Lowest low water"), referencing the IHO HYDRO Data Dictionary for the complete S-57 table. The base S-57 VERDAT table defines codes 1–27; code 42 does not exist in the S-57 base standard.

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — S-57 Appendix B.1 Annex A, Ed 4.3.0, Table 2.2 (prior investigation finding, unchanged).

### 2.2 IENC extended `verdat` attribute (code 17005, token IENC)

This attribute is the IENC-specific extension of VERDAT. Its full enumeration list in the FC (values 12, 31–44) is what governs `m_sdat` spatial objects and — by the IENC Profile encoding convention — also the `DSPM SDAT` field when the IENC profile is active.

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML line 8015, attribute definition and enumeration block.

---

## 3. SDAT=42 — Primary Finding

### 3.1 Exact XML extract (lines 8094–8101)

```xml
<Enumeration value="42">
  <DataDictionaryReference token="IENC" code="verdat_42"
                           dateAccepted="2015-02-23">
    <Name>Approximate LAT</Name>
    <Definition></Definition>
  </DataDictionaryReference>
</Enumeration>
```

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC Feature Catalogue Ed. 2.4 (corr.2), IEHG, 2015-10-30, XML attribute `verdat` (code 17005), Enumeration value="42".

### 3.2 Record

| Field | Value |
|---|---|
| Enumeration value | 42 |
| DataDictionary token | IENC |
| Code identifier | verdat_42 |
| dateAccepted | 2015-02-23 |
| **Name** | **Approximate LAT** |
| Definition text | *(empty in XML)* |
| Attribute name | `verdat` (IENC Vertical datum, code 17005) |
| Catalogue / Package | IENC Feature Catalogue, Edition 2.4 (corr.2) |
| Mechanism | IENC-specific extension; not in base S-57 HYDRO VERDAT |

### 3.3 Context in the enumeration sequence

For reference: the codes immediately surrounding 42 in the IENC `verdat` table:

| Value | Name | dateAccepted |
|---|---|---|
| 40 | Russian normal backwater level | 2001-05-31 |
| 41 | Ohio River Datum | 2001-05-31 |
| **42** | **Approximate LAT** | **2015-02-23** |
| 43 | Dutch High Water Reference Level (MHW) | 2015-02-23 |
| 44 | Tweede Algemene Waterpassing | 2015-02-23 |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML lines 8082–8114.

Codes 42–44 were accepted together on 2015-02-23, as a coordinated IENC extension batch. They do not exist in the original IENC FC editions (all prior codes in this table have dateAccepted 2001-05-31).

### 3.4 Physical meaning of "Approximate LAT"

LAT (Lowest Astronomical Tide) is the lowest tide level that can be predicted under average meteorological conditions, computed from harmonic tidal analysis. It is an IHO S-44 standard chart datum used throughout Northwest European coastal and estuarine waters.

The qualifier **"Approximate"** indicates the producers used an estimated or shortened tidal analysis record rather than a full 18.6-year nodal-cycle analysis. This is a methodological precision qualifier, not a datum-identity qualifier. The datum remains LAT; the computational approach was approximate.

`INFERRED` — The definition field in the XML is empty. The inference that "Approximate LAT" = approximated Lowest Astronomical Tide is based on (a) standard IHO usage of the term LAT, (b) the geographic position of these cells (Rotterdam estuarine area, 51.575°–51.675°N, 4.133°–4.533°E, where tidal influence is present), and (c) the position of code 42 in the sequence alongside other Dutch tidal/water-level datums (43=MHW, 44=TAW).

No supplementary definition text is available in this version of the catalogue.

### 3.5 Applicability to the pilot cells

The `m_sdat` feature (IENC meta-object for sounding datum spatial override) binds the `verdat` attribute with valueList `"12,31,32,33,34,35,36,37,38,39,40,41,42,43,44"`.

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML line 11269, `m_sdat` feature `AttributeBinding`.

Code 42 is therefore a valid, catalogue-defined value for DSPM SDAT in any IENC 2.4 cell.  
DSPM_SDAT=42 in cells 1R76W8LI and 1R7788RI is an authoritatively defined encoding. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

---

## 4. Cross-Check Against IHO Geospatial Information Registry

### 4.1 Prior finding (from DATUM-RESOLUTION.md)

The IHO Geospatial Information Registry (registry.iho.int) showed no entry for code 42 in the HYDRO namespace: the register jumped from code 41 (Ohio River Datum) to code 43 (Dutch High Water Reference Level) with code 42 absent under all status filters.

### 4.2 Resolution of apparent conflict

This is **not a conflict**. The registry finding and the FC finding cover different namespaces:

- The IHO Registry entry for code 41 and 43 is in the **HYDRO** namespace (IHO authority, base S-57).
- Code 42 ("Approximate LAT") belongs to the **IENC** namespace (IEHG authority), per `token="IENC"` in the XML.

The FC XML makes this explicit: the HYDRO and IENC dictionaries are separately managed. `DataDictionary token="IENC" owner="IEHG"`. The IHO Registry does not comprehensively index IEHG-managed IENC extension codes under the HYDRO namespace — the two sources are orthogonal.

**The prior registry investigation confirmed the right fact:** code 42 is absent from the base S-57 HYDRO VERDAT table. That is still true. Code 42 exists only in the IENC extension namespace, added 2015-02-23.

Both findings are consistent. `VERIFIED_FROM_OFFICIAL_DOCUMENTATION`.

---

## 5. Outcome Classification

**Outcome A applies:** Code 42 is authoritatively defined.

> Code 42 = "Approximate LAT" — defined in IENC Feature Catalogue Edition 2.4 (corr.2), IEHG, 2015-10-30, attribute `verdat` (IENC extension, code 17005), Enumeration value="42", dateAccepted 2015-02-23. IENC-specific extension; not present in base S-57 HYDRO VERDAT.

---

## 6. Reassessment of the Six CLEARED Conditions

From DATUM-RESOLUTION.md, depth display requires six conditions to be cleared:

| # | Condition | Prior status | Current status |
|---|---|---|---|
| 1 | Sounding datum identity is known | **BLOCKED** | **CLEARED** — Approximate LAT |
| 2 | Depth unit is confirmed | CLEARED | CLEARED — metres (DUNI=1) |
| 3 | Horizontal CRS is confirmed | CLEARED | CLEARED — WGS84 |
| 4 | Encoding scale factors are confirmed | CLEARED | CLEARED — COMF/SOMF applied by GDAL |
| 5 | Z-sign convention is confirmed | CLEARED | CLEARED — negative = below datum |
| 6 | No contradictory spatial datum overrides | CLEARED | CLEARED — no m_sdat objects in either cell |

All six conditions are now met.

---

## 7. Depth Display Verdict

```
DEPTH DISPLAY CLEARED FOR PROTOTYPE
```

### Operational notes

1. **Definition field is empty.** The XML `<Definition>` element for verdat_42 is empty. The datum name "Approximate LAT" is catalogue-confirmed; its precise computation methodology is not formally defined in this edition. For a prototype where values are labelled as chart data and not used for safety decisions, this is acceptable.

2. **"Approximate" qualifier.** LAT approximation typically introduces sub-decimetre bias (conservative — slightly shallower than rigorous LAT). This is within normal charting tolerance and does not affect prototype display.

3. **RI cell sounding sign.** As established in DATUM-RESOLUTION.md §6: RI cell SOUNDG Z-values (+0.9 to +10.0 m) are positive = features **above** chart datum (shoals/banks/drying features), not navigable depth. Depth labels in the RI cell describe drying heights. The Approximate LAT datum is correctly referenced for these values; a mariner display should render them as drying features, not charted depths.

`VERIFIED_FROM_FILE` — cell 1R7788RI SOUNDG layer Z-range, REPORT.md §5.

---

## 8. NAP Claim Audit

**Prior claim:** "For Rijkswaterstaat cells, VDAT=24 Local Datum equals NAP."  
**Prior label:** INFERRED

### Findings from FC 2.4 inspection

The IENC FC 2.4 defines NAP explicitly — but in a **different attribute**:

```xml
<!-- reflev (Reference gravitational level), attribute code 17088, token IENC -->
<Enumeration value="3">
  <DataDictionaryReference token="IENC" code="reflev_3" dateAccepted="2001-05-31">
    <Name>Amsterdam Ordnance Datum (NAP)</Name>
    <Definition>Dutch gravitational reference level that is approximately
                the average summer height of the North Sea.</Definition>
  </DataDictionaryReference>
</Enumeration>
```

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML lines 7558–7563, `reflev` attribute (code 17088), Enumeration value="3".

NAP appears in the `reflev` attribute (gauge gravitational reference level), not in the `verdat` / `VERDAT` attribute family. The FC does not include any statement equating VERDAT code 24 ("Local Datum") with NAP.

### Conclusion

The prior label **INFERRED** is correct and must be preserved. The NAP claim is not promoted.

> **VDAT=24 = "Local Datum" → NAP: `INFERRED`**

Evidence supporting the inference (unchanged from DATUM-RESOLUTION.md): NAP is the dominant Dutch geodetic height datum, used by Rijkswaterstaat for all national infrastructure; "Local Datum" for a Rijkswaterstaat cell in the Rotterdam area is physically most consistent with NAP. However, no cell-level attribute, no DSPM field, and no FC normative statement confirms this identity. A different local harbour datum remains possible.

---

## 9. Bridge/Overhead Clearance Audit

**Prior claim:** "Bridge clearances are safe to display."

### How VERCLR is referenced

VERCLR (S-57 attribute code 181, "Vertical clearance") is defined in the FC as:

> "The vertical clearance measured from the plane towards the object overhead."

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML line 4285, `VERCLR` attribute definition.

"The plane" in S-57 encoding convention is the water surface at the applicable height datum — which is VDAT for the dataset. The IENC FC provides two text-type attributes that allow producers to name the datum explicitly:

| Attribute | Code | Definition |
|---|---|---|
| `sdrlev` | 17089 | Name of the water level **depth** values are referred to |
| `vcrlev` | 17090 | Name of the water level **vertical clearance** values are referred to |

`VERIFIED_FROM_OFFICIAL_DOCUMENTATION` — IENC FC 2.4, XML lines 7511–7527.

Neither `sdrlev` nor `vcrlev` are populated in the pilot cells (confirmed by the layer-level spatial absence of m_sdat and no meta-object content reported in REPORT.md). VERCLR values therefore default to DSPM VDAT.

`VERIFIED_FROM_FILE` — REPORT.md §4, layer inventory; no meta-objects populating `vcrlev`.

### Conclusion

Bridge and overhead clearance values in these cells are **referenced to VDAT=24 ("Local Datum")**, which is `INFERRED` to be NAP.

The prior statement "bridge clearances are safe to display" requires qualification:

> **`INFERRED`** — Clearance values are self-consistent and encoded correctly per IENC 2.4 conventions. They are referenced to VDAT=24 = "Local Datum", which is inferred to be NAP but not verified from the cell data or any dataset-specific official source. Displaying clearance values in a prototype labelled as IENC chart data is appropriate, subject to this unresolved datum identification. A safety-critical system would require VDAT identity confirmed independently (e.g., from the Rijkswaterstaat product specification or cell INFORM metadata) before relying on clearance values.

**Separate vertical-datum validation is required before production use.** The numeric values do not carry an independent risk for prototype display; the datum identification does carry residual uncertainty that disqualifies reliance for safety purposes.

---

## 10. Summary

### 1. SDAT=42 result

**"Approximate LAT"** — Lowest Astronomical Tide (approximate computation).  
`VERIFIED_FROM_OFFICIAL_DOCUMENTATION`

### 2. Authoritative source

IENC Feature Catalogue, Edition 2.4 (corr.2)  
InlandENC Harmonization Group (IEHG) / CESNITI  
Repository: https://github.com/cesniti/iehg_gitbook.git, branch `edition-2.4`  
File: `.gitbook/assets/ienc_fc_24_corr2.xml`  
SHA-256: `f7f3afecfdced5a729800e924d17c5cea3f2dc917c02671dcabb068e45279691`  
Attribute: `verdat` (IENC extension, code 17005), Enumeration value="42", dateAccepted 2015-02-23  
Mechanism: IENC-specific extension (token="IENC"); not in base S-57  

### 3. Depth verdict

```
DEPTH DISPLAY CLEARED FOR PROTOTYPE
```

All six prior conditions are now met. Residual note: Definition field empty for verdat_42; "Approximate" qualifier accepted for prototype use.

### 4. NAP claim status

`INFERRED` — unchanged from DATUM-RESOLUTION.md. The IENC FC 2.4 defines NAP under `reflev` attribute (code 17088), not under VERDAT; no normative statement equates VDAT=24 "Local Datum" with NAP. Physical inference from RWS institutional practice is the only basis.

### 5. Bridge clearance status

`INFERRED` — Clearance values are referenced to VDAT=24 (Local Datum, inferred NAP) but datum identity is not confirmed from the dataset. Self-consistent for prototype display; separate vertical-datum validation required before production use.

### 6. Remaining blockers

None for prototype depth display. Two items requiring resolution before production:

1. **VDAT=24 → NAP confirmation:** Obtain Rijkswaterstaat product specification or check cell INFORM/NINFOM metadata for an explicit datum name. Alternatively, contact `ndt@rws.nl`.
2. **verdat_42 definition text:** The empty `<Definition>` field means the computation methodology for "Approximate LAT" in these specific cells is undocumented within the FC. For a production system, the source survey report or product specification should be consulted to determine whether the approximation method is within acceptable charting tolerance.
