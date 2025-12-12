import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum } from "class-validator";
import { DietaryPreference } from "../../shared/enums/dietary-preference.enum";
import { StoreDietaryPreference } from "../../shared/enums/store-dietary-preference.enum";

export class RestaurantTimingDto {
  @ApiProperty({
    description: "Day of week in display format: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday",
    example: 1,
    type: "number",
  })
  day: number;

  @ApiProperty({
    description: "Opening time in HHMM format",
    example: "0900",
  })
  open_time: string;

  @ApiProperty({
    description: "Closing time in HHMM format",
    example: "2200",
  })
  close_time: string;

  @ApiProperty({
    description: "Is restaurant open on this day",
    example: true,
    type: "boolean",
  })
  is_open: boolean;
}

export class ItemTimingDto {
  @ApiProperty({
    description:
      "Starting day of week in display format: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday",
    example: 1,
    type: "number",
  })
  day_from: number;

  @ApiProperty({
    description:
      "Ending day of week in display format: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday. Always greater than or equal to day_from (wrapped ranges are automatically split into readable ranges).",
    example: 7,
    type: "number",
  })
  day_to: number;

  @ApiProperty({
    description:
      "Available from time in 24-hour HHMM format (e.g., '0900' for 9:00 AM, '1430' for 2:30 PM, '0000' for midnight)",
    example: "0900",
  })
  time_from: string;

  @ApiProperty({
    description:
      "Available to time in 24-hour HHMM format (e.g., '2200' for 10:00 PM, '0200' for 2:00 AM). Can be less than time_from for overnight periods (e.g., '2200'-'0200')",
    example: "2200",
  })
  time_to: string;

  @ApiProperty({
    description:
      "Real-time availability indicator - true if the current server time falls within this timing window (considers both day and time). Calculated dynamically for each request.",
    example: true,
    type: "boolean",
  })
  is_available_now: boolean;
}

export class RestaurantLocationDto {
  @ApiProperty({
    description: "Location ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Location latitude",
    example: 9.93523,
    type: "number",
  })
  lat: number;

  @ApiProperty({
    description: "Location longitude",
    example: 78.130404,
    type: "number",
  })
  lng: number;

  @ApiProperty({
    description: "Address locality",
    example: "Koramangala",
  })
  locality: string;

  @ApiProperty({
    description: "Address street",
    example: "5th Block",
  })
  street: string;

  @ApiProperty({
    description: "City name",
    example: "Bangalore",
  })
  city: string;

  @ApiProperty({
    description: "Area code",
    example: "560034",
  })
  area_code: string;

  @ApiProperty({
    description: "State code",
    example: "KA",
  })
  state: string;

  @ApiProperty({
    description: "Delivery radius in kilometers",
    example: 5,
    type: "number",
  })
  delivery_radius: number;
}

export class RestaurantOfferDto {
  @ApiProperty({
    description: "Offer ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Offer name",
    example: "50% Off on Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Offer description",
    example: "Get 50% off on all pizzas",
  })
  description: string;

  @ApiProperty({
    description: "Offer code",
    example: "PIZZA50",
  })
  offer_code: string;

  @ApiProperty({
    description: "Offer banner image URL",
    example: "https://example.com/offer.jpg",
  })
  banner_image_url: string;

  @ApiProperty({
    description: "Offer valid from date",
    example: "2025-01-01T00:00:00Z",
  })
  valid_from: string;

  @ApiProperty({
    description: "Offer valid to date",
    example: "2025-01-31T23:59:59Z",
  })
  valid_to: string;
}

export class ItemCustomizationOptionDto {
  @ApiProperty({
    description: "Option ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Option name",
    example: "Thin Crust",
  })
  name: string;

  @ApiProperty({
    description: "Option price",
    example: 0,
    type: "number",
  })
  price: number;

  @ApiProperty({
    description: "Is default option",
    example: true,
    type: "boolean",
  })
  is_default: boolean;
}

export class ItemCustomizationGroupDto {
  @ApiProperty({
    description: "Customization group ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Group name",
    example: "Crust",
  })
  name: string;

  @ApiProperty({
    description: "Group description",
    example: "Choose your pizza crust",
  })
  description: string;

  @ApiProperty({
    description: "Minimum selections required",
    example: 1,
    type: "number",
  })
  min_selections: number;

  @ApiProperty({
    description: "Maximum selections allowed",
    example: 1,
    type: "number",
  })
  max_selections: number;

  @ApiProperty({
    description: "Input type",
    example: "select",
    enum: ["select", "radio", "checkbox"],
  })
  input_type: string;

  @ApiProperty({
    description: "Is mandatory",
    example: true,
    type: "boolean",
  })
  is_mandatory: boolean;

