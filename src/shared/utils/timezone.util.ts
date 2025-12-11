/**
 * Timezone Utility
 *
 * Centralized timezone configuration for the entire application.
 * All date/time operations should use this utility to ensure consistency.
 *
 * Default timezone: Asia/Kolkata (IST - Indian Standard Time, UTC+5:30)
 */

export class TimezoneUtil {
  /**
   * Application timezone - IST (Indian Standard Time)
   */
  public static readonly TIMEZONE = "Asia/Kolkata";

  /**
   * Timezone offset in minutes from UTC
   * IST is UTC+5:30, which is 330 minutes ahead of UTC
   */
  public static readonly TIMEZONE_OFFSET_MINUTES = 330;

  /**
   * Get current date and time in IST timezone
   * @returns Date object representing current IST time
   */
  public static getCurrentISTTime(): Date {
    const now = new Date();
    // Convert to IST by using toLocaleString with Asia/Kolkata timezone
    const istTimeString = now.toLocaleString("en-US", {
      timeZone: this.TIMEZONE,
    });
    return new Date(istTimeString);
  }

  /**
   * Get current day of week in IST timezone
   * @returns Day number (1=Monday, 2=Tuesday, ..., 6=Saturday, 7=Sunday)
   */
  public static getCurrentISTDay(): number {
    const istTime = this.getCurrentISTTime();
    const jsDay = istTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert JavaScript's getDay() (0=Sunday, 6=Saturday) to database format (1=Monday, 7=Sunday)
    return jsDay === 0 ? 7 : jsDay;
  }

  /**
   * Get current time in HHMM format (IST timezone)
   * @returns Time as number in HHMM format (e.g., 1430 for 2:30 PM)
   */
  public static getCurrentISTTimeHHMM(): number {
    const istTime = this.getCurrentISTTime();
    return istTime.getHours() * 100 + istTime.getMinutes();
  }

  /**
   * Convert any date to IST timezone
   * @param date - Date to convert
   * @returns Date object in IST timezone
   */
  public static toIST(date: Date): Date {
    const istTimeString = date.toLocaleString("en-US", {
      timeZone: this.TIMEZONE,
    });
    return new Date(istTimeString);
  }

  /**
   * Get date components in IST timezone
   * @param date - Optional date (defaults to current time)
   * @returns Object with IST date components
   */
  public static getISTComponents(date?: Date): {
    date: Date;
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
    dayOfWeek: number; // 1=Monday, 7=Sunday
    timeHHMM: number; // HHMM format
  } {
    const istDate = date ? this.toIST(date) : this.getCurrentISTTime();
    const jsDay = istDate.getDay();

    return {
      date: istDate,
      year: istDate.getFullYear(),
      month: istDate.getMonth() + 1, // 1-12
      day: istDate.getDate(),
      hours: istDate.getHours(),
      minutes: istDate.getMinutes(),
      seconds: istDate.getSeconds(),
      dayOfWeek: jsDay === 0 ? 7 : jsDay,
      timeHHMM: istDate.getHours() * 100 + istDate.getMinutes(),
    };
  }

  /**
   * Format time in HHMM format to readable string
   * @param timeHHMM - Time in HHMM format (e.g., 1430)
   * @returns Formatted time string (e.g., "2:30 PM")
   */
  public static formatTimeHHMM(timeHHMM: number): string {
    const hours = Math.floor(timeHHMM / 100);
    const minutes = timeHHMM % 100;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }

  /**
   * Check if current IST time falls within a time range
   * @param openTime - Opening time in HHMM format
   * @param closeTime - Closing time in HHMM format
   * @returns true if current time is within the range
   */
  public static isWithinTimeRange(
    openTime: number,
    closeTime: number,
  ): boolean {
    const currentTime = this.getCurrentISTTimeHHMM();

    if (closeTime < openTime) {
      // Handle overnight operations (e.g., 2300 to 0200)
      return currentTime >= openTime || currentTime <= closeTime;
    } else {
      // Normal operations (e.g., 0900 to 2100)
      return currentTime >= openTime && currentTime <= closeTime;
    }
  }

  /**
   * Get formatted current IST time for logging
   * @returns Formatted string (e.g., "2025-11-06 14:30:45 IST")
   */
  public static getFormattedISTTime(): string {
    const components = this.getISTComponents();
    return `${components.year}-${components.month.toString().padStart(2, "0")}-${components.day.toString().padStart(2, "0")} ${components.hours.toString().padStart(2, "0")}:${components.minutes.toString().padStart(2, "0")}:${components.seconds.toString().padStart(2, "0")} IST`;
  }
}
