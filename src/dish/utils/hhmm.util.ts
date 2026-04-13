/** Normalize multipart / JSON time values to compact HHMM (0–2359). */
export function normalizeHHMMValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const hourLike = obj.hour ?? obj.hours ?? obj.h ?? obj.$H;
    const minuteLike = obj.minute ?? obj.minutes ?? obj.m ?? obj.$m;
    const hour = Number(hourLike);
    const minute = Number(minuteLike);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return hour * 100 + minute;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 100 + value.getMinutes();
  }

  if (typeof value !== "string") return NaN;
  const raw = value.trim();
  if (!raw) return NaN;
  if (raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return NaN;
  }

  if (/^\d{1,4}$/.test(raw)) {
    return parseInt(raw, 10);
  }

  // Handle 7:35 a.m. / 7:35 p.m. locale variants.
  const canonical = raw.replace(/\./g, "").replace(/\s+/g, " ").trim();
  const parsedDate = Date.parse(canonical);
  if (!Number.isNaN(parsedDate)) {
    const d = new Date(parsedDate);
    return d.getHours() * 100 + d.getMinutes();
  }
  // HTML time inputs often send HH:MM:SS or HH:MM:SS.mmm; optional AM/PM for text fallbacks.
  let m = canonical.match(
    /^(\d{1,2}):(\d{2})(?::\d{1,2}(?:\.\d+)?)?(?:\s*(AM|PM))?$/i,
  );
  if (!m) {
    // Fallback: extract first time token from a larger sentence/string payload.
    m = canonical.match(
      /(\d{1,2}):(\d{2})(?::\d{1,2}(?:\.\d+)?)?(?:\s*(AM|PM))?/i,
    );
  }
  if (!m) return NaN;

  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const meridiem = m[3]?.toUpperCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return NaN;
    if (meridiem === "AM") {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
  }

  return hour * 100 + minute;
}

export function isValidHHMM(time: number): boolean {
  if (!Number.isInteger(time) || time < 0 || time > 2359) return false;
  const minutes = time % 100;
  return minutes >= 0 && minutes <= 59;
}
