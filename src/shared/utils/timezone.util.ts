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
   * 
   * IMPORTANT: This method returns a Date object that represents the current IST time.
   * When comparing with database TIMESTAMPTZ fields:
   * - Database stores timestamps in UTC
   * - This method returns current time adjusted to IST (UTC+5:30)
   * - JavaScript Date comparisons work on UTC milliseconds internally
   * - So we need to ensure the comparison accounts for the timezone difference
   * 
   * For proper comparison with database TIMESTAMPTZ, we convert current UTC time
   * to IST representation, then create a Date object that when compared will work correctly.
   */
  public static getCurrentISTTime(): Date {
    // IMPORTANT: This method returns a Date object representing current IST time.
    // 
    // How it works:
    // 1. PostgreSQL TIMESTAMPTZ always stores timestamps in UTC internally
    // 2. TypeORM retrieves TIMESTAMPTZ as Date objects (UTC internally)
    // 3. JavaScript Date objects are always UTC internally (milliseconds since epoch)
    // 4. When comparing Date objects, JavaScript compares UTC milliseconds
    //
    // The issue: If timestamps were entered as IST without timezone info when database
    // was GMT, they may have been stored incorrectly. However, if database is now UTC
    // and timestamps are entered WITH timezone info (e.g., "2025-12-12T12:00:00+05:30"),
    // PostgreSQL will correctly convert to UTC.
    //
    // For comparison: We need to compare current IST time with database timestamps.
    // Since database stores UTC internally, we get current UTC time and adjust for IST.
    // But actually, we want to compare IST times, so we convert current time to IST
    // representation and compare with database timestamp (which is UTC but represents IST).
    
    const now = new Date(); // Current UTC time
    
    // Get IST time components
    const istFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    
    const parts = istFormatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === "year")!.value);
    const month = parseInt(parts.find(p => p.type === "month")!.value);
    const day = parseInt(parts.find(p => p.type === "day")!.value);
    const hour = parseInt(parts.find(p => p.type === "hour")!.value);
    const minute = parseInt(parts.find(p => p.type === "minute")!.value);
    const second = parseInt(parts.find(p => p.type === "second")!.value);
    
    // Create Date object from IST components
    // This represents IST time but stored as UTC internally
    // When compared with database Date objects (also UTC internally), 
    // JavaScript will compare UTC milliseconds correctly
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  /**
   * Get current day of week in IST timezone
   * @returns Day number (1=Monday, 2=Tuesday, ..., 6=Saturday, 7=Sunday)
   * 
   * IMPORTANT: Since getCurrentISTTime() stores IST time as UTC internally,
   * we must use getUTCDay() to get the correct day of week.
   */
  public static getCurrentISTDay(): number {
    const istTime = this.getCurrentISTTime();
    const jsDay = istTime.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert JavaScript's getDay() (0=Sunday, 6=Saturday) to database format (1=Monday, 7=Sunday)
    return jsDay === 0 ? 7 : jsDay;
  }

  /**
   * Get current time in HHMM format (IST timezone)
   * @returns Time as number in HHMM format (e.g., 1430 for 2:30 PM)
   * 
   * IMPORTANT: Since getCurrentISTTime() stores IST time as UTC internally,
   * we must use getUTCHours() and getUTCMinutes() to get the correct IST time.
   */
  public static getCurrentISTTimeHHMM(): number {
    const istTime = this.getCurrentISTTime();
    // Use UTC methods because getCurrentISTTime() stores IST time as UTC
    return istTime.getUTCHours() * 100 + istTime.getUTCMinutes();
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

    // IMPORTANT: Since getCurrentISTTime() stores IST time as UTC internally,
    // we must use UTC methods to get the correct IST time components
    const hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const seconds = istDate.getUTCSeconds();

    return {
      date: istDate,
      year: istDate.getUTCFullYear(),
      month: istDate.getUTCMonth() + 1, // 1-12
      day: istDate.getUTCDate(),
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      dayOfWeek: jsDay === 0 ? 7 : jsDay,
      timeHHMM: hours * 100 + minutes,
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
