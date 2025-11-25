/**
 * Dietary preference enum for products/items
 * Used to standardize dietary preference values across the application
 */
export enum DietaryPreference {
  VEG = "veg",
  NON_VEG = "non-veg",
  EGG = "egg",
}

/**
 * Array of all dietary preference values (for validation, API docs, etc.)
 */
export const DIETARY_PREFERENCE_VALUES = [
  DietaryPreference.VEG,
  DietaryPreference.NON_VEG,
  DietaryPreference.EGG,
] as const;

/**
 * Helper function to normalize ONDC food_type values to DietaryPreference enum
 * Maps various ONDC values to standard enum values
 */
export function normalizeDietaryPreference(
  foodType: string | undefined | null,
): DietaryPreference | null {
  if (!foodType || typeof foodType !== "string") {
    return null;
  }

  const normalized = foodType.toLowerCase().trim();

  // Map ONDC values to enum values
  if (normalized === "veg" || normalized === "vegetarian") {
    return DietaryPreference.VEG;
  }

  if (
    normalized === "non-veg" ||
    normalized === "non-vegetarian" ||
    normalized === "nonveg" ||
    normalized === "non_veg"
  ) {
    return DietaryPreference.NON_VEG;
  }

  if (
    normalized === "egg" ||
    normalized === "eggterian" ||
    normalized === "eggetarian"
  ) {
    return DietaryPreference.EGG;
  }

  // For "veg-and-non-veg", we default to non-veg (can be enhanced later)
  if (
    normalized === "veg-and-non-veg" ||
    normalized === "veg_and_non_veg" ||
    normalized === "both"
  ) {
    return DietaryPreference.NON_VEG;
  }

  return null;
}

/**
 * Check if a string is a valid dietary preference
 */
export function isValidDietaryPreference(
  value: string | undefined | null,
): boolean {
  if (!value) {
    return false;
  }
  return DIETARY_PREFERENCE_VALUES.includes(value as DietaryPreference);
}

