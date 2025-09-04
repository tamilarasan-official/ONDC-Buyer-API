import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserAddress } from '../../user/entities/user-address.entity';

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
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
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
  async getUserLocation(userId: number, deviceLat?: number, deviceLng?: number): Promise<{
    lat: number;
    lng: number;
    source: 'default_address' | 'recent_address' | 'device_location';
    address?: UserAddress;
  }> {
    // Try to get default address first
    const defaultAddress = await this.userAddressRepository.findOne({
      where: { user: { id: userId }, is_default: true },
      order: { created_at: 'DESC' }
    });

    if (defaultAddress) {
      return {
        lat: defaultAddress.latitude,
        lng: defaultAddress.longitude,
        source: 'default_address',
        address: defaultAddress
      };
    }

    // Try to get most recent address
    const recentAddress = await this.userAddressRepository.findOne({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' }
    });

    if (recentAddress) {
      return {
        lat: recentAddress.latitude,
        lng: recentAddress.longitude,
        source: 'recent_address',
        address: recentAddress
      };
    }

    // Fallback to device location
    if (deviceLat && deviceLng) {
      return {
        lat: deviceLat,
        lng: deviceLng,
        source: 'device_location'
      };
    }

    // Default to Bangalore if no location available
    return {
      lat: 12.9716,
      lng: 77.5946,
      source: 'device_location'
    };
  }

  /**
   * Build Haversine formula SQL query for distance calculation
   */
  buildDistanceQuery(userLat: number, userLng: number, radiusKm: number = 10): string {
    return `
      (6371 * acos(
        cos(radians(${userLat})) * 
        cos(radians(sl.gps_lat)) * 
        cos(radians(sl.gps_lng) - radians(${userLng})) + 
        sin(radians(${userLat})) * 
        sin(radians(sl.gps_lat))
      )) AS distance
    `;
  }

  /**
   * Build distance filter for WHERE clause
   */
  buildDistanceFilter(userLat: number, userLng: number, radiusKm: number = 10): string {
    return `
      (6371 * acos(
        cos(radians(${userLat})) * 
        cos(radians(sl.gps_lat)) * 
        cos(radians(sl.gps_lng) - radians(${userLng})) + 
        sin(radians(${userLat})) * 
        sin(radians(sl.gps_lat))
      )) <= ${radiusKm}
    `;
  }
}
