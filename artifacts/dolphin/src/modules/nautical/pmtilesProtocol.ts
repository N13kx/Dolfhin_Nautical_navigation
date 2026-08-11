import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

let registered = false;

/** Register the official PMTiles protocol once for the lifetime of the app. */
export function ensurePmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}
