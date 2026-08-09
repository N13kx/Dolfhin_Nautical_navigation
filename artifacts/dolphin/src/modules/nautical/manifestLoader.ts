/**
 * manifestLoader.ts — typed IENC pipeline manifest loader.
 *
 * Fetches `pipeline-manifest.public.json` once at app startup and caches it
 * in module scope for the lifetime of the session. All callers share the same
 * in-flight fetch to avoid redundant requests.
 *
 * Throws if the manifest cannot be fetched or if validation.status !== "PASS".
 */

export interface PipelineManifestSource {
  cellId: string;
  edition: string;
  /** Format: YYYYMMDD (e.g. "20260617"). Null → show "—" in UI. */
  issueDate: string | null;
  /** Format: YYYYMMDD. Null → show "—" in UI. */
  updateApplicationDate: string | null;
  producer: string;
}

export interface PipelineManifest {
  pipelineSchemaVersion: number;
  pipelineRunId: string;
  generatedAt: string;
  validation: {
    status: string;
    validatedAt: string;
  };
  sources: PipelineManifestSource[];
  depthDatum: string;
  depthDatumStatus: string;
  disclaimers: string[];
}

let cached: PipelineManifest | null = null;
let inFlight: Promise<PipelineManifest> | null = null;

/** Formats a YYYYMMDD date string to "DD MMM YYYY". Returns null on invalid input. */
export function formatManifestDate(yyyymmdd: string | null | undefined): string | null {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);
  const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Fetches and validates the IENC pipeline public manifest.
 * Safe to call multiple times — returns the cached instance after first load.
 * Throws with a descriptive message if the manifest is unavailable or invalid.
 */
export async function loadManifest(baseUrl: string = import.meta.env.BASE_URL): Promise<PipelineManifest> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  const url = `${baseUrl}nautical/pipeline-manifest.public.json`;

  inFlight = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`[IENC] Failed to fetch manifest: HTTP ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as PipelineManifest;
      if (data.pipelineSchemaVersion !== 1) {
        throw new Error(
          `[IENC] Unsupported manifest schema version: ${data.pipelineSchemaVersion} (expected 1)`
        );
      }
      if (!data.pipelineRunId) {
        throw new Error('[IENC] Manifest is missing pipelineRunId — corrupt file?');
      }
      const status = data.validation?.status;
      if (status !== 'PASS') {
        throw new Error(
          `[IENC] Manifest validation.status is "${status ?? 'missing'}" — must be "PASS". ` +
          `Pipeline must be re-run and data re-published before the app can use IENC layers.`
        );
      }
      cached = data;
      return data;
    })
    .catch((err) => {
      inFlight = null; // permit retry on next call
      throw err;
    });

  return inFlight;
}

/**
 * Returns the per-cell source entry from the cached manifest.
 * Returns null if the manifest has not been loaded yet or the cellId is unknown.
 * Callers should show "—" in the UI for any null field.
 */
export function getCellMeta(cellId: string): PipelineManifestSource | null {
  if (!cached) return null;
  return cached.sources.find((s) => s.cellId === cellId) ?? null;
}
