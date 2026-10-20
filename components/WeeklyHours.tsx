import { getWeeklyHours } from "../lib/hours";
import type { Restaurant } from "../lib/types";

export function WeeklyHours({ restaurant, now }: { restaurant: Restaurant; now: number }) {
  const rows = getWeeklyHours(restaurant, now);
  return (
    <dl className="mt-3 divide-y divide-stone-200 border-t border-stone-200 text-base dark:divide-stone-800 dark:border-stone-800">
      {rows.map((row) => (
        <div
          key={row.day}
          className={`flex justify-between gap-4 py-2 ${row.isToday ? "font-semibold" : ""}`}
        >
          <dt>
            {row.name}
            {row.isToday && <span className="sr-only"> (today)</span>}
          </dt>
          <dd className="text-right text-stone-700 dark:text-stone-300">{row.text}</dd>
        </div>
      ))}
    </dl>
  );
}