  @ApiProperty({
    description: "Available options",
    type: [ItemCustomizationOptionDto],
  })
  options: ItemCustomizationOptionDto[];
}

export class RestaurantItemDto {
  @ApiProperty({
    description: "Item ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Item name",
    example: "Margherita Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Item short description",
    example: "Classic margherita with fresh mozzarella",
  })
  description: string;

  @ApiProperty({
    description: "Item long description",
    example:
      "Traditional Italian pizza with fresh mozzarella, tomato sauce, and basil",
    required: false,
  })
  long_description?: string;

  @ApiProperty({
    description: "Item images",
    type: [String],
    example: ["https://example.com/pizza.jpg"],
  })
  images: string[];

  @ApiProperty({
    description: "Item price",
    type: "object",
    properties: {
      base_price: { type: "number", example: 299.0 },
      currency: { type: "string", example: "INR" },
    },
  })
  price: {
    base_price: number;
    currency: string;
  };

  @ApiProperty({
    description: "Item rating",
    example: 4.2,
    type: "number",
  })
  rating: number;

  @ApiProperty({
    description: "Is item available",
    example: true,
    type: "boolean",
  })
  is_available: boolean;

  @ApiProperty({
    description: "Is item recommended",
    example: true,
    type: "boolean",
  })
  is_recommended: boolean;

  @ApiProperty({
    description: "Dietary preference: veg, non-veg, egg",
    example: "veg",
    enum: DietaryPreference,
    enumName: "DietaryPreference",
  })
  dietary_preference: DietaryPreference;

  @ApiProperty({
    description: "Food type: pure-veg, veg, non-veg, egg, veg-and-non-veg",
    example: "veg",
    enum: StoreDietaryPreference,
    enumName: "StoreDietaryPreference",
    required: false,
  })
  @IsOptional()
  @IsEnum(StoreDietaryPreference)
  food_type?: StoreDietaryPreference;

  @ApiProperty({
    description: "Cuisine tags",
    example: "South Indian, North Indian, Chinese",
    required: false,
  })
  cuisine_tags?: string;

  @ApiProperty({
    description: "Has customizations",
    example: true,
    type: "boolean",
  })
  has_customizations: boolean;

  @ApiProperty({
    description: "Customization groups (always included in response)",
    type: [ItemCustomizationGroupDto],
  })
  customizations: ItemCustomizationGroupDto[];

  @ApiProperty({
    description: "Is item marked as favorite by the logged-in user",
    example: false,
    type: "boolean",
  })
  is_favorite: boolean;

  @ApiProperty({
    description:
      "Item availability timings - defines when this item is available for order. Each timing object represents a time window with day range and time range. Example: breakfast items available Mon-Fri 6AM-11AM (day_from=2, day_to=6), or all-day items available Sun-Sat 24 hours (day_from=1, day_to=7). Empty array means no specific timing restrictions. Day format: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday.",
    type: [ItemTimingDto],
    required: false,
    example: [
      {
        day_from: 2,
        day_to: 6,
        time_from: "0600",
        time_to: "1100",
        is_available_now: true,
      },
    ],
  })
  timings?: ItemTimingDto[];

  @ApiProperty({ 
    description: "Is preorder available for this item?", 
    required: false 
  })
  is_preorder_available?: boolean;

  @ApiProperty({ 
    description: "Preorder campaign info (if available). The discount_amount is calculated as base_price - final_order_price (12) so that slashed_price = base_price - discount_amount equals the final order total. This allows showing the slashed base price and the final order price.", 
    required: false 
  })
  preorder_campaign?: {
    id: number;
    title: string;
    available_slots: number;
    delivery_date: string;
    discount_amount: string;
    free_delivery: boolean;
  };

  @ApiProperty({
    description: "Tax rate percentage",
    example: 18.0,
    type: "number",
    required: false,
  })
  tax_rate?: number;

  @ApiProperty({
    description: "Tax type (e.g., GST, CGST+SGST, IGST, VAT)",
    example: "GST",
    type: "string",
    required: false,
  })
  tax_type?: string;
}

export class RestaurantCategoryDto {
  @ApiProperty({
    description: "Category ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Category name",
    example: "Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Category description",
    example: "Delicious pizzas",
  })
  description: string;

  @ApiProperty({
    description: "Category icon URL",
    example: "https://example.com/pizza-icon.jpg",
  })
  icon: string;

  @ApiProperty({
    description: "Items in this category",
    type: [RestaurantItemDto],
  })
  items: RestaurantItemDto[];

  @ApiProperty({
    description: "Number of items in this category",
    example: 15,
    type: "number",
  })
  item_count: number;
}

