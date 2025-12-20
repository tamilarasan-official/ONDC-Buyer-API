import { Injectable, Logger, BadRequestException, Optional, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { User } from "../../user/entities/user.entity";
import { UserAddress } from "../../user/entities/user-address.entity";
import { AppSettingsService } from "./app-settings.service";
import { DeliveryPricingService } from "./delivery-pricing.service";

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/reverse";
  private readonly GOOGLE_DIRECTIONS_API_URL = "https://maps.googleapis.com/maps/api/directions/json";

  // WGS84 ellipsoid constants for Vincenty's formulae
  private readonly WGS84_A = 6378137.0; // Semi-major axis in meters
  private readonly WGS84_F = 1 / 298.257223563; // Flattening
  private readonly WGS84_B = this.WGS84_A * (1 - this.WGS84_F); // Semi-minor axis

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    private readonly httpService: HttpService,
    private readonly appSettingsService: AppSettingsService,
    @Optional()
    @Inject(forwardRef(() => DeliveryPricingService))
    private readonly deliveryPricingService?: DeliveryPricingService,
  ) {}

  /**
   * Calculate distance between two points
   * Uses the method specified in app_settings (DISTANCE_CALCULATION_METHOD):
   * - "haversine": Uses Haversine formula (straight-line distance on sphere) - Default
   * - "vincenty": Uses Vincenty's formulae (straight-line distance on ellipsoid, more accurate)
   * - "euclidean": Uses Euclidean distance (flat Earth, only for very short distances < 1km)
   * - "directions_api": Uses Google Maps Directions API (road distance)
   * - "delivery_pricing_api": Uses Delivery Pricing API (road distance)
   * Falls back to Haversine if selected method fails
   * @param lat1 Latitude of first point
   * @param lng1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lng2 Longitude of second point
   * @returns Distance in kilometers
   */
  async calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): Promise<number> {
    try {
      // Get distance calculation method from app_settings
      // Valid values: "haversine", "vincenty", "euclidean", "directions_api", "delivery_pricing_api"
      const method = await this.appSettingsService.get(
        "DISTANCE_CALCULATION_METHOD",
        "haversine", // Default to Haversine formula
      );

      const normalizedMethod = method?.toLowerCase().trim() || "haversine";

      // Route to appropriate calculation method
      switch (normalizedMethod) {
        case "vincenty":
        case "vincentys":
          return this.calculateDistanceVincenty(lat1, lng1, lat2, lng2);

        case "euclidean":
        case "euclidean_distance":
          return this.calculateDistanceEuclidean(lat1, lng1, lat2, lng2);

        case "directions_api":
        case "directions":
        case "google_directions":
          const directionsDistance = await this.calculateDistanceWithDirectionsAPI(
            lat1,
            lng1,
            lat2,
            lng2,
          );
          if (directionsDistance !== null) {
            return directionsDistance;
          }
          this.logger.warn(
            `Google Directions API failed, falling back to Haversine for distance calculation`,
          );
          return this.calculateDistanceHaversine(lat1, lng1, lat2, lng2);

        case "delivery_pricing_api":
        case "delivery_pricing":
          const pricingDistance = await this.calculateDistanceWithDeliveryPricingAPI(
            lat1,
            lng1,
            lat2,
            lng2,
          );
          if (pricingDistance !== null) {
            return pricingDistance;
          }
          this.logger.warn(
            `Delivery Pricing API failed, falling back to Haversine for distance calculation`,
          );
          return this.calculateDistanceHaversine(lat1, lng1, lat2, lng2);

        case "haversine":
        default:
          // Use Haversine formula (default)
          return this.calculateDistanceHaversine(lat1, lng1, lat2, lng2);
      }
    } catch (error) {
      this.logger.error(
        `Error in calculateDistance, falling back to Haversine: ${error.message}`,
      );
      // Fall back to Haversine on any error
      return this.calculateDistanceHaversine(lat1, lng1, lat2, lng2);
    }
  }

  /**
   * Calculate distance using Google Maps Directions API
   * Returns road distance (driving distance) which is more accurate than straight-line distance
   * @param lat1 Latitude of first point (origin)
   * @param lng1 Longitude of first point (origin)
   * @param lat2 Latitude of second point (destination)
   * @param lng2 Longitude of second point (destination)
   * @returns Distance in kilometers, or null if API call fails
   */
  private async calculateDistanceWithDirectionsAPI(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): Promise<number | null> {
    try {
      // Get Google Maps API key from app_settings
      const apiKey = await this.appSettingsService.get("GOOGLE_MAPS_API_KEY");

      if (!apiKey) {
        this.logger.warn(
          "DISTANCE_CALCULATION_METHOD is set to 'directions_api' but GOOGLE_MAPS_API_KEY is not configured.",
        );
        return null;
      }

      const origin = `${lat1},${lng1}`;
      const destination = `${lat2},${lng2}`;

      this.logger.log(
        `📍 Calculating distance using Directions API: ${origin} → ${destination}`,
      );

      const response = await firstValueFrom(
        this.httpService.get(this.GOOGLE_DIRECTIONS_API_URL, {
          params: {
            origin,
            destination,
            key: apiKey,
            units: "metric", // Return distance in kilometers
          },
          timeout: 5000, // 5 seconds timeout
        }),
      );

      if (
        response.data?.status === "OK" &&
        response.data?.routes?.[0]?.legs?.[0]?.distance?.value
      ) {
        // Distance is returned in meters, convert to kilometers
        const distanceInMeters = response.data.routes[0].legs[0].distance.value;
        const distanceInKm = distanceInMeters / 1000;

        this.logger.log(
          `✅ Directions API distance: ${distanceInKm.toFixed(2)}km (${distanceInMeters}m)`,
        );
        return distanceInKm;
      } else {
        this.logger.warn(
          `Directions API returned status: ${response.data?.status || "UNKNOWN"}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Directions API error for distance calculation: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula (straight-line distance)
   * This is the default method and is also used in SQL queries
   * @param lat1 Latitude of first point
   * @param lng1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lng2 Longitude of second point
   * @returns Distance in kilometers
   */
  calculateDistanceHaversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate distance using Vincenty's inverse formulae (straight-line distance on ellipsoid)
   * More accurate than Haversine, accounts for Earth's ellipsoidal shape
   * Best for high-precision calculations over long distances
   * Uses WGS84 ellipsoid parameters
   * @param lat1 Latitude of first point (in degrees)
   * @param lng1 Longitude of first point (in degrees)
   * @param lat2 Latitude of second point (in degrees)
   * @param lng2 Longitude of second point (in degrees)
   * @returns Distance in kilometers
   */
  calculateDistanceVincenty(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const λ1 = this.toRadians(lng1);
    const λ2 = this.toRadians(lng2);

    const L = λ2 - λ1; // Difference in longitude
    const U1 = Math.atan((1 - this.WGS84_F) * Math.tan(φ1)); // Reduced latitude 1
    const U2 = Math.atan((1 - this.WGS84_F) * Math.tan(φ2)); // Reduced latitude 2

    const sinU1 = Math.sin(U1);
    const cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2);
    const cosU2 = Math.cos(U2);

    let λ = L;
    let λP = 2 * Math.PI;
    let iterationLimit = 100;
    let cosSqα = 0;
    let sinσ = 0;
    let cos2σM = 0;
    let cosσ = 0;
    let σ = 0;

    while (Math.abs(λ - λP) > 1e-12 && --iterationLimit > 0) {
      const sinλ = Math.sin(λ);
      const cosλ = Math.cos(λ);
      const sinSqσ =
        (cosU2 * sinλ) * (cosU2 * sinλ) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) *
          (cosU1 * sinU2 - sinU1 * cosU2 * cosλ);

      if (sinSqσ === 0) break; // Co-incident points

      sinσ = Math.sqrt(sinSqσ);
      cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
      σ = Math.atan2(sinσ, cosσ);
      const sinα = (cosU1 * cosU2 * sinλ) / sinσ;
      cosSqα = 1 - sinα * sinα;
      cos2σM = cosσ - (2 * sinU1 * sinU2) / cosSqα;

      if (isNaN(cos2σM)) cos2σM = 0; // Equatorial line

      const C =
        (this.WGS84_F / 16) *
        cosSqα *
        (4 + this.WGS84_F * (4 - 3 * cosSqα));
      λP = λ;
      λ =
        L +
        (1 - C) *
          this.WGS84_F *
          sinα *
          (σ +
            C *
              sinσ *
              (cos2σM +
                C * cosσ * (-1 + 2 * cos2σM * cos2σM)));
    }

    if (iterationLimit === 0) {
      // Failed to converge, fallback to Haversine
      this.logger.warn(
        `Vincenty's formula failed to converge, falling back to Haversine`,
      );
      return this.calculateDistanceHaversine(lat1, lng1, lat2, lng2);
    }

    const uSq = (cosSqα * (this.WGS84_A * this.WGS84_A - this.WGS84_B * this.WGS84_B)) / (this.WGS84_B * this.WGS84_B);
    const A =
      1 +
      (uSq / 16384) *
        (4096 +
          uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B =
      (uSq / 1024) *
      (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const Δσ =
      B *
      sinσ *
      (cos2σM +
        (B / 4) *
          (cosσ * (-1 + 2 * cos2σM * cos2σM) -
            (B / 6) *
              cos2σM *
              (-3 + 4 * sinσ * sinσ) *
              (-3 + 4 * cos2σM * cos2σM)));

    const s = this.WGS84_B * A * (σ - Δσ); // Distance in meters
    return s / 1000; // Convert to kilometers
  }

  /**
   * Calculate distance using Euclidean distance (flat Earth approximation)
   * Only accurate for very short distances (< 1km)
   * Simple and fast, but assumes Earth is flat
   * @param lat1 Latitude of first point
   * @param lng1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lng2 Longitude of second point
   * @returns Distance in kilometers
   */
  calculateDistanceEuclidean(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    // Average latitude for scaling
    const avgLat = this.toRadians((lat1 + lat2) / 2);

    // Convert latitude and longitude differences to kilometers
    // 1 degree latitude ≈ 111 km
    // 1 degree longitude ≈ 111 km * cos(latitude)
    const dLat = (lat2 - lat1) * 111.0; // km
    const dLng = (lng2 - lng1) * 111.0 * Math.cos(avgLat); // km

    // Euclidean distance
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  /**
   * Calculate distance using Delivery Pricing API (road distance)
   * Returns road distance from your delivery partner API
   * This uses your internal delivery pricing service which provides road distance
   * @param lat1 Latitude of first point (pickup)
   * @param lng1 Longitude of first point (pickup)
   * @param lat2 Latitude of second point (dropoff)
   * @param lng2 Longitude of second point (dropoff)
   * @returns Distance in kilometers, or null if API call fails
   */
  private async calculateDistanceWithDeliveryPricingAPI(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): Promise<number | null> {
    try {
      if (!this.deliveryPricingService) {
        this.logger.warn(
          "Delivery Pricing Service not available. Falling back to Haversine.",
        );
        return null;
      }

      this.logger.log(
        `📍 Calculating distance using Delivery Pricing API: pickup(${lat1}, ${lng1}) → dropoff(${lat2}, ${lng2})`,
      );

      // Use the delivery pricing service which now returns distance
      const deliveryInfo = await this.deliveryPricingService.getDeliveryCharge(
        lat1,
        lng1,
        lat2,
        lng2,
      );

      // Check if distance is available and valid
      if (deliveryInfo.distance && deliveryInfo.distance > 0) {
        this.logger.log(
          `✅ Delivery Pricing API distance: ${deliveryInfo.distance.toFixed(2)}km`,
        );
        return deliveryInfo.distance;
      } else {
        this.logger.warn(
          `Delivery Pricing API returned invalid distance: ${deliveryInfo.distance}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Delivery Pricing API error for distance calculation: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get user's location from JWT token
   * Priority: Default address > Most recent address > Device location
   */
  async getUserLocation(
    userId: number,
    deviceLat?: number,
    deviceLng?: number,
  ): Promise<{
    lat: number;
    lng: number;
    source: "default_address" | "recent_address" | "device_location";
    address?: UserAddress;
  }> {
    // Try to get default address first
    const defaultAddress = await this.userAddressRepository.findOne({
      where: { user: { id: userId }, is_default: true },
      order: { created_at: "DESC" },
    });

    if (defaultAddress) {
      return {
        lat: defaultAddress.latitude,
        lng: defaultAddress.longitude,
        source: "default_address",
        address: defaultAddress,
      };
    }

    // Try to get most recent address
    const recentAddress = await this.userAddressRepository.findOne({
      where: { user: { id: userId } },
      order: { created_at: "DESC" },
    });

    if (recentAddress) {
      return {
        lat: recentAddress.latitude,
        lng: recentAddress.longitude,
        source: "recent_address",
        address: recentAddress,
      };
    }

    // Fallback to device location
    if (deviceLat && deviceLng) {
      return {
        lat: deviceLat,
        lng: deviceLng,
        source: "device_location",
      };
    }

    // Default to Madurai if no location available
    return {
      lat: 9.93523,
      lng: 78.130404,
      source: "device_location",
    };
  }

  /**
   * Build Haversine formula SQL query for distance calculation
   * Note: This method always uses Haversine formula as SQL queries cannot call external APIs
   * For TypeScript code, use calculateDistance() which can use Directions API if configured in app_settings
   * This matches the calculateDistanceHaversine() method exactly
   * More accurate than Spherical Law of Cosines, especially for small distances
   *
   * Formula: d = R * 2 * atan2(√a, √(1-a))
   * where a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
   */
  buildDistanceQuery(
    userLat: number,
    userLng: number,
    radiusKm: number = 10,
  ): string {
    // Calculate the Haversine 'a' value once and reuse
    const dLat = `radians(sl.gps_lat - ${userLat})`;
    const dLng = `radians(sl.gps_lng - ${userLng})`;
    const sinDLatHalf = `sin(${dLat} / 2)`;
    const sinDLngHalf = `sin(${dLng} / 2)`;
    const cosUserLat = `cos(radians(${userLat}))`;
    const cosStoreLat = `cos(radians(sl.gps_lat))`;

    // Haversine 'a' component
    const haversineA = `(
      ${sinDLatHalf} * ${sinDLatHalf} +
      ${cosUserLat} * ${cosStoreLat} *
      ${sinDLngHalf} * ${sinDLngHalf}
    )`;

    return `
      (6371 * 2 * atan2(
        sqrt(${haversineA}),
        sqrt(1 - ${haversineA})
      )) AS distance
    `;
  }

  /**
   * Build distance filter for WHERE clause using Haversine formula
   * Note: This method always uses Haversine formula as SQL queries cannot call external APIs
   * For TypeScript code, use calculateDistance() which can use Directions API if configured in app_settings
   * This matches the calculateDistanceHaversine() method exactly
   * More accurate than Spherical Law of Cosines, especially for small distances
   *
   * Formula: d = R * 2 * atan2(√a, √(1-a))
   * where a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
   */
  buildDistanceFilter(
    userLat: number,
    userLng: number,
    radiusKm: number = 10,
  ): string {
    // Calculate the Haversine 'a' value once and reuse
    const dLat = `radians(sl.gps_lat - ${userLat})`;
    const dLng = `radians(sl.gps_lng - ${userLng})`;
    const sinDLatHalf = `sin(${dLat} / 2)`;
    const sinDLngHalf = `sin(${dLng} / 2)`;
    const cosUserLat = `cos(radians(${userLat}))`;
    const cosStoreLat = `cos(radians(sl.gps_lat))`;

    // Haversine 'a' component
    const haversineA = `(
      ${sinDLatHalf} * ${sinDLatHalf} +
      ${cosUserLat} * ${cosStoreLat} *
      ${sinDLngHalf} * ${sinDLngHalf}
    )`;

    return `
      (6371 * 2 * atan2(
        sqrt(${haversineA}),
        sqrt(1 - ${haversineA})
      )) <= ${radiusKm}
    `;
  }

  /**
   * Reverse geocode coordinates to get address components
   * Uses OpenStreetMap Nominatim API (free, no API key required)
   * @param latitude Latitude coordinate
   * @param longitude Longitude coordinate
   * @returns Address components from reverse geocoding
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<{
    city?: string;
    state?: string;
    pincode?: string;
    address?: string;
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.NOMINATIM_API_URL, {
          params: {
            lat: latitude,
            lon: longitude,
            format: "json",
            addressdetails: 1,
            zoom: 18,
          },
          headers: {
            "User-Agent": "ONDC-Buyer-API/1.0", // Required by Nominatim
          },
          timeout: 5000, // 5 seconds timeout
        }),
      );

      if (!response.data || !response.data.address) {
        this.logger.warn(
          `Reverse geocoding returned no address data for coordinates (${latitude}, ${longitude})`,
        );
        return {};
      }

      const address = response.data.address;
      return {
        city: address.city || address.town || address.village || address.county,
        state: address.state,
        pincode: address.postcode,
        address: response.data.display_name,
      };
    } catch (error) {
      this.logger.error(
        `Reverse geocoding failed for coordinates (${latitude}, ${longitude}): ${error.message}`,
      );
      // Return empty object on failure - don't block address creation
      return {};
    }
  }

  /**
   * Validate that latitude and longitude match the provided text address
   * Compares city, state, and pincode from reverse geocoding with provided address
   * @param latitude Latitude coordinate
   * @param longitude Longitude coordinate
   * @param addressCity City from user-provided address
   * @param addressState State from user-provided address
   * @param addressPincode Pincode from user-provided address
   * @returns true if address matches, false otherwise
   */
  async validateCoordinatesMatchAddress(
    latitude: number,
    longitude: number,
    addressCity: string,
    addressState: string,
    addressPincode: string,
  ): Promise<{ isValid: boolean; message?: string; geocodedAddress?: any }> {
    try {
      const geocoded = await this.reverseGeocode(latitude, longitude);

      // If reverse geocoding failed, allow the address (don't block on API failure)
      if (!geocoded.city && !geocoded.state && !geocoded.pincode) {
        this.logger.warn(
          `Reverse geocoding failed, allowing address validation to pass`,
        );
        return { isValid: true };
      }

      // Normalize strings for comparison (case-insensitive, trim whitespace)
      const normalize = (str: string) =>
        (str || "").toLowerCase().trim().replace(/\s+/g, " ");

      const providedCity = normalize(addressCity);
      const providedState = normalize(addressState);
      const providedPincode = normalize(addressPincode);

      const geocodedCity = normalize(geocoded.city || "");
      const geocodedState = normalize(geocoded.state || "");
      const geocodedPincode = normalize(geocoded.pincode || "");

      // Check if city matches (allow partial matches)
      const cityMatch =
        geocodedCity.includes(providedCity) ||
        providedCity.includes(geocodedCity) ||
        geocodedCity === providedCity;

      // Check if state matches (exact or partial)
      const stateMatch =
        geocodedState.includes(providedState) ||
        providedState.includes(geocodedState) ||
        geocodedState === providedState;

      // Check if pincode matches (exact match required)
      const pincodeMatch =
        geocodedPincode === providedPincode ||
        (geocodedPincode && providedPincode && geocodedPincode.includes(providedPincode));

      // Require at least 2 out of 3 matches (city, state, pincode)
      const matchCount = [cityMatch, stateMatch, pincodeMatch].filter(Boolean).length;

      if (matchCount >= 2) {
        return {
          isValid: true,
          geocodedAddress: geocoded,
        };
      }

      return {
        isValid: false,
        message: `The provided coordinates (${latitude}, ${longitude}) do not match the address. ` +
          `Expected: ${addressCity}, ${addressState} ${addressPincode}. ` +
          `Found: ${geocoded.city || "N/A"}, ${geocoded.state || "N/A"} ${geocoded.pincode || "N/A"}`,
        geocodedAddress: geocoded,
      };
    } catch (error) {
      this.logger.error(
        `Address validation failed: ${error.message}`,
        error.stack,
      );
      // On error, allow the address (don't block on validation failure)
      return { isValid: true };
    }
  }
}
