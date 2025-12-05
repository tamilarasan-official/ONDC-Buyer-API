import { BaseTransformer } from "./base-transformer";
import { Category } from "../../category/entities/category.entity";
import { Store } from "../../store/entities/store.entity";
import { Category as ONDCCategory } from "../../ondc-search/dto/ondc-search.dto";

/**
 * Category data transformer with validation and sanitization
 */
export class CategoryTransformer extends BaseTransformer {
  /**
   * Transform ONDC Category data to Category entity
   */
  transform(
    categoryData: ONDCCategory,
    store: Store,
    existingCategory?: Category,
  ): Category {
    // Validate input
    if (!categoryData) {
      throw new Error("Category data is required");
    }

    if (!categoryData.id) {
      throw new Error("Category ID is required");
    }

    if (!categoryData.descriptor) {
      throw new Error(`Category descriptor is required for category ${categoryData.id}`);
    }

    if (!categoryData.descriptor.name) {
      throw new Error(`Category name is required for category ${categoryData.id}`);
    }

    const category = existingCategory || new Category();

    try {
      // Basic category information
      category.reference_id = this.sanitizeString(categoryData.id, 255);
      category.store = store;
      category.name = this.sanitizeString(categoryData.descriptor.name, 255);
      category.description = this.sanitizeString(
        categoryData.descriptor.short_desc || categoryData.descriptor.long_desc,
        1000,
      );
      category.icon = this.sanitizeUrl(categoryData.descriptor.images?.[0], "");

      // Parse parent category ID - only set if valid
      if (categoryData.parent_category_id) {
        const parentId = this.parseInteger(categoryData.parent_category_id);
        // Only set if it's a valid positive integer
        if (parentId > 0) {
          category.parent_category_id = parentId;
        } else {
          // Invalid parent_category_id, set to null
          category.parent_category_id = null;
        }
      } else {
        category.parent_category_id = null;
      }

      // Extract category type and configuration from tags
      this.parseCategoryTags(categoryData.tags || [], category);

      category.status = true;

      this.logger.log(
        `Transformed category: ${category.reference_id} - ${category.name} (${category.type})`,
      );

      return category;
    } catch (error) {
      const categoryId = categoryData?.id || "unknown";
      this.logError(`Failed to transform category ${categoryId}`, error);
      throw new Error(`Category transformation failed: ${error.message}`);
    }
  }

  /**
   * Parse category tags for type, display rank, and other configurations
   */
  private parseCategoryTags(tags: any[], category: Category): void {
    // Set default category type
    category.type = "custom_menu";

    if (!Array.isArray(tags)) {
      return;
    }

    // Extract category type
    const typeTag = tags.find((tag) => tag.code === "type");
    if (typeTag && Array.isArray(typeTag.list)) {
      const typeItem = typeTag.list.find((item) => item.code === "type");
      if (typeItem?.value) {
        category.type = this.sanitizeCategoryType(typeItem.value);
      }
    }

    // Extract display rank
    const displayTag = tags.find((tag) => tag.code === "display");
    if (displayTag && Array.isArray(displayTag.list)) {
      const rankItem = displayTag.list.find((item) => item.code === "rank");
      if (rankItem?.value) {
        category.display_rank = this.parseInteger(rankItem.value);
      }
    }
  }

  /**
   * Sanitize and validate category type
   */
  private sanitizeCategoryType(type: string): string {
    if (!type || typeof type !== "string") {
      return "custom_menu";
    }

    const validTypes = ["custom_menu", "custom_group"];
    const sanitized = type.toLowerCase().trim();

    return validTypes.includes(sanitized) ? sanitized : "custom_menu";
  }

  /**
   * Transform category timing information from tags
   */
  transformTiming(categoryData: ONDCCategory): {
    day_from: number;
    day_to: number;
    time_from: string;
    time_to: string;
  } | null {
    if (!categoryData || !Array.isArray(categoryData.tags)) {
      return null;
    }

    const timingTag = categoryData.tags.find((tag) => tag.code === "timing");
    if (!timingTag || !Array.isArray(timingTag.list)) {
      return null;
    }

    const timing = {
      day_from: 1,
      day_to: 7,
      time_from: "0000",
      time_to: "2359",
    };

    timingTag.list.forEach((item) => {
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
    });

    return timing;
  }

  /**
   * Transform category configuration from tags (for custom_group types)
   */
  transformConfig(categoryData: ONDCCategory): {
    min_selections: number;
    max_selections: number;
    input_type: string;
    sequence: number;
    is_mandatory: boolean;
  } | null {
    if (!categoryData || !Array.isArray(categoryData.tags)) {
      return null;
    }

    const configTag = categoryData.tags.find((tag) => tag.code === "config");
    if (!configTag || !Array.isArray(configTag.list)) {
      return null;
    }

    const config = {
      min_selections: 0,
      max_selections: 1,
      input_type: "select",
      sequence: 1,
      is_mandatory: false,
    };

    configTag.list.forEach((item) => {
      switch (item.code) {
        case "min":
          config.min_selections = Math.max(0, this.parseInteger(item.value));
          break;
        case "max":
          config.max_selections = Math.max(1, this.parseInteger(item.value, 1));
          break;
        case "input":
          config.input_type = this.sanitizeInputType(item.value);
          break;
        case "seq":
          config.sequence = Math.max(1, this.parseInteger(item.value, 1));
          break;
      }
    });

    // Determine if mandatory based on min_selections
    config.is_mandatory = config.min_selections > 0;

    return config;
  }

  /**
   * Sanitize input type for category configuration
   */
  private sanitizeInputType(inputType: string): string {
    if (!inputType || typeof inputType !== "string") {
      return "select";
    }

    const validTypes = ["select", "radio", "checkbox", "multiselect"];
    const sanitized = inputType.toLowerCase().trim();

    return validTypes.includes(sanitized) ? sanitized : "select";
  }

  /**
   * Validate category data completeness
   */
  validateCategory(category: Category): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!category.reference_id) {
      errors.push("Category reference_id is required");
    }

    if (!category.store) {
      errors.push("Category must be associated with a store");
    }

    if (!category.name || category.name.length < 2) {
      errors.push("Category name must be at least 2 characters");
    }

    if (!["custom_menu", "custom_group"].includes(category.type)) {
      errors.push(
        'Category type must be either "custom_menu" or "custom_group"',
      );
    }

    if (
      category.parent_category_id !== undefined &&
      category.parent_category_id !== null &&
      category.parent_category_id <= 0
    ) {
      errors.push("Parent category ID must be a positive integer");
    }

    if (category.display_rank !== undefined && category.display_rank !== null && category.display_rank <= 0) {
      errors.push("Display rank must be a positive integer");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
