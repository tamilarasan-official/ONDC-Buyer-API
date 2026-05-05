import { TimezoneUtil } from "../utils/timezone.util";

/** DB: 1=Monday … 7=Sunday → API display: 1=Sunday … 7=Saturday */
export function convertDbDayToDisplayDay(dbDay: number): number {
  return dbDay === 7 ? 1 : dbDay + 1;
}

/** API display: 1=Sunday … 7=Saturday → DB: 1=Monday … 7=Sunday */
export function convertDisplayDayToDbDay(displayDay: number): number {
  return displayDay === 1 ? 7 : displayDay - 1;
}

/** JS getUTCDay: 0=Sun … 6=Sat → API display: 1=Sunday … 7=Saturday */
export function convertJsDayToDisplayDay(jsDay: number): number {
  return jsDay === 0 ? 1 : jsDay + 1;
}

export type StoreTimingLike = {
  day_from: number;
  day_to: number;
  time_from: string;
  time_to: string;
};

export type ExpandedStoreTimingDay = {
  day: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
};

/**
 * Display-format day range (1=Sun … 7=Sat), no wrap: current day must fall between dayFrom and dayTo inclusive.
 */
export function checkTimingAvailabilityDisplay(
  dayFrom: number,
  dayTo: number,
  timeFrom: string,
  timeTo: string,
  currentDayDisplay: number,
  currentTime: number,
): boolean {
  const isDayInRange = currentDayDisplay >= dayFrom && currentDayDisplay <= dayTo;
  if (!isDayInRange) {
    return false;
  }
  const openTime = parseInt(timeFrom, 10);
  const closeTime = parseInt(timeTo, 10);
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Expand store timing rows (DB day format) into per-display-day rows with `is_open`
 * aligned with restaurant details (today in display format + close/holiday flags).
 */
export function expandStoreTimingsToDisplayDays(
  timings: StoreTimingLike[],
  hasActiveCloseTiming: boolean = false,
  isHolidayToday: boolean = false,
): ExpandedStoreTimingDay[] {
  const expandedTimings: ExpandedStoreTimingDay[] = [];
  const now = TimezoneUtil.getCurrentISTTime();
  const jsDay = now.getUTCDay();
  const currentDayDisplay = convertJsDayToDisplayDay(jsDay);
  const currentTime = now.getUTCHours() * 100 + now.getUTCMinutes();

  for (const timing of timings) {
    const dayFromDb = timing.day_from;
    const dayToDb = timing.day_to;
    const daysDb: number[] = [];

    if (dayFromDb <= dayToDb) {
      for (let day = dayFromDb; day <= dayToDb; day++) {
        daysDb.push(day);
      }
    } else {
      for (let day = dayFromDb; day <= 7; day++) {
        daysDb.push(day);
      }
      for (let day = 1; day <= dayToDb; day++) {
        daysDb.push(day);
      }
    }

    for (const dayDb of daysDb) {
      const dayDisplay = convertDbDayToDisplayDay(dayDb);
      let isOpen = false;
      if (
        dayDisplay === currentDayDisplay &&
        !hasActiveCloseTiming &&
        !isHolidayToday
      ) {
        const openTime = parseInt(timing.time_from, 10);
        const closeTime = parseInt(timing.time_to, 10);
        if (closeTime < openTime) {
          isOpen = currentTime >= openTime || currentTime <= closeTime;
        } else {
          isOpen = currentTime >= openTime && currentTime <= closeTime;
        }
      }
      expandedTimings.push({
        day: dayDisplay,
        open_time: timing.time_from,
        close_time: timing.time_to,
        is_open: isOpen,
      });
    }
  }

  return expandedTimings.sort((a, b) => a.day - b.day);
}
