import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "../../../lib/api-response";
import { ApiFailure, getNearbyRestaurants } from "../../../lib/google";
import { RADIUS_OPTIONS_MILES, type RestaurantsResponse } from "../../../lib/types";

export const dynamic = "force-dynamic";

const ALLOWED_RADII: readonly number[] = [1.5, ...RADIUS_OPTIONS_MILES];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const radius = Number(params.get("radiusMiles") ?? 1.5);

    if (
      !params.get("lat") ||
      !params.get("lng") ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      !ALLOWED_RADII.includes(radius)
    ) {
      throw new ApiFailure("invalid_request");
    }

    const restaurants = await getNearbyRestaurants(lat, lng, radius);
    const body: RestaurantsResponse = { restaurants, fetchedAt: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
