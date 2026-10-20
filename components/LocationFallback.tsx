"use client";

import { useState, type FormEvent } from "react";
import type { GeocodeResponse } from "../lib/types";

interface Props {
  reason: "denied" | "timeout" | "unavailable";
  onLocation: (loc: GeocodeResponse) => void;
  onRetryGps: () => void;
}

const REASON_TEXT: Record<Props["reason"], string> = {
  denied: "Location access is turned off. Enter a ZIP code or address instead.",
  timeout: "We couldn't get your location in time. Enter a ZIP code or address, or try again.",
  unavailable: "Your location isn't available. Enter a ZIP code or address instead.",
};

export function LocationFallback({ reason, onLocation, onRetryGps }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) {
      setProblem("Please enter a ZIP code or address.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/geocode?${new URLSearchParams({ q: query.trim() })}`);
      if (res.ok) {
        onLocation((await res.json()) as GeocodeResponse);
      } else if (res.status === 404) {
        setProblem("We couldn't find that place. Try a ZIP code or a fuller address.");
      } else {
        setProblem("Something went wrong looking that up. Please try again in a moment.");
      }
    } catch {
      setProblem("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
    >
      <p className="text-base">{REASON_TEXT[reason]}</p>
      <label htmlFor="place" className="sr-only">
        ZIP code or address
      </label>
      <input
        id="place"
        type="text"
        inputMode="text"
        autoComplete="postal-code"
        placeholder="ZIP code or address"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-950"
      />
      {problem && (
        <p role="alert" className="mt-2 text-base text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 flex-1 rounded-xl bg-green-700 text-base font-semibold text-white active:bg-green-800 disabled:opacity-60"
        >
          {busy ? "Looking up…" : "Find restaurants"}
        </button>
        {reason !== "denied" && (
          <button
            type="button"
            onClick={onRetryGps}
            className="min-h-12 rounded-xl border border-stone-300 px-4 text-base font-medium dark:border-stone-700"
          >
            Try again
          </button>
        )}
      </div>
    </form>
  );
}
