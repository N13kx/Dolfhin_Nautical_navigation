# DOL-021d RWS bottom-elevation smoke fixture

This is a deliberately tiny, experimental **measured bottom-elevation** fixture.
It is separate from IENC `SOUNDG`/`DEPARE` data and is not water depth,
charted depth, or safe depth.

## Source request

- Publisher: Rijkswaterstaat
- Dataset: Bathymetrie Nederland – binnenwateren 1 m, January 2026
- Coverage ID: `bodemhoogte_1mtr_historie__bodemhoogte_1mtr_202601`
- Endpoint: `https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_1mtr_historie/wcs`
- WCS: `2.0.1`
- Subset: `X(80000,80100)`, `Y(407000,407100)`
- Format: `image/tiff`
- Horizontal CRS: `EPSG:28992` (RD New)
- Vertical reference: `NAP / EPSG:5709`
- Units: metres relative to NAP
- Dataset snapshot date: `2026-01-01`
- Per-cell measurement date: `UNKNOWN` (`null` in the manifest)

Exact request parameters and processing results are recorded in
`rws-bottom-elevation-202601-smoke.json`.

## Artifacts

- `rws-bottom-elevation-202601-smoke.tif`: original bounded float32 WCS response;
  signed source values are unchanged.
- `artifacts/dolphin/public/rws-bathymetry/rws-bottom-elevation-202601-smoke.png`:
  transparent RGBA portrayal generated one-for-one from the 100×100 source grid.
  NoData pixels are fully transparent. Valid pixels use a fixed sequential colour
  ramp over the recorded source min/max. No numeric depth values are fabricated.

The GeoTIFF is retained because it is only about 144 KB and provides exact
pixel-level traceability for the display fixture. No national or regional bulk
dataset is included.

## Runtime gate

The overlay is absent unless the application is built with:

```text
VITE_RWS_BATHYMETRY_EXPERIMENT=1
```

Even when compiled in, it is a separate MapLibre image source and layer group.
It never enters the IENC source, portrayal, click handling, or datum semantics.