export class RestaurantStatsDto {
  @ApiProperty({
    description: "Total number of items",
    example: 45,
    type: "number",
  })
  total_items: number;

  @ApiProperty({
    description: "Number of categories",
    example: 8,
    type: "number",
  })
  total_categories: number;

  @ApiProperty({
    description: "Number of active offers",
    example: 3,
    type: "number",
  })
  active_offers: number;

  @ApiProperty({
    description: "Average rating",
    example: 4.5,
    type: "number",
  })
  average_rating: number;

  @ApiProperty({
    description: "Total number of reviews",
    example: 150,
    type: "number",
  })
  total_reviews: number;
}

export class RestaurantDetailsDto {
  @ApiProperty({
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Restaurant name",
    example: "Pizza Palace",
  })
  name: string;

  @ApiProperty({
    description: "Restaurant description",
    example: "Best pizza in town with authentic Italian flavors",
  })
  description: string;

  @ApiProperty({
    description: "Restaurant logo URL",
    example: "https://example.com/logo.jpg",
  })
  logo_url: string;

  @ApiProperty({
    description: "FSSAI license number",
    example: "12345678901234",
  })
  fssai_license: string;

  @ApiProperty({
    description: "GST number",
    example: "22AAAAA0000A1Z5",
  })
  gst_number: string;

  @ApiProperty({
    description: "Food type: pure-veg, veg, non-veg, egg, veg-and-non-veg",
    example: "veg",
    enum: StoreDietaryPreference,
    enumName: "StoreDietaryPreference",
    required: false,
  })
  @IsOptional()
  @IsEnum(StoreDietaryPreference)
  food_type?: StoreDietaryPreference;

  @ApiProperty({
    description: "Cuisine tags",
    example: "South Indian, North Indian, Chinese",
    required: false,
  })
  cuisine_tags?: string;

  @ApiProperty({
    description: "Restaurant locations",
    type: [RestaurantLocationDto],
  })
  locations: RestaurantLocationDto[];

  @ApiProperty({
    description: "Restaurant timings",
    type: [RestaurantTimingDto],
  })
  timings: RestaurantTimingDto[];

  @ApiProperty({
    description: "Active offers",
    type: [RestaurantOfferDto],
  })
  offers: RestaurantOfferDto[];

  @ApiProperty({
    description: "Restaurant statistics",
    type: RestaurantStatsDto,
  })
  stats: RestaurantStatsDto;

  @ApiProperty({
    description: "Is restaurant currently open",
    example: true,
    type: "boolean",
  })
  is_open: boolean;

  @ApiProperty({
    description: "Estimated delivery time",
    example: "25-30 mins",
  })
  delivery_time: string;

  @ApiProperty({
    description: "Minimum order value",
    example: 199.0,
    type: "number",
  })
  min_order_value: number;

  @ApiProperty({
    description: "Delivery fee",
    example: 30.0,
    type: "number",
  })
  delivery_fee: number;

  @ApiProperty({
    description: "Categorized items (only included when include_items=true)",
    type: [RestaurantCategoryDto],
    required: false,
  })
  categories?: RestaurantCategoryDto[];

  @ApiProperty({
    description: "Applied filters for items",
    required: false,
    example: {
      search: "pizza",
      dietary_preference: "veg",
    },
  })
  applied_filters?: {
    search?: string;
    dietary_preference?: DietaryPreference;
  };

  @ApiProperty({
    description: "Restaurant phone number from Delivery fulfillment",
    example: "+919876543210",
    required: false,
    nullable: true,
  })
  phone_number?: string | null;

  @ApiProperty({
    description: "Restaurant email from Delivery fulfillment",
    example: "contact@restaurant.com",
    required: false,
    nullable: true,
  })
  email?: string | null;

  @ApiProperty({
    description: "App operation hours status (indicates if app is currently accepting orders)",
    type: "object",
    properties: {
      is_open: {
        type: "boolean",
        example: true,
        description: "Whether the app is currently accepting orders",
      },
      reason: {
        type: "string",
        example: "OPEN",
        description: "Status reason: OPEN, OUTSIDE_OPERATING_HOURS, HOURS_NOT_ENABLED, etc.",
      },
      message: {
        type: "string",
        example: "App is currently accepting orders",
        description: "User-friendly status message",
      },
      next_open_time: {
        type: "string",
        example: "0800",
        nullable: true,
        description: "Next opening time in HHMM format (null if app is open or hours not configured)",
      },
    },
  })
  app_operation_status: {
    is_open: boolean;
    reason?: string;
    message?: string;
    next_open_time?: string | null;
  };
}

export class RestaurantDetailsResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Restaurant details retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Restaurant details data",
    type: RestaurantDetailsDto,
  })
  data: RestaurantDetailsDto;
}
