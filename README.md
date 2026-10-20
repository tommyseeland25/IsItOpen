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

Opening-hours fields are billed at a higher Places tier, so the app requests only the fields it needs and caches results in memory for 5 minutes.

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

## How it works

- `lib/hours.ts` is a pure, typed module: open/closed status, "Open until…"/"Opens at…" text, and weekly hours. Status is evaluated in the **restaurant's** timezone (`utcOffsetMinutes`), not the device's, and handles past-midnight hours, 24-hour places, missing hours, and temporarily closed places. Permanently closed places are dropped on the server.
- `lib/google.ts` calls Places `searchNearby` (field-masked, max 20 results, ranked by distance) and the Geocoding API. Errors are logged on the server; the UI only sees generic error codes.
- The API returns raw opening periods rather than a precomputed status, so the status and the "Open now" filter stay correct as time passes without refetching.
