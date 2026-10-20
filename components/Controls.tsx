import { RADIUS_OPTIONS_MILES } from "../lib/types";

interface Props {
  radiusMiles: number;
  onRadiusChange: (miles: number) => void;
  openNow: boolean;
  onOpenNowChange: (value: boolean) => void;
}

export function Controls({ radiusMiles, onRadiusChange, openNow, onOpenNowChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-base">
        <span className="font-medium">Within</span>
        <select
          value={radiusMiles}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
        >
          {/* The default 1.5 mi radius isn't one of the choices; show it until the user picks. */}
          {!(RADIUS_OPTIONS_MILES as readonly number[]).includes(radiusMiles) && (
            <option value={radiusMiles}>{radiusMiles} mi</option>
          )}
          {RADIUS_OPTIONS_MILES.map((m) => (
            <option key={m} value={m}>
              {m} mi
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={openNow}
        onClick={() => onOpenNowChange(!openNow)}
        className="ml-auto flex min-h-11 items-center gap-2 rounded-xl px-1 text-base font-medium"
      >
        Open now
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 rounded-full transition-colors ${openNow ? "bg-green-700" : "bg-stone-400 dark:bg-stone-600"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${openNow ? "translate-x-5" : ""}`}
          />
        </span>
      </button>
    </div>
  );
}
