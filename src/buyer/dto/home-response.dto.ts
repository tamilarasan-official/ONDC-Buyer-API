import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum } from "class-validator";
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

export class LocationDto {
  @ApiProperty({
    description: "Latitude coordinate",
    example: 9.93523,
    type: "number",
  })
  lat: number;

  @ApiProperty({
    description: "Longitude coordinate",
    example: 78.130404,
    type: "number",
  })
  lng: number;

  @ApiProperty({
    description: "Source of location data",
    enum: ["default_address", "recent_address", "device_location"],
    example: "default_address",
  })
  source: string;

  @ApiProperty({
    description: "City name from user address",
    example: "Chennai",
  })
  city: string;

  @ApiProperty({
    description: "Full address from user address",
    example: "Vigneshwar Nagar, Nanganallur, Tamilnadu",
  })
  address: string;
}

export class RestaurantLocationDto {
  @ApiProperty({
    description: "Restaurant latitude",
    example: 9.93523,
    type: "number",
  })
  lat: number;

  @ApiProperty({
    description: "Restaurant longitude",
    example: 78.130404,
    type: "number",
  })
  lng: number;

  @ApiProperty({
    description: "City name",
    example: "Bangalore",
  })
  city: string;

  @ApiProperty({
    description: "Locality name",
    example: "Koramangala",
  })
  locality: string;
}

export class NearbyRestaurantDto {
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
    example: "Best pizza in town",
  })
  description: string;

  @ApiProperty({
    description: "Restaurant logo URL",
    example: "https://example.com/logo.jpg",
  })
  logo_url: string;

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
    description: "FSSAI license number",
    example: "12345678901234",
  })
  fssai_license: string;

  @ApiProperty({
    description: "Restaurant location details",
    type: RestaurantLocationDto,
  })
  location: RestaurantLocationDto;

  @ApiProperty({
    description: "Distance from user in kilometers",
    example: 2.5,
    type: "number",
  })
  distance: number;

  @ApiProperty({
    description: "Restaurant rating",
    example: 4.5,
    type: "number",
  })
  rating: number;

  @ApiProperty({
    description: "Total number of reviews",
    example: 150,
    type: "number",
  })
  total_reviews: number;

  @ApiProperty({
    description: "Estimated delivery time",
    example: "25-30 mins",
  })
  delivery_time: string;

  @ApiProperty({
    description: "Number of active offers",
    example: 3,
    type: "number",
  })
  offers_count: number;

  @ApiProperty({
    description: "Restaurant timings",
    type: [RestaurantTimingDto],
  })
  timings: RestaurantTimingDto[];

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
}

export class PopularCategoryDto {
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
    description: "Number of items in this category",
    example: 25,
    type: "number",
  })
  item_count: number;
}

export class StoreInfoDto {
  @ApiProperty({
    description: "Store name",
    example: "Pizza Palace",
  })
  name: string;

  @ApiProperty({
    description: "Store logo URL",
    example: "https://example.com/logo.jpg",
  })
  logo_url: string;
}

export class PriceDto {
  @ApiProperty({
    description: "Price amount",
    example: 299.0,
    type: "number",
  })
  amount: number;

  @ApiProperty({
    description: "Currency code",
    example: "INR",
  })
  currency: string;
}

export class TrendingItemDto {
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
    description: "Item description",
    example: "Classic margherita",
  })
  description: string;

  @ApiProperty({
    description: "Item images",
    type: [String],
    example: ["https://example.com/pizza.jpg"],
  })
  images: string[];

  @ApiProperty({
    description: "Store information",
    type: StoreInfoDto,
  })
  store: StoreInfoDto;

  @ApiProperty({
    description: "Item price",
    type: PriceDto,
  })
  price: PriceDto;

  @ApiProperty({
    description: "Distance from user in kilometers",
    example: 1.2,
    type: "number",
  })
  distance: number;

  @ApiProperty({
    description: "Item rating",
    example: 4.2,
    type: "number",
  })
  rating: number;

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
}

export class WhatsOnYourMindDto {
  @ApiProperty({
    description: "Dish ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Dish name",
    example: "Biryani",
  })
  name: string;

  @ApiProperty({
    description: "Dish description",
    example: "Aromatic rice dish with spices",
  })
  description: string;

  @ApiProperty({
    description: "Food type: pure-veg, veg, non-veg, egg, veg-and-non-veg",
    example: "non-veg",
    enum: StoreDietaryPreference,
    enumName: "StoreDietaryPreference",
  })
  @IsEnum(StoreDietaryPreference)
  food_type: StoreDietaryPreference;

