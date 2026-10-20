import { describe, expect, it } from "vitest";
import { DailyLimiter, parseLimit } from "./usage-limit";

describe("DailyLimiter", () => {
  it("allows calls while under the limit", () => {
    const limiter = new DailyLimiter(3, () => Date.UTC(2026, 9, 20, 12));
    expect(limiter.tryConsume()).toEqual({ allowed: true, count: 1, limit: 3 });
    expect(limiter.tryConsume()).toEqual({ allowed: true, count: 2, limit: 3 });
  });

  it("blocks once the limit is reached and stops counting", () => {
    const limiter = new DailyLimiter(2, () => Date.UTC(2026, 9, 20, 12));
    limiter.tryConsume();
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume()).toEqual({ allowed: false, count: 2, limit: 2 });
    expect(limiter.tryConsume()).toEqual({ allowed: false, count: 2, limit: 2 });
  });

  it("resets on a new UTC day", () => {
    let now = Date.UTC(2026, 9, 20, 23, 59);
    const limiter = new DailyLimiter(1, () => now);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(false);
    now = Date.UTC(2026, 9, 21, 0, 0);
    expect(limiter.tryConsume()).toEqual({ allowed: true, count: 1, limit: 1 });
  });

  it("blocks everything with a limit of 0", () => {
    expect(new DailyLimiter(0).tryConsume().allowed).toBe(false);
  });
});

describe("parseLimit", () => {
  it("uses valid non-negative integers and falls back otherwise", () => {
    expect(parseLimit("50", 30)).toBe(50);
    expect(parseLimit("0", 30)).toBe(0);
    expect(parseLimit(undefined, 30)).toBe(30);
    expect(parseLimit("", 30)).toBe(30);
    expect(parseLimit("abc", 30)).toBe(30);
    expect(parseLimit("-5", 30)).toBe(30);
    expect(parseLimit("2.5", 30)).toBe(30);
  });
});
