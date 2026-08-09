# IENC Map Integration — Acceptance Test Log

**Task:** v0.2.1b: IENC Map Integration  
**Pipeline run:** 2026-07-07T08:44:07Z-0af461ad  
**Pilot cells:** 1R76W8LI (ed.78, Hollandsch Diep) · 1R7788RI (ed.46, Haringvliet)  
**Depth datum:** Approximate LAT (SDAT=42, VERIFIED_FROM_OFFICIAL_DOCUMENTATION)  
**Vertical datum:** Local Datum (VDAT=24, NAP identity UNVERIFIED)

---

## TOPMAR Rendering Decision

**Inspection result (2026-08-09):**

All 15 TOPMAR features carry `associationRefsVerifiedInGdalOutput: false`. GDAL
3.2.2's S-57 driver did not expose FFPT parent-association records (LNAM_REFS,
FFPT_RIND) in the decoded GeoJSON output.

Proximity analysis:
- 11/15 TOPMARs: co-located at distance 0 with a parent buoy or beacon (e.g.
  TOPMAR 2 at [4.3654, 51.6625] shares coords with BOYLAT `1F2B10F38C950001`)
- 4/15 TOPMARs: spatially detached (≥0.002° ≈ 200 m) from nearest mark —
  no reliable spatial association available

**Decision: TOPMAR rendering DEFERRED.**

Reason: Association semantics are unresolved. The GDAL output does not expose
any S-57 FFPT parent-association records, so it cannot be confirmed which buoy
or beacon each TOPMAR belongs to. While the 11 co-located cases appear safe,
the 4 detached cases are not, and applying inconsistent rules across the same
class would introduce ambiguity. Per the decision rule in the Task #8 brief,
all 15 TOPMAR features are excluded from the nav-marks MapLibre layer via a
filter expression: `["!=", ["get", "dolphinKind"], "topmark"]`.

TOPMARs remain in `navigation-marks.geojson` and pass validation. Only map
display is suppressed.

**Revisit condition:** When GDAL exposes FFPT records (future GDAL version or
alternative S-57 reader), re-run the pipeline and re-inspect association refs.
If `associationRefsVerifiedInGdalOutput: true` for all features, standalone
rendering may proceed with a code comment documenting the caveat.

---

## Feature Counts (validated, 72/72 checks)

| File | Features |
|------|----------|
| navigation-marks.geojson | 72 (BCNSPP 1, BOYLAT 42, BOYSPP 4, LIGHTS 10, TOPMAR 15) |
| depth-areas.geojson | 925 |
| depth-contours.geojson | 918 |
| soundings.geojson | 2084 (above: 1612, below: 468, at: 4) |

---

## Mode Visibility Matrix

| Layer group | Dolphin Nav | Satellite | Hybrid |
|-------------|:-----------:|:---------:|:------:|
| IENC nav marks | ON (default) | — | ON (default) |
| IENC charted depths | ON (default) | — | ON (default) |
| Community seamarks (OpenSeaMap) | — | — | OFF (default; user toggle) |

Satellite mode: no IENC sources loaded; map clean.

---

## Acceptance Test Checklist

> Populate each item during manual device verification.

### Mode visibility

- [ ] **Dolphin Nav:** IENC nav marks visible; charted depth areas visible
- [ ] **Satellite:** Map clean — no IENC marks, no depths, no OpenSeaMap
- [ ] **Hybrid:** IENC nav marks visible; charted depths visible; OpenSeaMap absent by default

### Mode switching (no black map)

- [ ] **Satellite → Hybrid:** IENC layers appear without `setStyle` (no black map flash)
- [ ] **Hybrid → Satellite:** IENC layers hidden; OpenSeaMap hidden
- [ ] **Dolphin → Hybrid:** Transition via setStyle; IENC layers appear in Hybrid
- [ ] **Hybrid → Satellite → Hybrid:** Correct every time

### Rapid switching stress test

- [ ] **20 mode-switch cycles** (Dolphin → Satellite → Hybrid → Dolphin → …):
  no duplicate sources, no missing overlays, no black map, no stale layers

### Layer toggle persistence

- [ ] Toggle **Nav marks OFF** in Dolphin → switch to Satellite → switch back to Dolphin:
  Nav marks still OFF
- [ ] Toggle **Charted depths OFF** in Hybrid → switch away → return: still OFF

### Tap / feature inspection

- [ ] Tap nav mark → NauticalObjectSheet opens with correct dolphinKind label,
  sourceStableId (or "—" if null), datum row "Approximate LAT" + verified badge,
  issueDate from manifest (or "—"), updateApplicationDate from manifest (or "—"),
  "Geen realtime waterdiepte" disclaimer
- [ ] Tap depth area → sheet shows DRVAL1/DRVAL2 depth range and "Approximate LAT"
- [ ] Tap sounding **"above"** → "Drooghoogte: X.X m boven kaartdatum"
- [ ] Tap sounding **"below"** → "Gepeilde diepte: X.X m onder Approximate LAT"
- [ ] Tap sounding **"at"** → "Op kaartdatum: 0,0 m"
- [ ] Tap elsewhere → sheet closes (or does not open)

### TOPMAR

- [ ] **TOPMAR deferred** — no topmark circles visible in any mode
  (15 TOPMAR features present in data, excluded by MapLibre filter)
- [ ] Reason documented: `associationRefsVerifiedInGdalOutput: false` on all 15;
  4/15 spatially detached from nearest mark (see decision above)

### Existing features unaffected

- [ ] GPS tracking continues to function throughout all mode switches
- [ ] Settings screen opens and closes correctly
- [ ] Vessel profile is editable in Settings
- [ ] Search (PDOK) returns results and flies to location
- [ ] Locate button cycles free → follow → courseUp → free

---

## Sign-off

| Item | Status | Notes |
|------|--------|-------|
| TypeScript `tsc --noEmit` | — | |
| `vite build` | — | |
| Rapid 20-cycle test | — | |
| iPhone device test | — | |
| TOPMAR decision documented | ✓ | See above |
