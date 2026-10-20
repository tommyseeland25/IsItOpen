import type { OpeningHours, Period } from "./types";

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type OpenState = "open" | "closed" | "unknown";

export interface OpenStatus {
  state: OpenState;
  /** Short text for the badge: "Open", "Closed" or "Unknown". */
  badge: string;
  /** Detail line: "Open until 9:00 PM", "Opens at 11:00 AM", "Hours not available". */
  detail: string;
}

export interface DayHours {
  day: number;
  name: string;
  text: string;
  isToday: boolean;
}

export interface HoursInput {
  hours: OpeningHours | null;
  utcOffsetMinutes: number | null;
  temporarilyClosed?: boolean;
}

interface Interval {
  /** Minutes since Sunday 00:00, restaurant-local, in [0, WEEK). */
  start: number;
  /** Always > start; may exceed WEEK when the interval wraps past Saturday night. */
  end: number;
  openDay: number;
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Format minutes since midnight as "9:00 PM". 0 and 1440 both read "12:00 AM". */
export function formatTime(minutesSinceMidnight: number): string {
  const m = mod(minutesSinceMidnight, MINUTES_PER_DAY);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** The restaurant's local day-of-week and minutes since midnight at `nowMs`. */
export function getLocalTime(
  nowMs: number,
  utcOffsetMinutes: number,
): { day: number; minutes: number } {
  const shifted = new Date(nowMs + utcOffsetMinutes * 60_000);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function toIntervals(periods: Period[]): Interval[] {
  return periods.map((p) => {
    const start = p.openDay * MINUTES_PER_DAY + p.openMinutes;
    let end = p.closeDay * MINUTES_PER_DAY + p.closeMinutes;
    if (end <= start) end += MINUTES_PER_WEEK;
    return { start, end, openDay: p.openDay };
  });
}

function unknownStatus(): OpenStatus {
  return { state: "unknown", badge: "Unknown", detail: "Hours not available" };
}

/** Describe when a place next opens, relative to local `now`. */
function describeNextOpening(
  intervals: Interval[],
  nowWeekMinute: number,
): string {
  let bestDelta = Infinity;
  let bestStart = 0;
  for (const iv of intervals) {
    const delta = mod(iv.start - nowWeekMinute, MINUTES_PER_WEEK);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestStart = iv.start;
    }
  }
  const target = nowWeekMinute + bestDelta;
  const dayDiff =
    Math.floor(target / MINUTES_PER_DAY) -
    Math.floor(nowWeekMinute / MINUTES_PER_DAY);
  const time = formatTime(bestStart % MINUTES_PER_DAY);
  if (dayDiff === 0) return `Opens at ${time}`;
  if (dayDiff === 1) return `Opens tomorrow at ${time}`;
  const dayName = DAY_NAMES[Math.floor(bestStart / MINUTES_PER_DAY) % 7];
  return `Opens ${dayName.slice(0, 3)} at ${time}`;
}

/**
 * Open/closed status at `nowMs`, evaluated in the restaurant's own timezone
 * (never the device's).
 */
export function getOpenStatus(input: HoursInput, nowMs: number): OpenStatus {
  if (input.temporarilyClosed) {
    return { state: "closed", badge: "Closed", detail: "Temporarily closed" };
  }
  const { hours, utcOffsetMinutes } = input;
  if (!hours || utcOffsetMinutes === null) return unknownStatus();
  if (hours.alwaysOpen) {
    return { state: "open", badge: "Open", detail: "Open 24 hours" };
  }
  if (hours.periods.length === 0) return unknownStatus();

  const local = getLocalTime(nowMs, utcOffsetMinutes);
  const nowWeekMinute = local.day * MINUTES_PER_DAY + local.minutes;
  const intervals = toIntervals(hours.periods);

  const current = intervals.find(
    (iv) =>
      mod(nowWeekMinute - iv.start, MINUTES_PER_WEEK) < iv.end - iv.start,
  );

  if (current) {
    // Remaining minutes until this interval ends, then follow back-to-back
    // intervals (e.g. one closing at midnight, the next opening at midnight).
    let remaining =
      current.end - current.start -
      mod(nowWeekMinute - current.start, MINUTES_PER_WEEK);
    for (let i = 0; i <= intervals.length && remaining < MINUTES_PER_WEEK; i++) {
      const next = intervals.find(
        (iv) => mod(nowWeekMinute + remaining - iv.start, MINUTES_PER_WEEK) === 0,
      );
      if (!next) break;
      remaining += next.end - next.start;
    }
    if (remaining >= MINUTES_PER_WEEK) {
      return { state: "open", badge: "Open", detail: "Open 24 hours" };
    }
    const closeMinute = (nowWeekMinute + remaining) % MINUTES_PER_DAY;
    return {
      state: "open",
      badge: "Open",
      detail: `Open until ${formatTime(closeMinute)}`,
    };
  }

  return {
    state: "closed",
    badge: "Closed",
    detail: describeNextOpening(intervals, nowWeekMinute),
  };
}

/** Seven rows (Sunday first) for the expanded weekly view. */
export function getWeeklyHours(
  input: HoursInput,
  nowMs: number,
): DayHours[] {
  const { hours, utcOffsetMinutes } = input;
  const today =
    utcOffsetMinutes === null ? -1 : getLocalTime(nowMs, utcOffsetMinutes).day;

  return DAY_NAMES.map((name, day) => {
    let text: string;
    if (!hours || (hours.periods.length === 0 && !hours.alwaysOpen)) {
      text = "Hours not available";
    } else if (hours.alwaysOpen) {
      text = "Open 24 hours";
    } else {
      const todays = toIntervals(hours.periods)
        .filter((iv) => iv.openDay === day)
        .sort((a, b) => a.start - b.start);
      if (todays.length === 0) {
        text = "Closed";
      } else if (todays.some((iv) => iv.end - iv.start >= MINUTES_PER_DAY)) {
        text = "Open 24 hours";
      } else {
        text = todays
          .map(
            (iv) =>
              `${formatTime(iv.start % MINUTES_PER_DAY)} – ${formatTime(iv.end % MINUTES_PER_DAY)}`,
          )
          .join(", ");
      }
    }
    return { day, name, text, isToday: day === today };
  });
}
