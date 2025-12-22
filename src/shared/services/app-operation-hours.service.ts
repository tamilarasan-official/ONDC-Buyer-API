import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppSettingsService } from "./app-settings.service";
import { TimezoneUtil } from "../utils/timezone.util";

export interface AppOperationStatus {
  isOpen: boolean;
  reason?: string;
  nextOpenTime?: string;
  message?: string;
}

@Injectable()
export class AppOperationHoursService {
  private readonly logger = new Logger(AppOperationHoursService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  /**
   * Check if app is currently accepting orders based on app operation hours
   * This is separate from restaurant timings - it's a global app-level control
   * @returns AppOperationStatus with isOpen flag and details
   */
  async checkAppOperationStatus(): Promise<AppOperationStatus> {
    try {
      // Check if app operation hours are enabled
      const appHoursEnabled = await this.appSettingsService.getBoolean(
        "APP_OPERATION_HOURS_ENABLED",
        false,
      );

      if (!appHoursEnabled) {
        // App hours not enabled - app is always open
        return {
          isOpen: true,
          reason: "HOURS_NOT_ENABLED",
          message: "App operation hours not configured",
        };
      }

      // Use IST timezone for all time calculations
      const currentDay = TimezoneUtil.getCurrentISTDay(); // Monday=1, ..., Saturday=6, Sunday=7
      const currentTime = TimezoneUtil.getCurrentISTTimeHHMM(); // HHMM format

      this.logger.log(
        `🕐 Checking app operation status - IST Day: ${currentDay}, Time: ${currentTime} (${TimezoneUtil.formatTimeHHMM(currentTime)})`,
      );

      // Get app operation hours from database
      // Format: "0900-2200" (24-hour format, HHMM-HHMM)
      // Same hours for all days (Mon-Sun)
      const appHoursConfig = await this.appSettingsService.get(
        "APP_OPERATION_HOURS",
        "",
      );

      if (!appHoursConfig || appHoursConfig.trim() === "") {
        // No hours configured - app is always open
        this.logger.warn(
          "⚠️ APP_OPERATION_HOURS_ENABLED is true but APP_OPERATION_HOURS is not configured. App will be treated as always open.",
        );
        return {
          isOpen: true,
          reason: "NO_HOURS_CONFIGURED",
          message: "App operation hours not configured",
        };
      }

      // Parse hours configuration
      // Format: "0900-2200" (openTime-closeTime)
      const timeRange = appHoursConfig.trim().split("-");

      if (timeRange.length !== 2) {
        this.logger.error(
          `Invalid APP_OPERATION_HOURS format: ${appHoursConfig}. Expected format: "0900-2200"`,
        );
        return {
          isOpen: true,
          reason: "INVALID_CONFIG",
          message: "Invalid app operation hours configuration",
        };
      }

      const openTime = parseInt(timeRange[0].trim(), 10);
      const closeTime = parseInt(timeRange[1].trim(), 10);

      // Validate parsed times
      if (isNaN(openTime) || isNaN(closeTime)) {
        this.logger.error(
          `Invalid time values in APP_OPERATION_HOURS: openTime=${timeRange[0]}, closeTime=${timeRange[1]}`,
        );
        return {
          isOpen: true,
          reason: "INVALID_CONFIG",
          message: "Invalid app operation hours configuration",
        };
      }

      // Validate time format (should be 4 digits, 0000-2359)
      if (
        openTime < 0 ||
        openTime > 2359 ||
        closeTime < 0 ||
        closeTime > 2359
      ) {
        this.logger.error(
          `Time values out of range in APP_OPERATION_HOURS: openTime=${openTime}, closeTime=${closeTime}. Valid range: 0000-2359`,
        );
        return {
          isOpen: true,
          reason: "INVALID_CONFIG",
          message: "Invalid app operation hours configuration",
        };
      }

      // Check if currently within operating hours
      let isWithinHours = false;
      if (closeTime < openTime) {
        // Handle overnight operations (e.g., 2300 to 0200)
        isWithinHours = currentTime >= openTime || currentTime <= closeTime;
      } else {
        // Normal operations (e.g., 0900 to 2200)
        isWithinHours = currentTime >= openTime && currentTime <= closeTime;
      }

      if (!isWithinHours) {
        const openTimeFormatted = TimezoneUtil.formatTimeHHMM(openTime);
        const closeTimeFormatted = TimezoneUtil.formatTimeHHMM(closeTime);

        this.logger.log(
          `❌ App is closed. Current time: ${TimezoneUtil.formatTimeHHMM(currentTime)}, App hours: ${openTimeFormatted} - ${closeTimeFormatted}`,
        );

        // Check for custom closure message from app settings
        const customClosureMessage = await this.appSettingsService.get(
          "APP_CLOSURE_MESSAGE",
          "",
        );

        let closureMessage: string;

        if (customClosureMessage && customClosureMessage.trim() !== "") {
          // Use custom message if available and not empty
          closureMessage = customClosureMessage.trim();
          this.logger.log(
            `📝 Using custom app closure message: ${closureMessage}`,
          );
        } else {
          // Use default message with next open time
          // Format next open time for user-friendly message
          // Extract hours and format as "8 AM" or "8:00 AM"
          const nextOpenHours = Math.floor(openTime / 100);
          const nextOpenMinutes = openTime % 100;
          let nextOpenTimeDisplay = "";
          
          if (nextOpenMinutes === 0) {
            // No minutes, just show hour (e.g., "8 AM")
            const displayHour = nextOpenHours > 12 ? nextOpenHours - 12 : nextOpenHours === 0 ? 12 : nextOpenHours;
            const period = nextOpenHours >= 12 ? "PM" : "AM";
            nextOpenTimeDisplay = `${displayHour} ${period}`;
          } else {
            // Has minutes, show full time (e.g., "8:30 AM")
            const displayHour = nextOpenHours > 12 ? nextOpenHours - 12 : nextOpenHours === 0 ? 12 : nextOpenHours;
            const period = nextOpenHours >= 12 ? "PM" : "AM";
            nextOpenTimeDisplay = `${displayHour}:${nextOpenMinutes.toString().padStart(2, "0")} ${period}`;
          }

          closureMessage = `Restaurants not accepting orders right now. Ordering will be available again at ${nextOpenTimeDisplay}.`;
        }

        return {
          isOpen: false,
          reason: "OUTSIDE_OPERATING_HOURS",
          nextOpenTime: openTime.toString().padStart(4, "0"),
          message: closureMessage,
        };
      }

      this.logger.log(`✅ App is open`);
      return {
        isOpen: true,
        reason: "OPEN",
        message: "App is currently accepting orders",
      };
    } catch (error) {
      this.logger.error(
        `❌ Error checking app operation status: ${error.message}`,
        error.stack,
      );
      // On error, default to open for safety (don't block orders)
      return {
        isOpen: true,
        reason: "ERROR",
        message: "Unable to determine app operation status",
      };
    }
  }

  /**
   * Validate if app is open and throw error if closed
   * @throws ServiceUnavailableException (503) if app is closed
   */
  async validateAppIsOpen(): Promise<void> {
    const status = await this.checkAppOperationStatus();
    if (!status.isOpen) {
      throw new ServiceUnavailableException(
        status.message ||
          "App is currently closed. Please try again during operating hours.",
      );
    }
  }
}

