/**
 * Community module — AIS vessel traffic, berth reviews, POIs, and alerts.
 *
 * CommunityProvider is a placeholder interface. No implementation exists in
 * Alpha 0.1.x. Future versions can integrate AIS data streams, user-submitted
 * berth reviews, and shared waypoints without changing the rest of the codebase.
 */

export interface CommunityVessel {
  mmsi: string;
  name?: string;
  position: [number, number]; // [lng, lat]
  sog?: number;     // knots
  cog?: number;     // degrees true
  heading?: number; // degrees true
  updatedAt: number; // ms since epoch
}

export interface BerthReview {
  id: string;
  berthId: string;
  rating: number;   // 1–5
  comment: string;
  authorId: string;
  createdAt: number; // ms since epoch
}

/**
 * CommunityProvider — pluggable live vessel and community data source.
 * Not implemented in Alpha 0.1.x.
 */
export interface CommunityProvider {
  readonly name: string;

  /** Live vessel positions within a radius */
  fetchNearbyVessels(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<CommunityVessel[]>;

  /** Community-submitted berth reviews */
  fetchBerthReviews(berthId: string): Promise<BerthReview[]>;
}
