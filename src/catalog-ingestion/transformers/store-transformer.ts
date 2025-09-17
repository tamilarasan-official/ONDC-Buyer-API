import { BaseTransformer } from './base-transformer';
import { Store } from '../../store/entities/store.entity';
import { Provider } from '../../ondc-search/dto/ondc-search.dto';

/**
 * Store data transformer with validation and sanitization
 */
export class StoreTransformer extends BaseTransformer {
  
  /**
   * Transform ONDC Provider data to Store entity
   */
  transform(provider: Provider, context: any, existingStore?: Store): Store {
    const store = existingStore || new Store();
    
    try {
      // Basic store information
      store.reference_id = this.sanitizeString(provider.id, 255);
      store.bpp_id = this.sanitizeString(context.bpp_id, 255);
      store.bpp_uri = this.sanitizeUrl(context.bpp_uri);
      store.name = this.sanitizeString(provider.descriptor.name, 255);
      store.description = this.sanitizeString(
        provider.descriptor.short_desc || provider.descriptor.long_desc, 
        1000
      );
      
      // Handle logo/symbol URL
      store.logo_url = this.sanitizeUrl(
        provider.descriptor.symbol || provider.descriptor.images?.[0]
      );
      
      // FSSAI license validation
      store.fssai_license_no = this.sanitizeFssaiLicense(provider['@ondc/org/fssai_license_no']);
      
      // TTL validation
      store.ttl = this.sanitizeTtl(provider.ttl);
      
      // Extract GST number from tags
      store.gst_number = this.extractGstNumber(provider.tags || []);
      
      // Store status - only set to true if provider data is valid
      // The status will be validated by the catalog ingestion service
      store.status = true;
      
      this.logger.log(`Transformed store: ${store.reference_id} - ${store.name}`);
      
      return store;
      
    } catch (error) {
      this.logError(`Failed to transform store ${provider.id}`, error);
      throw new Error(`Store transformation failed: ${error.message}`);
    }
  }
  
  /**
   * Validate and sanitize FSSAI license number
   */
  private sanitizeFssaiLicense(fssai: string | undefined): string {
    if (!fssai || typeof fssai !== 'string') {
      return '';
    }
    
    // FSSAI license should be 14 digits
    const sanitized = fssai.replace(/[^\d]/g, '');
    
    if (sanitized.length === 14) {
      return sanitized;
    }
    
    this.logWarning(`Invalid FSSAI license format: ${fssai}`);
    return '';
  }
  
  /**
   * Validate and sanitize TTL (Time To Live)
   */
  private sanitizeTtl(ttl: string | undefined): string {
    if (!ttl || typeof ttl !== 'string') {
      return '';
    }
    
    // TTL should be in ISO 8601 duration format (e.g., P1D, PT1H)
    const ttlRegex = /^P(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;
    
    if (ttlRegex.test(ttl.toUpperCase())) {
      return ttl.toUpperCase();
    }
    
    this.logWarning(`Invalid TTL format: ${ttl}`);
    return '';
  }
  
  /**
   * Extract GST number from provider tags
   */
  private extractGstNumber(tags: any[]): string {
    if (!Array.isArray(tags)) {
      return '';
    }
    
    // Look for GST number in various tag structures
    const gstSources = [
      this.extractTagValue(tags, 'statutory_requirements', 'gst_number'),
      this.extractTagValue(tags, 'gst_details', 'gst_number'),
      this.extractTagValue(tags, 'tax_details', 'gst_number'),
    ];
    
    for (const gst of gstSources) {
      const sanitized = this.sanitizeGstNumber(gst);
      if (sanitized) {
        return sanitized;
      }
    }
    
    return '';
  }
  
  /**
   * Validate and sanitize GST number
   */
  private sanitizeGstNumber(gst: string): string {
    if (!gst || typeof gst !== 'string') {
      return '';
    }
    
    // GST format: 22AAAAA0000A1Z5 (15 characters)
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const sanitized = gst.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (gstRegex.test(sanitized)) {
      return sanitized;
    }
    
    this.logWarning(`Invalid GST number format: ${gst}`);
    return '';
  }
  
  /**
   * Validate store data completeness
   */
  validateStore(store: Store): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!store.reference_id) {
      errors.push('Store reference_id is required');
    }
    
    if (!store.bpp_id) {
      errors.push('Store bpp_id is required');
    }
    
    if (!store.bpp_uri) {
      errors.push('Store bpp_uri is required');
    }
    
    if (!store.name || store.name.length < 2) {
      errors.push('Store name must be at least 2 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
