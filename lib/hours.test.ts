import { describe, expect, it } from "vitest";
import {
  formatTime,
  getLocalTime,
  getOpenStatus,
  getWeeklyHours,
} from "./hours";
import { formatMiles, haversineMiles } from "./distance";
import type { OpeningHours, Period } from "./types";

const NY = -240; // EDT in October
const TOKYO = 540;

/** "HH:MM" → minutes since midnight. */
const t = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const period = (
  openDay: number,
  open: string,
  closeDay: number,
  close: string,
): Period => ({
  openDay,
  openMinutes: t(open),
  closeDay,
  closeMinutes: t(close),
});

/** Instant for a local wall-clock time in a given offset. 2026-10-20 is a Tuesday. */
const at = (localIso: string, offsetMinutes: number): number =>
  Date.parse(`${localIso}Z`) - offsetMinutes * 60_000;

const daily = (open: string, close: string, days = [0, 1, 2, 3, 4, 5, 6]) => ({
  alwaysOpen: false,
  periods: days.map((d) => period(d, open, d, close)),
});

const input = (hours: OpeningHours | null, utcOffsetMinutes: number | null = NY) => ({
  hours,
  utcOffsetMinutes,
});

describe("formatTime", () => {
  it("uses 12-hour format", () => {
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(t("09:05"))).toBe("9:05 AM");
    expect(formatTime(t("12:00"))).toBe("12:00 PM");
    expect(formatTime(t("21:00"))).toBe("9:00 PM");
    expect(formatTime(1440)).toBe("12:00 AM");
  });
});

describe("getOpenStatus – normal hours", () => {
  const hours = daily("11:00", "21:00");

  it("is open during the day and reports the closing time", () => {
    const s = getOpenStatus(input(hours), at("2026-10-20T15:00", NY));
    expect(s).toMatchObject({ state: "open", badge: "Open", detail: "Open until 9:00 PM" });
  });

  it("is closed before opening and reports today's opening time", () => {
    const s = getOpenStatus(input(hours), at("2026-10-20T09:00", NY));
    expect(s).toMatchObject({ state: "closed", badge: "Closed", detail: "Opens at 11:00 AM" });
  });

  it("is closed after closing and reports tomorrow's opening time", () => {
    const s = getOpenStatus(input(hours), at("2026-10-20T22:00", NY));
    expect(s.detail).toBe("Opens tomorrow at 11:00 AM");
  });

  it("treats the open minute as open and the close minute as closed", () => {
    expect(getOpenStatus(input(hours), at("2026-10-20T11:00", NY)).state).toBe("open");
    expect(getOpenStatus(input(hours), at("2026-10-20T21:00", NY)).state).toBe("closed");
  });

  it("names the weekday when the next opening is more than a day away", () => {
    const monThu = daily("11:00", "21:00", [1, 2, 3, 4]); // Mon–Thu
    // Friday 2026-10-23 22:00 → next opening Monday
    const s = getOpenStatus(input(monThu), at("2026-10-23T22:00", NY));
    expect(s.detail).toBe("Opens Mon at 11:00 AM");
  });
});

describe("getOpenStatus – past midnight", () => {
  const hours: OpeningHours = {
    alwaysOpen: false,
    periods: [period(5, "18:00", 6, "02:00")], // Fri 6 PM → Sat 2 AM
  };

  it("is open late Friday night", () => {
    const s = getOpenStatus(input(hours), at("2026-10-23T23:30", NY));
    expect(s).toMatchObject({ state: "open", detail: "Open until 2:00 AM" });
  });

  it("is still open early Saturday morning", () => {
    const s = getOpenStatus(input(hours), at("2026-10-24T01:00", NY));
    expect(s).toMatchObject({ state: "open", detail: "Open until 2:00 AM" });
  });

  it("is closed after the late close", () => {
    const s = getOpenStatus(input(hours), at("2026-10-24T03:00", NY));
    expect(s).toMatchObject({ state: "closed", detail: "Opens Fri at 6:00 PM" });
  });

  it("handles a Saturday-night period that wraps into Sunday", () => {
    const wrap: OpeningHours = {
      alwaysOpen: false,
      periods: [period(6, "20:00", 0, "01:00")],
    };
    const s = getOpenStatus(input(wrap), at("2026-10-25T00:30", NY)); // Sunday
    expect(s).toMatchObject({ state: "open", detail: "Open until 1:00 AM" });
  });

  it("merges back-to-back periods split at midnight", () => {
    const split: OpeningHours = {
      alwaysOpen: false,
      periods: [period(2, "10:00", 3, "00:00"), period(3, "00:00", 3, "02:00")],
    };
    const s = getOpenStatus(input(split), at("2026-10-20T23:00", NY));
    expect(s.detail).toBe("Open until 2:00 AM");
  });
});

