import { Logger } from '@nestjs/common';

/**
 * Base transformer class with common transformation utilities
 */
export abstract class BaseTransformer {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Safely parse integer with fallback
   */
  protected parseInteger(value: string | number | undefined, fallback: number = 0): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    
    const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Safely parse float with fallback
   */
  protected parseFloat(value: string | number | undefined, fallback: number = 0): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Safely parse boolean with fallback
   */
  protected parseBoolean(value: string | boolean | undefined, fallback: boolean = false): boolean {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    const stringValue = value.toString().toLowerCase();
    return stringValue === 'true' || stringValue === 'yes' || stringValue === '1';
  }

  /**
   * Sanitize and validate string input
   */
  protected sanitizeString(value: string | undefined, maxLength: number = 255, fallback: string = ''): string {
    if (!value || typeof value !== 'string') {
      return fallback;
    }
    
    // Remove dangerous characters and trim
    const sanitized = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .trim();
    
    // Truncate if too long
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
  }

  /**
   * Validate and sanitize URL
   */
  protected sanitizeUrl(url: string | undefined, fallback: string = ''): string {
    if (!url || typeof url !== 'string') {
      return fallback;
    }
    
    try {
      // Basic URL validation
      if (url.startsWith('http://') || url.startsWith('https://')) {
        new URL(url); // This will throw if invalid
        return url.trim();
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Validate and sanitize email
   */
  protected sanitizeEmail(email: string | undefined, fallback: string = ''): string {
    if (!email || typeof email !== 'string') {
      return fallback;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = email.trim().toLowerCase();
    
    return emailRegex.test(sanitized) ? sanitized : fallback;
  }

  /**
   * Validate and sanitize phone number
   */
  protected sanitizePhone(phone: string | undefined, fallback: string = ''): string {
    if (!phone || typeof phone !== 'string') {
      return fallback;
    }
    
    // Remove all non-digit characters except +
    const sanitized = phone.replace(/[^\d+]/g, '');
    
    // Basic phone validation (10-15 digits, optional country code)
    const phoneRegex = /^(\+\d{1,3})?[6-9]\d{9}$/;
    
    return phoneRegex.test(sanitized) ? sanitized : fallback;
  }

  /**
   * Extract value from ONDC tags
   */
  protected extractTagValue(tags: any[], tagCode: string, itemCode: string, fallback: string = ''): string {
    if (!Array.isArray(tags)) {
      return fallback;
    }
    
    const tag = tags.find(t => t.code === tagCode);
    if (!tag || !Array.isArray(tag.list)) {
      return fallback;
    }
    
    const item = tag.list.find(i => i.code === itemCode);
    return item?.value || fallback;
  }

  /**
   * Extract multiple values from ONDC tags
   */
  protected extractTagValues(tags: any[], tagCode: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (!Array.isArray(tags)) {
      return result;
    }
    
    const tag = tags.find(t => t.code === tagCode);
    if (!tag || !Array.isArray(tag.list)) {
      return result;
    }
    
    tag.list.forEach(item => {
      if (item.code && item.value) {
        result[item.code] = item.value;
      }
    });
    
    return result;
  }

  /**
   * Validate GPS coordinates
   */
  protected parseGpsCoordinates(gps: string | undefined): { lat: number; lng: number } | null {
    if (!gps || typeof gps !== 'string') {
      return null;
    }
    
    const coords = gps.split(',').map(coord => parseFloat(coord.trim()));
    
    if (coords.length !== 2 || coords.some(isNaN)) {
      return null;
    }
    
    const [lat, lng] = coords;
    
    // Basic GPS validation
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    
    return { lat, lng };
  }

  /**
   * Parse and validate date/time
   */
  protected parseDateTime(dateTime: string | undefined, fallback?: Date): Date | undefined {
    if (!dateTime || typeof dateTime !== 'string') {
      return fallback;
    }
    
    try {
      const parsed = new Date(dateTime);
      return isNaN(parsed.getTime()) ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  /**
   * Validate ONDC time format (HHMM)
   */
  protected parseOndcTime(time: string | undefined, fallback: string = '0000'): string {
    if (!time || typeof time !== 'string') {
      return fallback;
    }
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3])[0-5][0-9]$/;
    const sanitized = time.replace(/[^\d]/g, '').padStart(4, '0');
    
    return timeRegex.test(sanitized) ? sanitized : fallback;
  }

  /**
   * Log transformation warning
   */
  protected logWarning(message: string, data?: any): void {
    this.logger.warn(`Transformation Warning: ${message}`, data);
  }

  /**
   * Log transformation error
   */
  protected logError(message: string, error?: any): void {
    this.logger.error(`Transformation Error: ${message}`, error);
  }
}
