"use client";

import { useId, useState } from "react";
import { getOpenStatus } from "../lib/hours";
import { formatMiles } from "../lib/distance";
import type { Restaurant } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { WeeklyHours } from "./WeeklyHours";

export function RestaurantCard({ restaurant, now }: { restaurant: Restaurant; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const status = getOpenStatus(restaurant, now);

  return (
    <li className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-14 w-full items-start gap-3 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-snug font-semibold break-words">
            {restaurant.name}
          </span>
          <span className="mt-0.5 block text-base text-stone-600 dark:text-stone-400">
            {formatMiles(restaurant.distanceMiles)} · {status.detail}
          </span>
        </span>
        <StatusBadge state={status.state} label={status.badge} />
        <span aria-hidden="true" className="mt-1 text-stone-400">
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      <div id={panelId} hidden={!expanded} className="px-4 pb-3">
        {expanded && <WeeklyHours restaurant={restaurant} now={now} />}
      </div>
    </li>
  );
}
