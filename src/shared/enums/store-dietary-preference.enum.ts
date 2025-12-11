/**
 * Dietary preference enum for stores/restaurants
 * Used to standardize store dietary preference values across the application
 */
export enum StoreDietaryPreference {
  PURE_VEG = "pure-veg",
  VEG = "veg",
  NON_VEG = "non-veg",
  EGG = "egg",
  VEG_AND_NON_VEG = "veg-and-non-veg",
}

/**
 * Array of all store dietary preference values (for validation, API docs, etc.)
 */
export const STORE_DIETARY_PREFERENCE_VALUES = [
  StoreDietaryPreference.PURE_VEG,
  StoreDietaryPreference.VEG,
  StoreDietaryPreference.NON_VEG,
  StoreDietaryPreference.EGG,
  StoreDietaryPreference.VEG_AND_NON_VEG,
] as const;

/**
 * Helper function to normalize ONDC food_type values to StoreDietaryPreference enum
 * Maps various ONDC values to standard enum values
 */
export function normalizeStoreDietaryPreference(
  foodType: string | undefined | null,
): StoreDietaryPreference | null {
  if (!foodType || typeof foodType !== "string") {
    return null;
  }

  const normalized = foodType.toLowerCase().trim();

  // Map ONDC values to enum values
  if (
    normalized === "pure-veg" ||
    normalized === "pure_veg" ||
    normalized === "pureveg"
  ) {
    return StoreDietaryPreference.PURE_VEG;
  }

  if (normalized === "veg" || normalized === "vegetarian") {
    return StoreDietaryPreference.VEG;
  }

  if (
    normalized === "non-veg" ||
    normalized === "non-vegetarian" ||
    normalized === "nonveg" ||
    normalized === "non_veg"
  ) {
    return StoreDietaryPreference.NON_VEG;
  }

  if (
    normalized === "egg" ||
    normalized === "eggterian" ||
    normalized === "eggetarian"
  ) {
    return StoreDietaryPreference.EGG;
  }

  if (
    normalized === "veg-and-non-veg" ||
    normalized === "veg_and_non_veg" ||
    normalized === "both" ||
    normalized === "veg and non-veg"
  ) {
    return StoreDietaryPreference.VEG_AND_NON_VEG;
  }

  return null;
}

/**
 * Check if a string is a valid store dietary preference
 */
export function isValidStoreDietaryPreference(
  value: string | undefined | null,
): boolean {
  if (!value) {
    return false;
  }
  return STORE_DIETARY_PREFERENCE_VALUES.includes(
    value as StoreDietaryPreference,
  );
}

