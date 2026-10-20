"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, Restaurant, RestaurantsResponse } from "../lib/types";

export type RestaurantsError = "network" | "rate_limited" | "server";

export interface Coords {
  lat: number;
  lng: number;
}

export function useRestaurants(coords: Coords | null, radiusMiles: number) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RestaurantsError | null>(null);
  const [nonce, setNonce] = useState(0);

  const lat = coords?.lat;
  const lng = coords?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

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
          setError(body?.error === "rate_limited" ? "rate_limited" : "server");
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

    return () => controller.abort();
  }, [lat, lng, radiusMiles, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { restaurants, loading, error, refetch };
}
