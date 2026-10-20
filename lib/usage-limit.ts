/**
 * Best-effort daily call counter for paid Google requests.
 *
 * The count lives in this server instance's memory. On serverless hosts such as
 * Vercel it resets on cold starts and isn't shared between instances, so treat
 * it as a first line of defense. The Google Cloud quota is the real hard cap.
 */

export interface LimitResult {
  allowed: boolean;
  /** Real calls counted so far today (UTC), including this one when allowed. */
  count: number;
  limit: number;
}

/** Parse a non-negative integer env value, falling back to `fallback`. */
export function parseLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export class DailyLimiter {
  private day = "";
  private count = 0;

  constructor(
    private limit: number,
    private now: () => number = Date.now,
  ) {}

  /** Count one real Google call if under the limit. Cache hits must not call this. */
  tryConsume(): LimitResult {
    const today = utcDay(this.now());
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
    if (this.count >= this.limit) {
      return { allowed: false, count: this.count, limit: this.limit };
    }
    this.count += 1;
    return { allowed: true, count: this.count, limit: this.limit };
  }
}
