"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls } from "../components/Controls";
import { Footer } from "../components/Footer";
import { LocationFallback } from "../components/LocationFallback";
import { Message } from "../components/Message";
import { RestaurantList } from "../components/RestaurantList";
import { ListSkeleton } from "../components/Skeletons";
import { useGeolocation } from "../hooks/useGeolocation";
import { useRestaurants, type RestaurantsError } from "../hooks/useRestaurants";
import { getOpenStatus } from "../lib/hours";
import { DEFAULT_RADIUS_MILES, type GeocodeResponse } from "../lib/types";

const ERROR_COPY: Record<RestaurantsError, { title: string; body: string }> = {
  network: {
    title: "Can't reach the server",
    body: "Check your internet connection and try again.",
  },
  rate_limited: {
    title: "We're a bit busy",
    body: "Too many requests right now. Please try again in a minute.",
  },
  server: {
    title: "Something went wrong",
    body: "We couldn't load restaurants. Please try again shortly.",
  },
};

export default function Home() {
  const geo = useGeolocation();
  const [manual, setManual] = useState<GeocodeResponse | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [openNow, setOpenNow] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { request: requestGps } = geo;
  useEffect(() => requestGps(), [requestGps]);

  // Keep statuses fresh while the page stays open.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const coords = manual ?? (geo.state.status === "granted" ? geo.state : null);
  const { restaurants, loading, error, refetch } = useRestaurants(coords, radiusMiles);

  const visible = useMemo(() => {
    if (!restaurants) return [];
    return openNow
      ? restaurants.filter((r) => getOpenStatus(r, now).state === "open")
      : restaurants;
  }, [restaurants, openNow, now]);

  function refresh() {
    setNow(Date.now());
    if (manual) refetch();
    else requestGps();
  }

  const needsFallback = !manual && geo.state.status === "error";
  const locating = !manual && (geo.state.status === "idle" || geo.state.status === "loading");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-160 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">IsItOpen</h1>
          {manual && (
            <p className="truncate text-sm text-stone-600 dark:text-stone-400">Near {manual.label}</p>
          )}
        </div>
        {!needsFallback && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading || locating}
            aria-label="Refresh"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 text-base font-medium disabled:opacity-50 dark:border-stone-700"
          >
            <span aria-hidden="true" className={loading || locating ? "animate-spin" : ""}>
              ↻
            </span>
            Refresh
          </button>
        )}
      </header>

      <main className="flex-1 space-y-4 py-2">
        {needsFallback && geo.state.status === "error" && (
          <LocationFallback
            reason={geo.state.kind}
            onLocation={setManual}
            onRetryGps={requestGps}
          />
        )}

        {coords && (
          <Controls
            radiusMiles={radiusMiles}
            onRadiusChange={setRadiusMiles}
            openNow={openNow}
            onOpenNowChange={setOpenNow}
          />
        )}

        {locating && (
          <>
            <p role="status" className="text-center text-base text-stone-600 dark:text-stone-400">
              Finding restaurants near you…
            </p>
            <ListSkeleton />
          </>
        )}

        {coords && loading && <ListSkeleton />}

        {coords && !loading && error && (
          <Message title={ERROR_COPY[error].title} action={{ label: "Try again", onClick: refetch }}>
            {ERROR_COPY[error].body}
          </Message>
        )}

        {coords && !loading && !error && restaurants && restaurants.length === 0 && (
          <Message title="No restaurants found">
            Nothing within {radiusMiles} mi. Try a larger distance.
          </Message>
        )}

        {coords && !loading && !error && restaurants && restaurants.length > 0 && visible.length === 0 && (
          <Message title="Nothing open right now">
            No restaurants within {radiusMiles} mi are open. Turn off “Open now” to see them all.
          </Message>
        )}

        {coords && !loading && !error && visible.length > 0 && (
          <RestaurantList restaurants={visible} now={now} />
        )}
      </main>

      <Footer />
    </div>
  );
}
