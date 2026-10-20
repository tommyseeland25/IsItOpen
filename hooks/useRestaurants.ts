"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, Restaurant, RestaurantsResponse } from "../lib/types";

export type RestaurantsError = "network" | "rate_limited" | "daily_limit" | "server";

/** Taps on refresh/retry within this window of the last request are ignored. */
export const REQUEST_COOLDOWN_MS = 5000;

export interface Coords {
  lat: number;
  lng: number;
}

export function useRestaurants(coords: Coords | null, radiusMiles: number) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RestaurantsError | null>(null);
  const [nonce, setNonce] = useState(0);
  const [coolingDown, setCoolingDown] = useState(false);
  const lastRequestAt = useRef(0);

  const lat = coords?.lat;
  const lng = coords?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    lastRequestAt.current = Date.now();
    setCoolingDown(true);
    const cooldownTimer = setTimeout(() => setCoolingDown(false), REQUEST_COOLDOWN_MS);

    (async () => {
      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radiusMiles: String(radiusMiles),
        });
        const res = await fetch(`/api/restaurants?${qs}`, { signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiError | null;
          setError(
            body?.error === "daily_limit_reached"
              ? "daily_limit"
              : body?.error === "rate_limited"
                ? "rate_limited"
                : "server",
          );
          setRestaurants(null);
          return;
        }
        const data = (await res.json()) as RestaurantsResponse;
        setRestaurants(data.restaurants);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("network");
        setRestaurants(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(cooldownTimer);
    };
  }, [lat, lng, radiusMiles, nonce]);

  /** Re-fetch, unless a request started within the cooldown window. */
  const refetch = useCallback(() => {
    if (Date.now() - lastRequestAt.current < REQUEST_COOLDOWN_MS) return;
    setNonce((n) => n + 1);
  }, []);
  return { restaurants, loading, error, refetch, coolingDown };
}
