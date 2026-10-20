# IsItOpen

A mobile-first web app that shows restaurants near you, how far they are, whether they're open right now, and their hours. Nothing else.

Built with Next.js (App Router), TypeScript, Tailwind CSS, and the Google Places API (New). The Google API key stays on the server: the browser only talks to this app's `/api/restaurants` and `/api/geocode` routes.

## 1. Get a Google API key

1. Create (or pick) a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. **Enable billing** for the project, then set a **budget alert**: Billing → Budgets & alerts → Create budget (for example $5/month with alerts at 50% and 100%).
3. Under APIs & Services → Library, enable both:
   - **Places API (New)**
   - **Geocoding API**
4. Under APIs & Services → Credentials, create an API key and **restrict it**:
   - *API restrictions*: allow only Places API (New) and Geocoding API.
   - *Application restrictions*: the key is used from a server, so "Websites" (HTTP referrer) restrictions won't work. Use **IP addresses** if your host has fixed egress IPs (Vercel doesn't on standard plans); otherwise rely on the API restriction plus a low quota and budget alert.
5. Optionally lower per-day quotas under Quotas & System Limits to cap spend.

Opening-hours fields are billed at a higher Places tier, so the app requests only the fields it needs and caches results in memory for 10 minutes.

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # then paste your key into GOOGLE_PLACES_API_KEY
npm run dev
```

Open http://localhost:3000.

> **Geolocation requires HTTPS** (except on `localhost`). To test on a phone, use a deployed Vercel preview or an HTTPS tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.

Other scripts:

```bash
npm test        # Vitest unit tests (hours logic)
npm run lint    # type-check
npm run build   # production build
```

## 3. Deploy to Vercel

1. Push this repo to GitHub and import it at https://vercel.com/new (the Next.js preset needs no changes).
2. In Project Settings → Environment Variables, add `GOOGLE_PLACES_API_KEY` (Production and Preview). Don't use a `NEXT_PUBLIC_` prefix.
3. Deploy. Each preview URL is HTTPS, so geolocation works on your phone.

The server cache is in memory per serverless instance, so it's best-effort on Vercel.

## Staying within the free tier

Hours of operation are an **Enterprise-tier** field on Places API (New) Nearby Search, which includes **1,000 free calls per month**. The app has two layers of protection so it can't go past that:

1. **App-side daily cap (best-effort).** Real Google calls are counted per UTC day and refused with HTTP 429 `{"error":"daily_limit_reached"}` once the cap is hit; the UI then shows "This app has reached its daily search limit. Please try again tomorrow." Cache hits are never counted. Configure with:
   - `DAILY_NEARBY_SEARCH_LIMIT` (default `30`, about 930 calls in a 31-day month)
   - `GEOCODE_DAILY_LIMIT` (default `200`, geocoding is billed separately)

   > **Caveat:** the counter is in memory. On serverless hosts like Vercel it resets on cold starts and isn't shared between instances, so it is best-effort only. **The Google Cloud quota below is the real hard cap.**

2. **Google Cloud quota (the hard cap).** In the Cloud Console:
   1. Go to APIs & Services → Enabled APIs & services → **Places API (New)** → **Quotas & System Limits**.
   2. Find the Nearby Search quota (a "requests per day" or "per minute" line; exact names change, so look for "Nearby Search") and click the pencil to edit. Set a daily limit of about **30** (for example, "Nearby Search requests per day"). If only per-minute quotas are offered, set the lowest value you can and rely on the budget alert and the app cap.
   3. Do the same under **Geocoding API** → Quotas if you want a hard geocoding cap.
   4. Keep the **budget alert** from step 1 of the key setup. Budgets only notify; they don't stop spending. Quotas are what actually refuse requests.

Also in-app: results are cached for 10 minutes (keyed by coordinates rounded to 3 decimals, about 100 m), identical simultaneous requests share one Google call, invalid coordinates are rejected before Google is called, and the Refresh button ignores taps within 5 seconds of the last request.

## How it works

- `lib/hours.ts` is a pure, typed module: open/closed status, "Open until…"/"Opens at…" text, and weekly hours. Status is evaluated in the **restaurant's** timezone (`utcOffsetMinutes`), not the device's, and handles past-midnight hours, 24-hour places, missing hours, and temporarily closed places. Permanently closed places are dropped on the server.
- `lib/google.ts` calls Places `searchNearby` (field-masked, max 20 results, ranked by distance) and the Geocoding API. Errors are logged on the server; the UI only sees generic error codes.
- The API returns raw opening periods rather than a precomputed status, so the status and the "Open now" filter stay correct as time passes without refetching.
