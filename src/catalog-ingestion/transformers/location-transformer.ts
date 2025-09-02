import { BaseTransformer } from './base-transformer';
import { StoreLocation } from '../../store/entities/store-location.entity';
import { Store } from '../../store/entities/store.entity';
import { Location } from '../../ondc-search/dto/ondc-search.dto';

/**
 * Store Location data transformer with validation and sanitization
 */
export class LocationTransformer extends BaseTransformer {
  
  /**
   * Transform ONDC Location data to StoreLocation entity
   */
  transform(locationData: Location, store: Store, existingLocation?: StoreLocation): StoreLocation {
    const location = existingLocation || new StoreLocation();
    
    try {
      // Basic location information
      location.reference_id = this.sanitizeString(locationData.id, 255);
      location.store = store;
      
      // Parse and validate GPS coordinates
      const gpsCoords = this.parseGpsCoordinates(locationData.gps);
      if (gpsCoords) {
        location.gps_lat = gpsCoords.lat;
        location.gps_lng = gpsCoords.lng;
      } else {
        this.logWarning(`Invalid GPS coordinates for location ${locationData.id}: ${locationData.gps}`);
        // Set default coordinates (you might want to handle this differently)
        location.gps_lat = 0;
        location.gps_lng = 0;
      }
      
      // Address information
      if (locationData.address) {
        location.address_locality = this.sanitizeString(locationData.address.locality, 255);
        location.address_street = this.sanitizeString(locationData.address.street, 255);
        location.address_city = this.sanitizeString(locationData.address.city, 100);
        location.address_area_code = this.sanitizeString(locationData.address.area_code, 10);
        location.address_state = this.sanitizeString(locationData.address.state, 5);
      }
      
      // Delivery radius information
      if (locationData.circle?.radius) {
        location.delivery_radius_km = this.parseFloat(locationData.circle.radius.value);
        location.delivery_radius_unit = this.sanitizeString(locationData.circle.radius.unit, 10, 'km');
      }
      
      // Parse timing information
      this.parseLocationTiming(locationData, location);
      
      location.status = true;
      
      this.logger.log(`Transformed location: ${location.reference_id} at ${location.gps_lat},${location.gps_lng}`);
      
      return location;
      
    } catch (error) {
      this.logError(`Failed to transform location ${locationData.id}`, error);
      throw new Error(`Location transformation failed: ${error.message}`);
    }
  }
  
  /**
   * Parse timing information from location data
   */
  private parseLocationTiming(locationData: Location, location: StoreLocation): void {
    if (!locationData.time) {
      return;
    }
    
    // Parse days of week
    if (locationData.time.days) {
      location.days_of_week = this.sanitizeDaysOfWeek(locationData.time.days);
    }
    
    // Parse schedule holidays
    if (locationData.time.schedule?.holidays) {
      location.schedule_holidays = this.sanitizeHolidays(locationData.time.schedule.holidays);
    }
  }
  
  /**
   * Sanitize days of week string
   */
  private sanitizeDaysOfWeek(days: string): string {
    if (!days || typeof days !== 'string') {
      return '';
    }
    
    // Expected format: "1,2,3,4,5,6,7" where 1=Monday, 7=Sunday
    const sanitized = days.replace(/[^\d,]/g, '');
    const dayNumbers = sanitized.split(',')
      .map(d => this.parseInteger(d))
      .filter(d => d >= 1 && d <= 7)
      .sort();
    
    return [...new Set(dayNumbers)].join(',');
  }
  
  /**
   * Sanitize holidays array
   */
  private sanitizeHolidays(holidays: string[]): string[] {
    if (!Array.isArray(holidays)) {
      return [];
    }
    
    return holidays
      .filter(holiday => typeof holiday === 'string')
      .map(holiday => {
        // Expected format: YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(holiday) ? holiday : null;
      })
      .filter(holiday => holiday !== null) as string[];
  }
  
  /**
   * Validate location data completeness
   */
  validateLocation(location: StoreLocation): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!location.reference_id) {
      errors.push('Location reference_id is required');
    }
    
    if (!location.store) {
      errors.push('Location must be associated with a store');
    }
    
    if (location.gps_lat === 0 && location.gps_lng === 0) {
      errors.push('Valid GPS coordinates are required');
    }
    
    if (location.gps_lat < -90 || location.gps_lat > 90) {
      errors.push('Invalid latitude value');
    }
    
    if (location.gps_lng < -180 || location.gps_lng > 180) {
      errors.push('Invalid longitude value');
    }
    
    if (!location.address_city) {
      errors.push('City is required');
    }
    
    if (!location.address_state) {
      errors.push('State is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
