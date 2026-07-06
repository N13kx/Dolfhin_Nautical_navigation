import type { SearchProvider, SearchResult } from './types';

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
  type?: string;
  class?: string;
}

/** Build a short human-readable description from the full display_name */
function buildDescription(r: NominatimItem): string {
  const parts = r.display_name.split(', ');
  // Skip first part (already used as name), take next 2
  return parts.slice(1, 3).join(', ') || r.display_name;
}

/**
 * Nominatim geocoder — searches OpenStreetMap place data.
 * No API key required. Fair-use: 1 request per second maximum.
 * Results are limited to 5 and filtered to Dutch-language labels.
 */
export const nominatimProvider: SearchProvider = {
  async search(query: string, signal: AbortSignal): Promise<SearchResult[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '0');

    const res = await fetch(url.toString(), {
      signal,
      headers: {
        'Accept-Language': 'nl,en;q=0.8',
        'User-Agent': 'DolphinNavigation/0.1.1',
      },
    });

    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

    const data: NominatimItem[] = await res.json();

    return data.map((r): SearchResult => ({
      id: String(r.place_id),
      name: r.display_name.split(',')[0].trim(),
      description: buildDescription(r),
      center: [parseFloat(r.lon), parseFloat(r.lat)],
      bbox: r.boundingbox
        ? [
            parseFloat(r.boundingbox[2]), // west
            parseFloat(r.boundingbox[0]), // south
            parseFloat(r.boundingbox[3]), // east
            parseFloat(r.boundingbox[1]), // north
          ]
        : undefined,
      type: 'place',
    }));
  },
};
