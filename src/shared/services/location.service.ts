import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { User } from "../../user/entities/user.entity";
import { UserAddress } from "../../user/entities/user-address.entity";

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/reverse";

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Latitude of first point
   * @param lng1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lng2 Longitude of second point
   * @returns Distance in kilometers
   */
  calculateDistance(
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
   * This matches the TypeScript calculateDistance() method exactly
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
   * This matches the TypeScript calculateDistance() method exactly
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
