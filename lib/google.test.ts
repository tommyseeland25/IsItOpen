import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const placesBody = {
  places: [
    {
      id: "a",
      displayName: { text: "Cafe A" },
      location: { latitude: 40.0001, longitude: -74.0001 },
      utcOffsetMinutes: -240,
      businessStatus: "OPERATIONAL",
    },
  ],
};

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./google");
}

describe("Nearby Search daily limit", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => Response.json(placesBody));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls Google while under the limit", async () => {
    const { getNearbyRestaurants } = await load({ DAILY_NEARBY_SEARCH_LIMIT: "2" });
    await getNearbyRestaurants(40.0, -74.0, 1);
    await getNearbyRestaurants(41.0, -74.0, 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects without calling Google once the limit is reached", async () => {
    const { getNearbyRestaurants } = await load({ DAILY_NEARBY_SEARCH_LIMIT: "1" });
    await getNearbyRestaurants(40.0, -74.0, 1);
    await expect(getNearbyRestaurants(41.0, -74.0, 1)).rejects.toMatchObject({
      code: "daily_limit_reached",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not count cache hits, including nearby coordinates that round the same", async () => {
    const { getNearbyRestaurants } = await load({ DAILY_NEARBY_SEARCH_LIMIT: "1" });
    await getNearbyRestaurants(40.0001, -74.0001, 1);
    // Same ~3-decimal key: served from cache even though the limit is exhausted.
    await getNearbyRestaurants(40.0004, -74.0003, 1);
    await getNearbyRestaurants(40.0001, -74.0001, 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one call between concurrent identical requests", async () => {
    const { getNearbyRestaurants } = await load({ DAILY_NEARBY_SEARCH_LIMIT: "1" });
    await Promise.all([
      getNearbyRestaurants(40.0, -74.0, 1),
      getNearbyRestaurants(40.0, -74.0, 1),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("limits geocoding separately", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        status: "OK",
        results: [{ formatted_address: "X", geometry: { location: { lat: 1, lng: 2 } } }],
      }),
    );
    const { geocode } = await load({ GEOCODE_DAILY_LIMIT: "1", DAILY_NEARBY_SEARCH_LIMIT: "0" });
    await geocode("10001");
    await geocode("10001"); // cached
    await expect(geocode("10002")).rejects.toMatchObject({ code: "daily_limit_reached" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
