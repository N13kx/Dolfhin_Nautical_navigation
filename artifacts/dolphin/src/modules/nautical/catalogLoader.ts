import type { GeoJSONSource, LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';

export const IENC_DATASET_NAMES = [
  'navigation-marks',
  'depth-areas',
  'depth-contours',
  'soundings',
] as const;

export type IencDatasetName = (typeof IENC_DATASET_NAMES)[number];

export interface IencCellBbox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface IencCatalogCell {
  cellId: string;
  sourceSha256: string;
  pipelineRunId: string;
  validatedAt: string;
  validationStatus: 'PASS';
  edition: string;
  issueDate: string | null;
  updateApplicationDate: string | null;
  producer: string | number;
  vdat: number;
  sdat: number;
  depthDatum: string;
  depthDatumStatus: string;
  bbox: IencCellBbox;
  featureCounts: Record<IencDatasetName, number>;
  files: Record<IencDatasetName, string>;
}

export interface IencCatalog {
  catalogVersion: 1;
  builtAt: string;
  totalCells: number;
  passCells: number;
  failCells: number;
  depthDatum: string;
  depthDatumStatus: string;
  napIdentityStatus: string;
  disclaimers: string[];
  cells: IencCatalogCell[];
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

export const EMPTY_FEATURE_COLLECTION: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export const IENC_SOURCE_IDS: Record<IencDatasetName, string> = {
  'navigation-marks': 'ienc-nav-marks-source',
  'depth-areas': 'ienc-depth-areas-source',
  'depth-contours': 'ienc-depth-contours-source',
  soundings: 'ienc-soundings-source',
};

/**
 * SOUNDG is by far the largest per-cell dataset in Zeeland. Loading every
 * sounding for every cell intersecting a broad viewport overwhelms mobile
 * Safari long before individual labels are useful. Keep the validated data
 * untouched on disk, but only fetch/merge it once the user is close enough
 * for detailed depth inspection.
 */
export const IENC_SOUNDINGS_LOAD_MIN_ZOOM = 13;

let catalogCache: IencCatalog | null = null;
let catalogInFlight: Promise<IencCatalog> | null = null;
const datasetCache = new Map<string, GeoJsonFeatureCollection>();
const datasetInFlight = new Map<string, Promise<GeoJsonFeatureCollection>>();

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateCatalog(value: unknown): IencCatalog {
  if (!value || typeof value !== 'object') throw new Error('[IENC] Catalog is not an object');
  const catalog = value as Partial<IencCatalog>;
  if (catalog.catalogVersion !== 1) {
    throw new Error(`[IENC] Unsupported catalogVersion ${String(catalog.catalogVersion)} (expected 1)`);
  }
  if (!Array.isArray(catalog.cells)) throw new Error('[IENC] Catalog cells must be an array');
  if (catalog.cells.some((cell) => cell.validationStatus !== 'PASS')) {
    throw new Error('[IENC] Catalog contains a cell whose validationStatus is not PASS');
  }
  if (catalog.totalCells !== catalog.cells.length || catalog.passCells !== catalog.cells.length || catalog.failCells !== 0) {
    throw new Error('[IENC] Catalog cell totals are inconsistent with an all-PASS publication');
  }

  const ids = new Set<string>();
  for (const cell of catalog.cells) {
    if (!cell.cellId || ids.has(cell.cellId)) throw new Error('[IENC] Catalog has a missing or duplicate cellId');
    ids.add(cell.cellId);
    if (!/^[a-f0-9]{64}$/i.test(cell.sourceSha256) || !cell.pipelineRunId) {
      throw new Error(`[IENC] Cell ${cell.cellId} is missing valid source provenance`);
    }
    const bbox = cell.bbox;
    if (!bbox || !finiteNumber(bbox.minLon) || !finiteNumber(bbox.minLat) ||
        !finiteNumber(bbox.maxLon) || !finiteNumber(bbox.maxLat) ||
        bbox.minLon > bbox.maxLon || bbox.minLat > bbox.maxLat) {
      throw new Error(`[IENC] Cell ${cell.cellId} has an invalid bbox`);
    }
    for (const dataset of IENC_DATASET_NAMES) {
      const file = cell.files?.[dataset];
      if (typeof file !== 'string' || !file.endsWith(`${dataset}.geojson`) || file.startsWith('/') || file.includes('..')) {
        throw new Error(`[IENC] Cell ${cell.cellId} has an invalid ${dataset} file reference`);
      }
      if (!Number.isInteger(cell.featureCounts?.[dataset]) || cell.featureCounts[dataset] < 0) {
        throw new Error(`[IENC] Cell ${cell.cellId} has an invalid ${dataset} feature count`);
      }
    }
  }
  return catalog as IencCatalog;
}

export function loadIencCatalog(baseUrl: string = import.meta.env.BASE_URL): Promise<IencCatalog> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogInFlight) return catalogInFlight;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  catalogInFlight = fetch(`${base}nautical/catalog.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`[IENC] Catalog fetch failed: HTTP ${response.status}`);
      const catalog = validateCatalog(await response.json());
      catalogCache = catalog;
      return catalog;
    })
    .catch((error) => {
      catalogInFlight = null;
      throw error;
    });
  return catalogInFlight;
}

export function cellsIntersectingBbox(catalog: IencCatalog, bbox: IencCellBbox): IencCatalogCell[] {
  return catalog.cells.filter((cell) =>
    cell.bbox.minLon <= bbox.maxLon && cell.bbox.maxLon >= bbox.minLon &&
    cell.bbox.minLat <= bbox.maxLat && cell.bbox.maxLat >= bbox.minLat
  );
}

function mapBoundsToBbox(bounds: LngLatBounds): IencCellBbox {
  return {
    minLon: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLon: bounds.getEast(),
    maxLat: bounds.getNorth(),
  };
}

function validateFeatureCollection(value: unknown, cellId: string, dataset: IencDatasetName): GeoJsonFeatureCollection {
  if (!value || typeof value !== 'object' ||
      (value as GeoJsonFeatureCollection).type !== 'FeatureCollection' ||
      !Array.isArray((value as GeoJsonFeatureCollection).features)) {
    throw new Error(`[IENC] ${cellId}/${dataset} is not a GeoJSON FeatureCollection`);
  }
  return value as GeoJsonFeatureCollection;
}

function loadCellDataset(
  cell: IencCatalogCell,
  dataset: IencDatasetName,
  baseUrl: string
): Promise<GeoJsonFeatureCollection> {
  const key = `${cell.cellId}/${dataset}`;
  const cached = datasetCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = datasetInFlight.get(key);
  if (pending) return pending;

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const request = fetch(`${base}nautical/${cell.files[dataset]}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`[IENC] ${key} fetch failed: HTTP ${response.status}`);
      const data = validateFeatureCollection(await response.json(), cell.cellId, dataset);
      if (data.features.length !== cell.featureCounts[dataset]) {
        throw new Error(
          `[IENC] ${key} feature count mismatch: got ${data.features.length}, expected ${cell.featureCounts[dataset]}`
        );
      }
      datasetCache.set(key, data);
      return data;
    })
    .finally(() => datasetInFlight.delete(key));
  datasetInFlight.set(key, request);
  return request;
}

