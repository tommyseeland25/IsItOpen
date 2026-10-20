import { NextResponse } from "next/server";
import { ApiFailure } from "./google";
import type { ApiError } from "./types";

const STATUS: Record<ApiError["error"], number> = {
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  daily_limit_reached: 429,
  upstream_unavailable: 502,
};

/** Log details server-side; return only a generic code to the client. */
export function errorResponse(err: unknown): NextResponse<ApiError> {
  const failure =
    err instanceof ApiFailure ? err : new ApiFailure("upstream_unavailable", String(err));
  if (failure.detail) console.error(`[api] ${failure.code}: ${failure.detail}`);
  return NextResponse.json({ error: failure.code }, { status: STATUS[failure.code] });
}
