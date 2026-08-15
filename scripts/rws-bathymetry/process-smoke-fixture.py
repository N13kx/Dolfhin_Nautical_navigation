#!/usr/bin/env python3
"""Validate a bounded RWS float32 GeoTIFF and build its transparent portrayal."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

NODATA = np.float32(3.3999999521443642e38)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


def ramp(t: np.ndarray) -> np.ndarray:
    """Cyan-to-magenta ramp intentionally distinct from IENC portrayal."""
    stops = np.array([[18, 231, 210], [45, 126, 232], [196, 70, 220]], dtype=np.float32)
    scaled = np.clip(t, 0.0, 1.0) * 2
    index = np.minimum(scaled.astype(np.int32), 1)
    fraction = (scaled - index)[..., None]
    return (stops[index] * (1 - fraction) + stops[index + 1] * fraction).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('png', type=Path)
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args()

    with Image.open(args.source) as image:
        if image.mode != 'F' or image.size != (100, 100):
            raise SystemExit(f'expected 100x100 float32 TIFF, got {image.size} {image.mode}')
        values = np.asarray(image, dtype=np.float32)

    valid_mask = values != NODATA
    valid = values[valid_mask]
    if valid.size == 0 or np.any(~np.isfinite(valid)):
        raise SystemExit('source contains no valid finite pixels')
    if np.any(valid >= 0):
        raise SystemExit('unexpected non-negative value in the audited fixture')

    minimum = np.float32(valid.min())
    maximum = np.float32(valid.max())
    normalized = np.zeros(values.shape, dtype=np.float32)
    normalized[valid_mask] = (values[valid_mask] - minimum) / (maximum - minimum)

    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[..., :3] = ramp(normalized)
    rgba[..., 3] = np.where(valid_mask, 210, 0).astype(np.uint8)
    args.png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(args.png, optimize=True)

    processed_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    manifest = {
        'task': 'DOL-021d',
        'status': 'IMPLEMENTED_NOT_MANUALLY_TESTED',
        'publisher': 'Rijkswaterstaat',
        'dataset': 'Bathymetrie Nederland – binnenwateren 1 m, January 2026',
        'sourceCategory': 'B_MEASURED_BATHYMETRY',
        'horizontalCRS': 'EPSG:28992',
        'verticalReference': 'NAP / EPSG:5709',
        'units': 'metres relative to NAP',
        'sourceUrl': 'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_1mtr_historie/wcs',
        'coverageId': 'bodemhoogte_1mtr_historie__bodemhoogte_1mtr_202601',
        'request': {
            'service': 'WCS', 'version': '2.0.1', 'format': 'image/tiff',
            'subset': {'x': [80000, 80100], 'y': [407000, 407100]},
        },
        'sourceBBox': {'crs': 'EPSG:28992', 'west': 80000, 'south': 407000, 'east': 80100, 'north': 407100},
        'raster': {
            'width': 100, 'height': 100, 'pixelSize': [1, -1], 'dataType': 'float32',
            'noDataValue': float(NODATA), 'validPixels': int(valid.size),
            'noDataPixels': int(values.size - valid.size), 'minValid': float(minimum),
            'maxValid': float(maximum), 'negativeValid': int(np.count_nonzero(valid < 0)),
            'zeroValid': int(np.count_nonzero(valid == 0)), 'positiveValid': int(np.count_nonzero(valid > 0)),
        },
        'semantics': {'signedValuesPreserved': True, 'absoluteValueApplied': False, 'signInverted': False, 'derived': False, 'navigationSuitable': False},
        'noDataHandling': 'source NoData pixels become fully transparent display pixels',
        'datasetSnapshotDate': '2026-01-01',
        'measurementDate': None,
        'measurementDateStatus': 'UNKNOWN',
        'fetchedProcessedAt': processed_at,
        'artifacts': {'sourceGeoTiffSha256': sha256(args.source), 'displayPngSha256': sha256(args.png)},
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
