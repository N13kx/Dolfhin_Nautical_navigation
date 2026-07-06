/**
 * Search service — replaceable geocoding and nautical object search.
 *
 * SearchProvider is the contract that all search backends must implement.
 * Nominatim (OpenStreetMap) is the default in Alpha 0.1.x.
 * Future nautical search (locks, marinas, buoys by name) can implement
 * the same interface and be swapped in without touching UI components.
 */

export type SearchResultType = 'place' | 'nautical' | 'poi';

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  center: [number, number];                       // [lng, lat]
  bbox?: [number, number, number, number];         // [west, south, east, north]
  type: SearchResultType;
}

export interface SearchProvider {
  /** Search for locations. Callers pass an AbortSignal to cancel in-flight requests. */
  search(query: string, signal: AbortSignal): Promise<SearchResult[]>;
}
