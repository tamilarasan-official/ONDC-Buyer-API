import { BaseTransformer } from './base-transformer';
import { Offers } from '../../offer/entities/offers.entity';
import { Store } from '../../store/entities/store.entity';
import { Offer as ONDCOffer } from '../../ondc-search/dto/ondc-search.dto';

/**
 * Offer data transformer with validation and sanitization
 */
export class OfferTransformer extends BaseTransformer {
  
  /**
   * Transform ONDC Offer data to Offers entity
   */
  transform(offerData: ONDCOffer, store: Store, existingOffer?: Offers): Offers {
    const offer = existingOffer || new Offers();
    
    try {
      // Basic offer information
      offer.reference_id = this.sanitizeString(offerData.id, 255);
      offer.store = store;
      offer.offer_code = this.sanitizeString(offerData.descriptor.code, 50);
      offer.banner_image_url = this.sanitizeUrl(offerData.descriptor.images?.[0], '');
      
      // Parse offer validity period
      this.parseOfferTiming(offerData, offer);
      
      // Extract offer metadata from tags
      this.parseOfferTags(offerData.tags || [], offer);
      
      offer.status = true;
      
      this.logger.log(`Transformed offer: ${offer.reference_id} - ${offer.offer_code}`);
      
      return offer;
      
    } catch (error) {
      this.logError(`Failed to transform offer ${offerData.id}`, error);
      throw new Error(`Offer transformation failed: ${error.message}`);
    }
  }
  
  /**
   * Parse offer timing information
   */
  private parseOfferTiming(offerData: ONDCOffer, offer: Offers): void {
    if (offerData.time?.range) {
      offer.valid_from = this.parseDateTime(offerData.time.range.start, new Date());
      offer.valid_to = this.parseDateTime(offerData.time.range.end, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } else {
      // Set default validity if not provided
      offer.valid_from = new Date();
      offer.valid_to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
    
    // Validate that valid_to is after valid_from
    if (offer.valid_to <= offer.valid_from) {
      this.logWarning(`Invalid offer date range for ${offerData.id}`);
      offer.valid_to = new Date(offer.valid_from.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
    }
  }
  
  /**
   * Parse offer tags for metadata
   */
  private parseOfferTags(tags: any[], offer: Offers): void {
    if (!Array.isArray(tags)) {
      offer.is_auto_apply = false;
      offer.is_additive = false;
      return;
    }
    
    // Extract meta information
    const metaTag = tags.find(tag => tag.code === 'meta');
    if (metaTag && Array.isArray(metaTag.list)) {
      metaTag.list.forEach(item => {
        switch (item.code) {
          case 'auto':
            offer.is_auto_apply = this.parseBoolean(item.value);
            break;
          case 'additive':
            offer.is_additive = this.parseBoolean(item.value);
            break;
        }
      });
    } else {
      offer.is_auto_apply = false;
      offer.is_additive = false;
    }
  }
  
  /**
   * Transform offer qualifiers from tags
   */
  transformQualifiers(offerData: ONDCOffer): Array<{
    qualifier_type: string;
    qualifier_value: string;
  }> {
    const qualifiers: Array<{
      qualifier_type: string;
      qualifier_value: string;
    }> = [];
    
    if (!Array.isArray(offerData.tags)) {
      return qualifiers;
    }
    
    const qualifierTag = offerData.tags.find(tag => tag.code === 'qualifier');
    if (!qualifierTag || !Array.isArray(qualifierTag.list)) {
      return qualifiers;
    }
    
    qualifierTag.list.forEach(item => {
      if (item.code && item.value) {
        qualifiers.push({
          qualifier_type: this.sanitizeQualifierType(item.code),
          qualifier_value: this.sanitizeString(item.value, 255)
        });
      }
    });
    
    return qualifiers;
  }
  
  /**
   * Transform offer benefits from tags
   */
  transformBenefits(offerData: ONDCOffer): Array<{
    benefit_type: string;
    benefit_value: string;
    benefit_cap?: string;
    benefit_item_count?: number;
  }> {
    const benefits: Array<{
      benefit_type: string;
      benefit_value: string;
      benefit_cap?: string;
      benefit_item_count?: number;
    }> = [];
    
    if (!Array.isArray(offerData.tags)) {
      return benefits;
    }
    
    const benefitTag = offerData.tags.find(tag => tag.code === 'benefit');
    if (!benefitTag || !Array.isArray(benefitTag.list)) {
      return benefits;
    }
    
    const benefitData: Record<string, string> = {};
    benefitTag.list.forEach(item => {
      if (item.code && item.value) {
        benefitData[item.code] = item.value;
      }
    });
    
    // Determine benefit type and create benefit object
    if (benefitData.value_type) {
      const benefit = {
        benefit_type: this.sanitizeBenefitType(benefitData.value_type),
        benefit_value: this.sanitizeString(benefitData.value || '0', 255),
        benefit_cap: benefitData.value_cap ? this.sanitizeString(benefitData.value_cap, 255) : undefined,
        benefit_item_count: benefitData.item_count ? this.parseInteger(benefitData.item_count) : undefined
      };
      
      benefits.push(benefit);
    }
    
    return benefits;
  }
  
  /**
   * Sanitize qualifier type
   */
  private sanitizeQualifierType(type: string): string {
    if (!type || typeof type !== 'string') {
      return 'min_value';
    }
    
    const validTypes = ['min_value', 'max_value', 'item_count', 'category', 'user_type'];
    const sanitized = type.toLowerCase().trim();
    
    return validTypes.includes(sanitized) ? sanitized : 'min_value';
  }
  
  /**
   * Sanitize benefit type
   */
  private sanitizeBenefitType(type: string): string {
    if (!type || typeof type !== 'string') {
      return 'amount';
    }
    
    const validTypes = ['percent', 'amount', 'item', 'free_shipping'];
    const sanitized = type.toLowerCase().trim();
    
    return validTypes.includes(sanitized) ? sanitized : 'amount';
  }
  
  /**
   * Parse offer location IDs
   */
  parseLocationIds(offerData: ONDCOffer): string[] {
    if (!Array.isArray(offerData.location_ids)) {
      return [];
    }
    
    return offerData.location_ids
      .filter(id => typeof id === 'string' && id.trim().length > 0)
      .map(id => this.sanitizeString(id, 255));
  }
  
  /**
   * Parse offer item IDs
   */
  parseItemIds(offerData: ONDCOffer): string[] {
    if (!Array.isArray(offerData.item_ids)) {
      return [];
    }
    
    return offerData.item_ids
      .filter(id => typeof id === 'string' && id.trim().length > 0)
      .map(id => this.sanitizeString(id, 255));
  }
  
  /**
   * Validate offer data completeness
   */
  validateOffer(offer: Offers): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!offer.reference_id) {
      errors.push('Offer reference_id is required');
    }
    
    if (!offer.store) {
      errors.push('Offer must be associated with a store');
    }
    
    if (!offer.offer_code || offer.offer_code.length < 2) {
      errors.push('Offer code must be at least 2 characters');
    }
    
    if (!offer.valid_from) {
      errors.push('Offer valid_from date is required');
    }
    
    if (!offer.valid_to) {
      errors.push('Offer valid_to date is required');
    }
    
    if (offer.valid_from && offer.valid_to && offer.valid_to <= offer.valid_from) {
      errors.push('Offer valid_to must be after valid_from');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
