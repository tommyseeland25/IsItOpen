// Server-only: this module reads the API key. Never import it from client code.
import { METERS_PER_MILE, haversineMiles } from "./distance";
import { TtlCache } from "./cache";
import { DailyLimiter, parseLimit } from "./usage-limit";
import type {
  ApiErrorCode,
  GeocodeResponse,
  OpeningHours,
  Period,
  Restaurant,
} from "./types";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.utcOffsetMinutes",
  "places.businessStatus",
].join(",");

const CACHE_TTL_MS = 10 * 60_000;
const MAX_RESULTS = 20;

/** An error whose `code` is safe to show users; `detail` is for server logs only. */
export class ApiFailure extends Error {
  constructor(
    public code: ApiErrorCode,
    public detail?: string,
  ) {
    super(code);
  }
}

interface GooglePoint {
  day?: number;
  hour?: number;
  minute?: number;
}
interface GoogleHours {
  periods?: { open?: GooglePoint; close?: GooglePoint }[];
}
interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: GoogleHours;
  currentOpeningHours?: GoogleHours;
  utcOffsetMinutes?: number;
  businessStatus?: string;
}

const placesCache = new TtlCache<GooglePlace[]>(CACHE_TTL_MS);
const geocodeCache = new TtlCache<GeocodeResponse>(CACHE_TTL_MS);

// Only real Google calls are counted; cache hits never reach these limiters.
const nearbyLimiter = new DailyLimiter(parseLimit(process.env.DAILY_NEARBY_SEARCH_LIMIT, 30));
const geocodeLimiter = new DailyLimiter(parseLimit(process.env.GEOCODE_DAILY_LIMIT, 200));

/** Concurrent identical requests share one Google call (and one count). */
const inflightPlaces = new Map<string, Promise<GooglePlace[]>>();
const inflightGeocode = new Map<string, Promise<GeocodeResponse>>();

function consumeOrThrow(limiter: DailyLimiter, label: string): void {
  const { allowed, count, limit } = limiter.tryConsume();
  if (!allowed) {
    console.warn(`[google] ${label} daily limit reached (${limit}); not calling Google`);
    throw new ApiFailure("daily_limit_reached");
  }
  console.info(`[google] ${label} call #${count} today (limit ${limit})`);
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new ApiFailure("upstream_unavailable", "GOOGLE_PLACES_API_KEY is not set");
  return key;
}

function failureFromStatus(status: number, body: string): ApiFailure {
  const code: ApiErrorCode = status === 429 ? "rate_limited" : "upstream_unavailable";
  return new ApiFailure(code, `Google responded ${status}: ${body.slice(0, 500)}`);
}

async function googleFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new ApiFailure("upstream_unavailable", `Network error: ${String(err)}`);
  }
}

/** Convert Google's opening-hours payload to our compact, timezone-free shape. */
export function normalizeHours(
  current?: GoogleHours,
  regular?: GoogleHours,
): OpeningHours | null {
  // currentOpeningHours reflects holidays and special hours for the next 7 days.
  const source = current?.periods?.length ? current : regular;
  const raw = source?.periods;
  if (!raw?.length) return null;

  const first = raw[0];
  if (
    raw.length === 1 &&
    !first.close &&
    first.open?.day === 0 &&
    !first.open.hour &&
    !first.open.minute
  ) {
    return { alwaysOpen: true, periods: [] };
  }

  const periods: Period[] = [];
  for (const p of raw) {
    if (!p.open || !p.close) continue;
    periods.push({
      openDay: p.open.day ?? 0,
      openMinutes: (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0),
      closeDay: p.close.day ?? 0,
      closeMinutes: (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0),
    });
  }
  return periods.length ? { alwaysOpen: false, periods } : null;
}

async function fetchPlaces(
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<GooglePlace[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusMiles}`;
  const cached = placesCache.get(key);
  if (cached) return cached;

  const pending = inflightPlaces.get(key);
  if (pending) return pending;
  const request = callNearbySearch(key, lat, lng, radiusMiles).finally(() =>
    inflightPlaces.delete(key),
  );
  inflightPlaces.set(key, request);
  return request;
}

async function callNearbySearch(
  key: string,
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<GooglePlace[]> {
  const apiKeyValue = apiKey();
  consumeOrThrow(nearbyLimiter, "Nearby Search");

  const res = await googleFetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKeyValue,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: MAX_RESULTS,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMiles * METERS_PER_MILE,
        },
      },
    }),
  });
  if (!res.ok) throw failureFromStatus(res.status, await res.text());

  const data = (await res.json()) as { places?: GooglePlace[] };
  const places = data.places ?? [];
  placesCache.set(key, places);
  return places;
}

/** Nearby restaurants, nearest first, excluding permanently closed places. */
export async function getNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<Restaurant[]> {
  const places = await fetchPlaces(lat, lng, radiusMiles);

  const restaurants: Restaurant[] = [];
  for (const p of places) {
    if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
    if (!p.location || !p.displayName?.text) continue;
    const distanceMiles = haversineMiles(lat, lng, p.location.latitude, p.location.longitude);
    if (distanceMiles > radiusMiles) continue;
    restaurants.push({
      id: p.id,
      name: p.displayName.text,
      distanceMiles,
      utcOffsetMinutes: p.utcOffsetMinutes ?? null,
      hours: normalizeHours(p.currentOpeningHours, p.regularOpeningHours),
      temporarilyClosed: p.businessStatus === "CLOSED_TEMPORARILY",
    });
  }
  return restaurants.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export async function geocode(query: string): Promise<GeocodeResponse> {
  const cacheKey = query.trim().toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const pending = inflightGeocode.get(cacheKey);
  if (pending) return pending;
  const request = callGeocode(cacheKey, query).finally(() => inflightGeocode.delete(cacheKey));
  inflightGeocode.set(cacheKey, request);
  return request;
}

async function callGeocode(cacheKey: string, query: string): Promise<GeocodeResponse> {
  const key = apiKey();
  consumeOrThrow(geocodeLimiter, "Geocoding");

  const url = `${GEOCODE_URL}?${new URLSearchParams({ address: query, key })}`;
  const res = await googleFetch(url);
  if (!res.ok) throw failureFromStatus(res.status, await res.text());

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status === "ZERO_RESULTS") throw new ApiFailure("not_found");
  if (data.status === "OVER_QUERY_LIMIT") {
    throw new ApiFailure("rate_limited", data.error_message);
  }
  if (data.status !== "OK" || !data.results?.length) {
    throw new ApiFailure("upstream_unavailable", `Geocoding status ${data.status}: ${data.error_message ?? ""}`);
  }

  const top = data.results[0];
  const result = {
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    label: top.formatted_address,
  };
  geocodeCache.set(cacheKey, result);
  return result;
}
