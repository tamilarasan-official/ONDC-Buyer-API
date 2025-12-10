import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { UserAddress } from "../../user/entities/user-address.entity";

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
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
}
