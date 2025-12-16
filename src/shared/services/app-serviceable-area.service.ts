import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppSettingsService } from "./app-settings.service";
import { LocationService } from "./location.service";

export interface AppServiceableAreaStatus {
  isServiceable: boolean;
  reason?: string;
  distance?: number;
  maxRadius?: number;
  message?: string;
}

@Injectable()
export class AppServiceableAreaService {
  private readonly logger = new Logger(AppServiceableAreaService.name);

  constructor(
    private readonly appSettingsService: AppSettingsService,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Check if a location is within app serviceable area
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @returns AppServiceableAreaStatus with isServiceable flag and details
   */
  async checkServiceableArea(
    latitude: number,
    longitude: number,
  ): Promise<AppServiceableAreaStatus> {
    try {
      // Check if serviceable area restriction is enabled
      const serviceableAreaEnabled = await this.appSettingsService.getBoolean(
        "APP_SERVICEABLE_AREA_ENABLED",
        false,
      );

      if (!serviceableAreaEnabled) {
        // Serviceable area not enabled - all locations are serviceable
        return {
          isServiceable: true,
          reason: "AREA_NOT_ENABLED",
          message: "Serviceable area restriction not configured",
        };
      }

      // Get serviceable area center point
      const centerLatStr = await this.appSettingsService.get(
        "APP_SERVICEABLE_AREA_CENTER_LAT",
        "",
      ) || "";
      const centerLngStr = await this.appSettingsService.get(
        "APP_SERVICEABLE_AREA_CENTER_LNG",
        "",
      ) || "";
      const radiusKmStr = await this.appSettingsService.get(
        "APP_SERVICEABLE_AREA_RADIUS_KM",
        "5", // Default 5 km
      ) || "5";

      if (!centerLatStr || !centerLngStr) {
        // No center point configured - all locations are serviceable
        this.logger.warn(
          "⚠️ APP_SERVICEABLE_AREA_ENABLED is true but center coordinates are not configured. All locations will be treated as serviceable.",
        );
        return {
          isServiceable: true,
          reason: "NO_CENTER_CONFIGURED",
          message: "Serviceable area center not configured",
        };
      }

      const centerLat = parseFloat(centerLatStr);
      const centerLng = parseFloat(centerLngStr);
      const radiusKm = parseFloat(radiusKmStr) || 5; // Default 5 km

      // Validate parsed coordinates
      if (isNaN(centerLat) || isNaN(centerLng)) {
        this.logger.error(
          `Invalid center coordinates: lat=${centerLatStr}, lng=${centerLngStr}`,
        );
        return {
          isServiceable: true,
          reason: "INVALID_CONFIG",
          message: "Invalid serviceable area configuration",
        };
      }

      // Validate coordinate ranges
      if (
        centerLat < -90 ||
        centerLat > 90 ||
        centerLng < -180 ||
        centerLng > 180
      ) {
        this.logger.error(
          `Center coordinates out of range: lat=${centerLat}, lng=${centerLng}`,
        );
        return {
          isServiceable: true,
          reason: "INVALID_CONFIG",
          message: "Invalid serviceable area configuration",
        };
      }

      // Calculate distance from center point to user location
      const distance = this.locationService.calculateDistance(
        centerLat,
        centerLng,
        latitude,
        longitude,
      );

      this.logger.log(
        `📍 Checking serviceable area: user(${latitude}, ${longitude}), center(${centerLat}, ${centerLng}), distance=${distance.toFixed(2)}km, radius=${radiusKm}km`,
      );

      if (distance > radiusKm) {
        this.logger.log(
          `❌ Location is outside serviceable area. Distance: ${distance.toFixed(2)}km, Max radius: ${radiusKm}km`,
        );

        return {
          isServiceable: false,
          reason: "OUTSIDE_SERVICEABLE_AREA",
          distance: Number(distance.toFixed(2)),
          maxRadius: radiusKm,
          message: `Service is not available at this location. We currently serve within ${radiusKm}km radius. Your location is ${distance.toFixed(2)}km away.`,
        };
      }

      this.logger.log(
        `✅ Location is within serviceable area (${distance.toFixed(2)}km from center)`,
      );
      return {
        isServiceable: true,
        reason: "WITHIN_AREA",
        distance: Number(distance.toFixed(2)),
        maxRadius: radiusKm,
        message: "Location is within serviceable area",
      };
    } catch (error) {
      this.logger.error(
        `❌ Error checking serviceable area: ${error.message}`,
        error.stack,
      );
      // On error, default to serviceable for safety (don't block orders)
      return {
        isServiceable: true,
        reason: "ERROR",
        message: "Unable to determine serviceable area status",
      };
    }
  }

  /**
   * Validate if location is serviceable and throw error if not
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @throws ServiceUnavailableException (503) if location is outside serviceable area
   */
  async validateServiceableArea(
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const status = await this.checkServiceableArea(latitude, longitude);
    if (!status.isServiceable) {
      throw new ServiceUnavailableException(
        status.message ||
          "Service is not available at this location. Please try a different address.",
      );
    }
  }
}

