import { BaseTransformer } from "./base-transformer";
import { Item } from "../../item/entities/item.entity";
import { Store } from "../../store/entities/store.entity";
import { Item as ONDCItem } from "../../ondc-search/dto/ondc-search.dto";
import {
  DietaryPreference,
  normalizeDietaryPreference,
} from "../../shared/enums/dietary-preference.enum";

/**
 * Item data transformer with validation and sanitization
 */
export class ItemTransformer extends BaseTransformer {
  /**
   * Transform ONDC Item data to Item entity
   */
  transform(itemData: ONDCItem, store: Store, existingItem?: Item): Item {
    const item = existingItem || new Item();

    try {
      // Basic item information
      item.reference_id = this.sanitizeString(itemData.id, 255);
      item.store = store;
      item.name = this.sanitizeString(itemData.descriptor.name, 255);
      item.short_desc = this.sanitizeString(
        itemData.descriptor.short_desc,
        500,
      );
      item.long_desc = this.sanitizeString(itemData.descriptor.long_desc, 2000);
      item.symbol_url = this.sanitizeUrl(itemData.descriptor.symbol);

      // Handle images array
      item.images = this.sanitizeImages(itemData.descriptor.images);

      // Parse ONDC specific fields
      item.is_related = this.parseBoolean(itemData.related);
      item.is_recommended = this.parseBoolean(itemData.recommended);
      item.is_returnable = this.parseBoolean(itemData["@ondc/org/returnable"]);
      item.is_cancellable = this.parseBoolean(
        itemData["@ondc/org/cancellable"],
      );
      item.return_window = this.sanitizeString(
        itemData["@ondc/org/return_window"],
        50,
      );
      item.seller_pickup_return = this.parseBoolean(
        itemData["@ondc/org/seller_pickup_return"],
      );
      item.time_to_ship = this.sanitizeString(
        itemData["@ondc/org/time_to_ship"],
        50,
      );
      item.available_on_cod = this.parseBoolean(
        itemData["@ondc/org/available_on_cod"],
      );
      item.consumer_care_details = this.sanitizeString(
        itemData["@ondc/org/contact_details_consumer_care"],
        500,
      );

      // Parse item type from tags
      item.type = this.extractItemType(itemData.tags || []);

      // Parse tax information from ONDC response
      this.extractTaxInformation(itemData, item);

      // Parse additional information from ONDC response
      this.extractAdditionalInformation(itemData, item);

      // Parse item code from descriptor.code or fallback to item ID
      item.code = this.sanitizeString(
        itemData.descriptor.code || itemData.id,
        255,
      );

      // Parse timestamp
      if (itemData.time?.timestamp) {
        const parsedDate = this.parseDateTime(itemData.time.timestamp);
        if (parsedDate) {
          item.enable_timestamp = parsedDate;
        }
      }

      const statusLabel = itemData.time?.label?.toLowerCase();
      item.status = statusLabel === "disable" ? false : true;

      this.logger.log(
        `Transformed item: ${item.reference_id} - ${item.name} (${item.type})`,
      );

      return item;
    } catch (error) {
      this.logError(`Failed to transform item ${itemData.id}`, error);
      throw new Error(`Item transformation failed: ${error.message}`);
    }
  }