export class IencViewportController {
  private generation = 0;
  private activeState = '';
  private unavailable = new Set<string>();

  constructor(private readonly baseUrl: string = import.meta.env.BASE_URL) {}

  invalidateStyle(): void {
    this.generation += 1;
    this.activeState = '';
  }

  async reconcile(map: MapLibreMap): Promise<void> {
    const generation = ++this.generation;
    let catalog: IencCatalog;
    try {
      catalog = await loadIencCatalog(this.baseUrl);
    } catch (error) {
      console.error('[IENC] Catalog unavailable; official overlays disabled, base map remains active.', error);
      this.clearSources(map);
      return;
    }

    const cells = cellsIntersectingBbox(catalog, mapBoundsToBbox(map.getBounds()))
      .sort((a, b) => a.cellId.localeCompare(b.cellId));
    const includeSoundings = map.getZoom() >= IENC_SOUNDINGS_LOAD_MIN_ZOOM;
    const nextState = `${includeSoundings ? 'soundings' : 'no-soundings'}:${cells.map((cell) => cell.cellId).join(',')}`;
    if (nextState === this.activeState) return;

    const datasetsToLoad: readonly IencDatasetName[] = includeSoundings
      ? IENC_DATASET_NAMES
      : IENC_DATASET_NAMES.filter((dataset) => dataset !== 'soundings');

    const loaded = new Map<string, GeoJsonFeatureCollection>();
    await Promise.all(cells.flatMap((cell) => datasetsToLoad.map(async (dataset) => {
      const key = `${cell.cellId}/${dataset}`;
      try {
        const collection = await loadCellDataset(cell, dataset, this.baseUrl);
        loaded.set(key, collection);
        this.unavailable.delete(key);
      } catch (error) {
        if (!this.unavailable.has(key)) {
          console.error(`[IENC] Cell dataset unavailable (${key}); other IENC data remains active.`, error);
          this.unavailable.add(key);
        }
      }
    })));

    if (generation !== this.generation) return;
    // Merge in catalog/cell order, never network completion order. Stable feature
    // order keeps MapLibre symbol collision results deterministic.
    const merged = new Map<IencDatasetName, unknown[]>(IENC_DATASET_NAMES.map((name) => [name, []]));
    for (const cell of cells) {
      for (const dataset of datasetsToLoad) {
        const collection = loaded.get(`${cell.cellId}/${dataset}`);
        if (collection) merged.get(dataset)!.push(...collection.features);
      }
    }
    for (const dataset of IENC_DATASET_NAMES) {
      const source = map.getSource(IENC_SOURCE_IDS[dataset]) as GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: merged.get(dataset)! } as never);
    }
    this.activeState = nextState;
  }

  private clearSources(map: MapLibreMap): void {
    for (const sourceId of Object.values(IENC_SOURCE_IDS)) {
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      source?.setData(EMPTY_FEATURE_COLLECTION as never);
    }
    this.activeState = '';
  }
}