  @ApiProperty({
    description: "Dish icon URL",
    example: "https://example.com/biryani-icon.jpg",
  })
  icon: string;

  @ApiProperty({
    description: "Display sequence order",
    example: 1,
    type: "number",
  })
  sequence: number;

  @ApiProperty({
    description: "Status of the dish",
    example: true,
    type: "boolean",
  })
  status: boolean;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-15T12:00:00Z",
  })
  created_at: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-15T12:00:00Z",
  })
  updated_at: Date;
}

export class PromotionalBannerDto {
  @ApiProperty({
    description: "Banner title",
    example: "Craving Something Delicious?",
  })
  title: string;

  @ApiProperty({
    description: "Banner subtitle",
    example:
      "Get your favorite meals delivered hot & fast—right to your doorstep.",
  })
  subtitle: string;

  @ApiProperty({
    description: "Call-to-action button text",
    example: "Order Now!",
  })
  cta_button: string;

  @ApiProperty({
    description: "Banner image URL",
    example: "/images/promotional-thali.jpg",
  })
  image_url: string;

  @ApiProperty({
    description: "Background color in hex",
    example: "#14b8a6",
  })
  background_color: string;

  @ApiProperty({
    description: "Promotion type (restaurant_id, category_id, or url)",
    example: "restaurant_id",
    required: false,
  })
  promotion_type?: string;

  @ApiProperty({
    description: "Promotion link (restaurant ID, category ID, or external URL)",
    example: "1050",
    required: false,
  })
  promotion_link?: string;

  @ApiProperty({
    description: "Display sequence order",
    example: 1,
    type: "number",
    required: false,
  })
  sequence?: number;
}

export class PaginationMetaDto {
  @ApiProperty({
    description: "Current page number",
    example: 1,
    type: "number",
  })
  current_page: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 5,
    type: "number",
  })
  total_pages: number;

  @ApiProperty({
    description: "Total number of restaurants",
    example: 87,
    type: "number",
  })
  total_count: number;

  @ApiProperty({
    description: "Number of restaurants per page",
    example: 20,
    type: "number",
  })
  page_size: number;

  @ApiProperty({
    description: "Whether there are more restaurants to load",
    example: true,
    type: "boolean",
  })
  has_more: boolean;
}

export class CodSettingsDto {
  @ApiProperty({
    description: "Whether COD is enabled",
    example: true,
    type: "boolean",
  })
  cod_enabled: boolean;

  @ApiProperty({
    description: "Minimum COD amount",
    example: 11,
    type: "number",
  })
  cod_min_amount: number;

  @ApiProperty({
    description: "Maximum COD amount",
    example: 500,
    type: "number",
  })
  cod_max_amount: number;

  @ApiProperty({
    description: "Daily COD threshold amount",
    example: 100,
    type: "number",
  })
  cod_daily_threshold: number;

  @ApiProperty({
    description: "Maximum COD serviceable distance in kilometers",
    example: 10,
    type: "number",
  })
  cod_serviceable_distance_km: number;
}

export class HomeDataDto {
  @ApiProperty({
    description: "Nearby restaurants within radius",
    type: [NearbyRestaurantDto],
  })
  nearby_restaurants: NearbyRestaurantDto[];

  @ApiProperty({
    description: "Pagination metadata for nearby restaurants",
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;

  @ApiProperty({
    description: '"What\'s On Your Mind?" dish categories',
    type: [WhatsOnYourMindDto],
  })
  whats_on_your_mind: WhatsOnYourMindDto[];

  @ApiProperty({
    description:
      "Promotional banners information (fetched from banner management system - returns all active banners ordered by sequence, or default banner if none available)",
    type: [PromotionalBannerDto],
  })
  promotional_banner: PromotionalBannerDto[];

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

  @ApiProperty({
    description: "Home screen restaurant card style (1 = default)",
    example: "1",
    type: "string",
  })
  home_screen_restaurant_card_style: string;

  @ApiProperty({
    description: "Cash on Delivery configuration values",
    type: CodSettingsDto,
  })
  cod_settings: CodSettingsDto;

  @ApiProperty({
    description: "Buyer cancel timer in seconds (0 when disabled)",
    example: 10,
    type: "number",
  })
  cancel_timer: number;
}

export class HomeResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Home page data retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Home page data",
    type: HomeDataDto,
  })
  data: HomeDataDto;
}
