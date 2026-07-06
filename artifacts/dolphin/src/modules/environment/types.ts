/**
 * Environment module — weather, tide, and conditions data.
 *
 * WeatherProvider is a placeholder interface. No implementation exists in
 * Alpha 0.1.x. Future versions can plug in OpenWeather, Buienradar, or
 * national tide services without changing the rest of the codebase.
 */

export interface WeatherConditions {
  windSpeed: number;      // m/s
  windDirection: number;  // degrees true north
  waveHeight?: number;    // meters significant wave height
  visibility?: number;    // km
  precipitation?: number; // mm/hr
  fetchedAt: number;      // ms since epoch
}

export type TideType = 'high' | 'low';

export interface TidePrediction {
  time: number;     // ms since epoch
  height: number;   // meters above chart datum
  type: TideType;
}

/**
 * WeatherProvider — pluggable weather and tide data source.
 * Not implemented in Alpha 0.1.x.
 */
export interface WeatherProvider {
  readonly name: string;

  /** Current conditions at a position */
  fetchCurrent(lat: number, lng: number): Promise<WeatherConditions>;

  /** Tide predictions for a known station */
  fetchTide(stationId: string, fromTime: number, toTime: number): Promise<TidePrediction[]>;
}