describe("getOpenStatus – 24-hour places", () => {
  it("is open all the time when Google reports no close time", () => {
    const hours: OpeningHours = { alwaysOpen: true, periods: [period(0, "00:00", 0, "00:00")] };
    const s = getOpenStatus(input(hours), at("2026-10-20T04:00", NY));
    expect(s).toMatchObject({ state: "open", detail: "Open 24 hours" });
  });

  it("detects 24/7 from chained full-day periods", () => {
    const hours: OpeningHours = {
      alwaysOpen: false,
      periods: [0, 1, 2, 3, 4, 5, 6].map((d) => period(d, "00:00", (d + 1) % 7, "00:00")),
    };
    const s = getOpenStatus(input(hours), at("2026-10-20T04:00", NY));
    expect(s).toMatchObject({ state: "open", detail: "Open 24 hours" });
  });
});

describe("getOpenStatus – missing or special hours", () => {
  it("shows 'Hours not available' without hours", () => {
    const s = getOpenStatus(input(null), Date.now());
    expect(s).toMatchObject({ state: "unknown", detail: "Hours not available" });
  });

  it("shows 'Hours not available' with empty periods", () => {
    const s = getOpenStatus(input({ alwaysOpen: false, periods: [] }), Date.now());
    expect(s.state).toBe("unknown");
  });

  it("cannot evaluate hours without a timezone offset", () => {
    expect(getOpenStatus(input(daily("11:00", "21:00"), null), Date.now()).state).toBe("unknown");
  });

  it("reports temporarily closed places as closed", () => {
    const s = getOpenStatus(
      { hours: daily("00:00", "23:59"), utcOffsetMinutes: NY, temporarilyClosed: true },
      at("2026-10-20T12:00", NY),
    );
    expect(s).toMatchObject({ state: "closed", detail: "Temporarily closed" });
  });
});

describe("getOpenStatus – timezones", () => {
  const hours = daily("11:00", "21:00");
  // 2026-10-20T02:00Z = Mon 22:00 in New York, Tue 11:00 in Tokyo.
  const instant = Date.UTC(2026, 9, 20, 2, 0);

  it("evaluates the same instant differently per restaurant timezone", () => {
    expect(getOpenStatus(input(hours, NY), instant).state).toBe("closed");
    expect(getOpenStatus(input(hours, TOKYO), instant).state).toBe("open");
  });

  it("computes local day and minutes from the offset", () => {
    expect(getLocalTime(instant, NY)).toEqual({ day: 1, minutes: t("22:00") });
    expect(getLocalTime(instant, TOKYO)).toEqual({ day: 2, minutes: t("11:00") });
  });

  it("handles half-hour offsets", () => {
    const india = 330;
    expect(getLocalTime(Date.UTC(2026, 9, 20, 0, 0), india)).toEqual({ day: 2, minutes: t("05:30") });
  });
});

describe("getWeeklyHours", () => {
  const hours: OpeningHours = {
    alwaysOpen: false,
    periods: [
      period(1, "11:00", 1, "14:00"),
      period(1, "17:00", 1, "21:00"),
      period(5, "18:00", 6, "02:00"),
      period(3, "00:00", 4, "00:00"),
    ],
  };
  const rows = getWeeklyHours(input(hours), at("2026-10-20T12:00", NY)); // Tuesday

  it("returns seven days starting Sunday", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    ]);
  });

  it("lists split shifts, late closes, 24-hour days and closed days", () => {
    expect(rows[1].text).toBe("11:00 AM – 2:00 PM, 5:00 PM – 9:00 PM");
    expect(rows[5].text).toBe("6:00 PM – 2:00 AM");
    expect(rows[3].text).toBe("Open 24 hours");
    expect(rows[0].text).toBe("Closed");
  });

  it("marks today in the restaurant's timezone", () => {
    expect(rows.filter((r) => r.isToday).map((r) => r.name)).toEqual(["Tuesday"]);
    // 2026-10-20T02:00Z is still Monday in New York but Tuesday in Tokyo.
    const instant = Date.UTC(2026, 9, 20, 2, 0);
    expect(getWeeklyHours(input(hours, NY), instant).find((r) => r.isToday)?.name).toBe("Monday");
    expect(getWeeklyHours(input(hours, TOKYO), instant).find((r) => r.isToday)?.name).toBe("Tuesday");
  });

  it("handles missing and always-open hours", () => {
    expect(getWeeklyHours(input(null), Date.now()).every((r) => r.text === "Hours not available")).toBe(true);
    const all = getWeeklyHours(input({ alwaysOpen: true, periods: [] }), Date.now());
    expect(all.every((r) => r.text === "Open 24 hours")).toBe(true);
  });
});

describe("distance", () => {
  it("formats miles", () => {
    expect(formatMiles(0.44)).toBe("0.4 mi");
    expect(formatMiles(12.6)).toBe("13 mi");
  });

  it("computes haversine distance", () => {
    // ~1 degree of latitude ≈ 69 miles
    expect(haversineMiles(40, -74, 41, -74)).toBeGreaterThan(68.5);
    expect(haversineMiles(40, -74, 41, -74)).toBeLessThan(69.5);
    expect(haversineMiles(40, -74, 40, -74)).toBe(0);
  });
});
