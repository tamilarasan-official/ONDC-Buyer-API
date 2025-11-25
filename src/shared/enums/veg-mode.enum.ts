/**
 * Veg mode filter enum for buyer app
 * Defines how vegetarian filtering should be applied
 */
export enum VegMode {
  /**
   * Show all restaurants but filter items to show only vegetarian products
   */
  ALL = "all",

  /**
   * Show only pure-vegetarian restaurants (all products from these restaurants)
   */
  PURE = "pure",
}

/**
 * Array of all veg mode values
 */
export const VEG_MODE_VALUES = [
  VegMode.ALL,
  VegMode.PURE,
] as const;

/**
 * Check if a string is a valid veg mode value
 */
export function isValidVegMode(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  return VEG_MODE_VALUES.includes(value as VegMode);
}

