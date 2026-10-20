import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "../../../lib/api-response";
import { ApiFailure, geocode } from "../../../lib/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 3 || q.length > 200) throw new ApiFailure("invalid_request");
    return NextResponse.json(await geocode(q));
  } catch (err) {
    return errorResponse(err);
  }
}