  /**
   * Sanitize and validate images array
   */
  private sanitizeImages(images: string[] | undefined): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((img) => this.sanitizeUrl(img))
      .filter((img) => img !== "")
      .slice(0, 10); // Limit to 10 images max
  }

  /**
   * Extract item type from ONDC data structure
   */
  private extractItemType(tags: any[]): string {
    // Check if this is a customization item based on ONDC structure
    // In ONDC, customization items have related: true and parent tags
    const hasParentTag = tags.some(
      (tag) => tag.code === "parent" && Array.isArray(tag.list),
    );

    if (hasParentTag) {
      return "customization";
    }

    // Check for explicit type in tags
    const itemType = this.extractTagValue(tags, "type", "type", "item");

    // Validate item type
    const validTypes = ["item", "customization"];
    return validTypes.includes(itemType) ? itemType : "item";
  }

  /**
   * Extract tax information from ONDC response
   */
  private extractTaxInformation(itemData: any, item: Item): void {
    // Extract tax.percent from direct tax object (always present in ONDC response)
    if (
      itemData.tax &&
      typeof itemData.tax === "object" &&
      itemData.tax.percent !== undefined
    ) {
      item.tax_rate = this.parseTaxRate(itemData.tax.percent.toString());
      item.tax_type = "percentage"; // Always percentage for tax.percent
      this.logger.log(
        `Found tax.percent: ${itemData.tax.percent}% for item ${itemData.id}`,
      );
    }
  }

  /**
   * Parse and validate tax rate
   */
  private parseTaxRate(rate: string): number | undefined {
    if (!rate || typeof rate !== "string") {
      return undefined;
    }

    const parsed = this.parseFloat(rate.replace("%", ""));

    // Tax rate should be between 0 and 50%
    if (parsed >= 0 && parsed <= 50) {
      return parsed;
    }

    this.logWarning(`Invalid tax rate: ${rate}`);
    return undefined;
  }

  /**
   * Extract additional information from ONDC response
   */
  private extractAdditionalInformation(itemData: ONDCItem, item: Item): void {
    if (itemData.additional_information) {
      item.additional_information = itemData.additional_information;
      this.logger.log(
        `Stored additional_information for item ${item.reference_id}`,
      );

      // Log food_type if available
      if (itemData.additional_information.food_type) {
        const foodType = itemData.additional_information.food_type;
        this.logger.log(
          `Found food_type: ${foodType} for item ${item.reference_id}`,
        );
      }
    }
  }

  /**
   * Sanitize tax type
   */
  private sanitizeTaxType(type: string): string | undefined {
    if (!type || typeof type !== "string") {
      return undefined;
    }

    const validTypes = ["GST", "CGST+SGST", "IGST", "VAT", "EXEMPT"];
    const sanitized = type.toUpperCase();

    return validTypes.includes(sanitized) ? sanitized : undefined;
  }

  /**
   * Sanitize HSN/SAC code
   */
  private sanitizeHsnCode(hsn: string): string | undefined {
    if (!hsn || typeof hsn !== "string") {
      return undefined;
    }

    // HSN codes are typically 4-8 digits, SAC codes are 6 digits
    const sanitized = hsn.replace(/[^\d]/g, "");

    if (sanitized.length >= 4 && sanitized.length <= 8) {
      return sanitized;
    }

    this.logWarning(`Invalid HSN/SAC code: ${hsn}`);
    return undefined;
  }

  /**
   * Transform item attributes from tags and additional_information
   */
  transformAttributes(itemData: ONDCItem): Array<{
    attribute_code: string;
    attribute_name: string;
    attribute_value: string;
    attribute_group: string;
    display_order?: number;
  }> {
    const attributes: Array<{
      attribute_code: string;
      attribute_name: string;
      attribute_value: string;
      attribute_group: string;
      display_order?: number;
    }> = [];

    // Priority 1: Extract food_type from additional_information and normalize to enum
    if (itemData.additional_information?.food_type) {
      const foodType = itemData.additional_information.food_type;
      const normalizedPreference = normalizeDietaryPreference(foodType);

      if (normalizedPreference) {
        attributes.push({
          attribute_code: "veg_nonveg",
          attribute_name: "Food Type",
          attribute_value: normalizedPreference,
          attribute_group: "dietary",
          display_order: 1,
        });
        this.logger.log(
          `Normalized dietary preference for item ${itemData.id}: ${foodType} -> ${normalizedPreference}`,
        );
      } else {
        this.logWarning(
          `Invalid dietary preference value for item ${itemData.id}: ${foodType}. Expected: veg, non-veg, or egg`,
        );
      }
    }

    // Priority 2: Fall back to veg_nonveg from tags if food_type not available
    if (
      !itemData.additional_information?.food_type &&
      Array.isArray(itemData.tags)
    ) {
      const vegNonVegTag = itemData.tags.find(
        (tag) => tag.code === "veg_nonveg",
      );
      if (vegNonVegTag && Array.isArray(vegNonVegTag.list)) {
        const vegValue = vegNonVegTag.list.find((item) => item.code === "veg");
        if (vegValue && vegValue.value) {
          const normalizedPreference = normalizeDietaryPreference(
            vegValue.value,
          );

          if (normalizedPreference) {
            attributes.push({
              attribute_code: "veg_nonveg",
              attribute_name: "Food Type",
              attribute_value: normalizedPreference,
              attribute_group: "dietary",
              display_order: 1,
            });
            this.logger.log(
              `Normalized dietary preference from tags for item ${itemData.id}: ${vegValue.value} -> ${normalizedPreference}`,
            );
          }
        }
      }
    }

    // Process other attribute groups from tags
    if (Array.isArray(itemData.tags)) {
      const attributeGroups = [
        { tag: "brand", group: "product_info" },
        { tag: "material", group: "product_info" },
        { tag: "color", group: "product_info" },
        { tag: "size", group: "product_info" },
        { tag: "statutory_reqs", group: "regulatory" },
        { tag: "organic", group: "dietary" },
        { tag: "allergen_info", group: "dietary" },
      ];

      attributeGroups.forEach((groupInfo, index) => {
        const tagValues = this.extractTagValues(
          itemData.tags || [],
          groupInfo.tag,
        );

        Object.entries(tagValues).forEach(([code, value]) => {
          if (code && value) {
            attributes.push({
              attribute_code: this.sanitizeString(code, 100),
              attribute_name: this.formatAttributeName(code),
              attribute_value: this.sanitizeString(value, 255),
              attribute_group: groupInfo.group,
              display_order: index + 2, // Start from 2 since food_type is 1
            });
          }
        });
      });

      // Extract variant attributes from "attribute" tag (for variant items)
      const attributeTag = itemData.tags.find((tag) => tag.code === "attribute");
      if (attributeTag && Array.isArray(attributeTag.list)) {
        attributeTag.list.forEach((attr, index) => {
          if (attr.code && attr.value) {
            const attributeName = this.formatAttributeName(attr.code);
            
            attributes.push({
              attribute_code: this.sanitizeString(attr.code, 100),
              attribute_name: attributeName,
              attribute_value: this.sanitizeString(attr.value, 255),
              attribute_group: "variant",
              display_order: 100 + index,
            });
          }
        });
      }
    }

    return attributes;
  }

  /**
   * Transform item pricing information
   */
  transformPricing(itemData: ONDCItem): {
    currency: string;
    base_price: number;
    maximum_price?: number;
    minimum_price_range?: number;
    maximum_price_range?: number;
    default_selection_price?: number;
    default_selection_max_price?: number;
  } | null {
    if (!itemData.price) {
      return null;
    }

    const pricing = {
      currency: this.sanitizeString(itemData.price.currency, 3, "INR"),
      base_price: this.parseFloat(itemData.price.value),
      maximum_price: itemData.price.maximum_value
        ? this.parseFloat(itemData.price.maximum_value)
        : undefined,
      minimum_price_range: undefined as number | undefined,
      maximum_price_range: undefined as number | undefined,
      default_selection_price: undefined as number | undefined,
      default_selection_max_price: undefined as number | undefined,
    };

    // Parse price ranges from tags
    if (Array.isArray(itemData.price.tags)) {
      itemData.price.tags.forEach((tag) => {
        if (tag.code === "range" && Array.isArray(tag.list)) {
          tag.list.forEach((item) => {
            if (item.code === "lower") {
              pricing.minimum_price_range = this.parseFloat(item.value);
            } else if (item.code === "upper") {
              pricing.maximum_price_range = this.parseFloat(item.value);
            }
          });
        } else if (
          tag.code === "default_selection" &&
          Array.isArray(tag.list)
        ) {
          tag.list.forEach((item) => {
            if (item.code === "value") {
              pricing.default_selection_price = this.parseFloat(item.value);
            } else if (item.code === "maximum_value") {
              pricing.default_selection_max_price = this.parseFloat(item.value);
            }
          });
        }
      });
    }

    return pricing;
  }

  /**
   * Transform item quantity information
   */
  transformQuantity(itemData: ONDCItem): {
    unit_type: string;
    unit_value: number;
    available_count: number;
    maximum_count: number;
    unitized_unit?: string;
    unitized_value?: number;
  } | null {
    if (!itemData.quantity) {
      return null;
    }

    const quantity = {
      unit_type: "unit",
      unit_value: 1,
      available_count: 0,
      maximum_count: 99,
      unitized_unit: undefined as string | undefined,
      unitized_value: undefined as number | undefined,
    };

    // Parse available count
    if (itemData.quantity.available?.count) {
      quantity.available_count = this.parseInteger(
        itemData.quantity.available.count,
      );
    }

    // Parse maximum count
    if (itemData.quantity.maximum?.count) {
      quantity.maximum_count = this.parseInteger(
        itemData.quantity.maximum.count,
      );
    }

    // Parse unitized information
    if (itemData.quantity.unitized?.measure) {
      quantity.unitized_unit = this.sanitizeString(
        itemData.quantity.unitized.measure.unit,
        20,
      );
      quantity.unitized_value = this.parseFloat(
        itemData.quantity.unitized.measure.value,
      );
    }

    return quantity;
  }

  /**
   * Validate item data completeness
   */
  validateItem(item: Item): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!item.reference_id) {
      errors.push("Item reference_id is required");
    }

    if (!item.store) {
      errors.push("Item must be associated with a store");
    }

    if (!item.name || item.name.length < 2) {
      errors.push("Item name must be at least 2 characters");
    }

    if (!["item", "customization"].includes(item.type)) {
      errors.push('Item type must be either "item" or "customization"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format attribute code to readable name
   */
  private formatAttributeName(code: string): string {
    return code
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Transform item timing from ONDC tags
   * Returns array of timings to support multiple time windows
   */
  transformTimings(itemData: ONDCItem): Array<{
    day_from: number;
    day_to: number;
    time_from: string;
    time_to: string;
  }> {
    if (!Array.isArray(itemData.tags)) {
      return [];
    }

    // Find all timing tags (item can have multiple timing windows)
    const timingTags = itemData.tags.filter((tag) => tag.code === "timing");

    if (timingTags.length === 0) {
      return [];
    }

    const timings: Array<{
      day_from: number;
      day_to: number;
      time_from: string;
      time_to: string;
    }> = [];

    // Process each timing tag
    for (const timingTag of timingTags) {
      if (!Array.isArray(timingTag.list)) {
        continue;
      }

      // Initialize with defaults
      const timing = {
        day_from: 1,
        day_to: 7,
        time_from: "0000",
        time_to: "2359",
      };

      // Parse timing values from tag list
      timingTag.list.forEach((item: any) => {
        // Handle standard structure: { code: "time_from", value: "0700" }
        if (item.code) {
          switch (item.code) {
            case "day_from":
              timing.day_from = this.parseInteger(item.value, 1);
              if (timing.day_from < 1 || timing.day_from > 7) {
                timing.day_from = 1;
              }
              break;
            case "day_to":
              timing.day_to = this.parseInteger(item.value, 7);
              if (timing.day_to < 1 || timing.day_to > 7) {
                timing.day_to = 7;
              }
              break;
            case "time_from":
              timing.time_from = this.parseOndcTime(item.value, "0000");
              break;
            case "time_to":
              timing.time_to = this.parseOndcTime(item.value, "2359");
              break;
          }
        } else {
          // Handle alternative structure: { time_from: "0700" } (direct property)
          // This handles cases where time_from/time_to are direct properties without code/value
          if (item.time_from) {
            timing.time_from = this.parseOndcTime(
              item.time_from,
              "0000",
            );
          }
          if (item.time_to) {
            timing.time_to = this.parseOndcTime(item.time_to, "2359");
          }
        }
      });

      timings.push(timing);
    }

    return timings;
  }

  /**
   * Transform item timing from ONDC tags (backward compatibility - returns first timing)
   * @deprecated Use transformTimings() to get all timings
   */
  transformTiming(itemData: ONDCItem): {
    day_from: number;
    day_to: number;
    time_from: string;
    time_to: string;
  } | null {
    const timings = this.transformTimings(itemData);
    return timings.length > 0 ? timings[0] : null;
  }
}
