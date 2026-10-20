/** Day of week: 0 = Sunday … 6 = Saturday. Minutes are since local midnight. */
export interface Period {
  openDay: number;
  openMinutes: number;
  closeDay: number;
  closeMinutes: number;
}

export interface OpeningHours {
  /** True when Google reports the place as open around the clock (no close time). */
  alwaysOpen: boolean;
  periods: Period[];
}

export interface Restaurant {
  id: string;
  name: string;
  distanceMiles: number;
  /** Offset of the restaurant's timezone from UTC, in minutes. */
  utcOffsetMinutes: number | null;
  /** null → hours not available. */
  hours: OpeningHours | null;
  temporarilyClosed: boolean;
}

export interface RestaurantsResponse {
  restaurants: Restaurant[];
  fetchedAt: string;
}

export interface GeocodeResponse {
  lat: number;
  lng: number;
  label: string;
}

export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "daily_limit_reached"
  | "upstream_unavailable";

export interface ApiError {
  error: ApiErrorCode;
}

export const RADIUS_OPTIONS_MILES = [0.5, 1, 3, 5] as const;
export const DEFAULT_RADIUS_MILES = 1.5;
