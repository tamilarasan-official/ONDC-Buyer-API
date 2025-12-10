import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum } from "class-validator";
import { RestaurantTimingDto } from "./home-response.dto";
import { StoreDietaryPreference } from "../../shared/enums/store-dietary-preference.enum";

export class SearchRestaurantDto {
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
    description: "FSSAI license number",
    example: "12345678901234",
  })
  fssai_license: string;

  @ApiProperty({
    description: "Restaurant location details",
    type: "object",
    properties: {
      lat: { type: "number", example: 9.93523 },
      lng: { type: "number", example: 78.130404 },
      city: { type: "string", example: "Bangalore" },
      locality: { type: "string", example: "Koramangala" },
    },
  })
  location: {
    lat: number;
    lng: number;
    city: string;
    locality: string;
  };

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
    description: "Number of items available",
    example: 45,
    type: "number",
  })
  items_count: number;

  @ApiProperty({
    description: "Is restaurant currently open",
    example: true,
    type: "boolean",
  })
  is_open: boolean;

  @ApiProperty({
    description: "Restaurant timings for all days of the week",
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

export class TopRatedRestaurantDto {
  @ApiProperty({
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Restaurant name",
    example: "6SUVAI Restaurant",
  })
  name: string;

  @ApiProperty({
    description: "Restaurant description",
    example: "Best South Indian cuisine with authentic flavors",
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
    description: "Restaurant location details",
    type: "object",
    properties: {
      lat: { type: "number", example: 9.93523 },
      lng: { type: "number", example: 78.130404 },
      city: { type: "string", example: "Madurai" },
      locality: { type: "string", example: "Anna Nagar" },
    },
  })
  location: {
    lat: number;
    lng: number;
    city: string;
    locality: string;
  };

  @ApiProperty({
    description: "Distance from user in kilometers",
    example: 1.8,
    type: "number",
  })
  distance: number;

  @ApiProperty({
    description: "Restaurant average rating (rounded to 1 decimal)",
    example: 4.7,
    type: "number",
  })
  rating: number;

  @ApiProperty({
    description: "Number of reviews received",
    example: 142,
    type: "number",
  })
  review_count: number;

  @ApiProperty({
    description: "Estimated delivery time",
    example: "25-30 mins",
  })
  delivery_time: string;

  @ApiProperty({
    description: "Number of active offers",
    example: 2,
    type: "number",
  })
  offers_count: number;

  @ApiProperty({
    description: "Number of items available",
    example: 38,
    type: "number",
  })
  items_count: number;

  @ApiProperty({
    description: "Is restaurant currently open",
    example: true,
    type: "boolean",
  })
  is_open: boolean;

  @ApiProperty({
    description: "Restaurant timings for all days of the week",
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

export class SearchItemDto {
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
    example: "Classic margherita with fresh mozzarella",
  })
  description: string;

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
      amount: { type: "number", example: 299.0 },
      currency: { type: "string", example: "INR" },
    },
  })
  price: {
    amount: number;
    currency: string;
  };

  @ApiProperty({
    description: "Store information",
    type: "object",
    properties: {
      id: { type: "number", example: 1 },
      name: { type: "string", example: "Pizza Palace" },
      logo_url: { type: "string", example: "https://example.com/logo.jpg" },
    },
  })
  store: {
    id: number;
    name: string;
    logo_url: string;
  };

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
    description: "Category information",
    type: "object",
    properties: {
      id: { type: "number", example: 1 },
      name: { type: "string", example: "Pizza" },
    },
  })
  category: {
    id: number;
    name: string;
  };

  @ApiProperty({
    description: "Is item currently available",
    example: true,
    type: "boolean",
  })
  is_available: boolean;

  @ApiProperty({
    description: "Is item marked as favorite by the logged-in user",
    example: false,
    type: "boolean",
  })
  is_favorite: boolean;

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
    description: "Is preorder available for this item?", 
    required: false 
  })
  is_preorder_available?: boolean;

  @ApiProperty({ 
    description: "Preorder campaign info (if available)", 
    required: false 
  })
  preorder_campaign?: {
    id: number;
    title: string;
    available_slots: number;
    delivery_date: string;
    discount_amount: number;
    free_delivery: boolean;
  };
}

export class SearchCategoryDto {
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

  @ApiProperty({
    description: "Number of restaurants serving this category",
    example: 8,
    type: "number",
  })
  restaurant_count: number;
}

export class SearchMetaDto {
  @ApiProperty({
    description: "Current page number",
    example: 1,
    type: "number",
  })
  page: number;

  @ApiProperty({
    description: "Number of results per page",
    example: 20,
    type: "number",
  })
  limit: number;

  @ApiProperty({
    description: "Total number of results",
    example: 150,
    type: "number",
  })
  total: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 8,
    type: "number",
  })
  total_pages: number;

  @ApiProperty({
    description: "Has next page",
    example: true,
    type: "boolean",
  })
  has_next: boolean;

  @ApiProperty({
    description: "Has previous page",
    example: false,
    type: "boolean",
  })
  has_prev: boolean;

  @ApiProperty({
    description: "Search query used",
    example: "pizza",
  })
  query: string;

  @ApiProperty({
    description: "Search type used",
    example: "all",
  })
  type: string;

  @ApiProperty({
    description: "Sort criteria used",
    example: "distance",
  })
  sort_by: string;

  @ApiProperty({
    description: "Sort order used",
    example: "asc",
  })
  sort_order: string;
}

export class SearchDataDto {
  @ApiProperty({
    description: "User location information",
    type: "object",
    properties: {
      lat: { type: "number", example: 9.93523 },
      lng: { type: "number", example: 78.130404 },
      source: { type: "string", example: "default_address" },
    },
  })
  location: {
    lat: number;
    lng: number;
    source: string;
  };

  @ApiProperty({
    description: "Search results for restaurants",
    type: [SearchRestaurantDto],
  })
  restaurants: SearchRestaurantDto[];

  @ApiProperty({
    description: "Search results for items",
    type: [SearchItemDto],
  })
  items: SearchItemDto[];

  @ApiProperty({
    description: "Search results for categories",
    type: [SearchCategoryDto],
  })
  categories: SearchCategoryDto[];

  @ApiProperty({
    description:
      "Top 5 highly rated restaurants within the search radius (always included regardless of search query)",
    type: [TopRatedRestaurantDto],
    example: [
      {
        id: 1,
        name: "6SUVAI Restaurant",
        description: "Best South Indian cuisine with authentic flavors",
        logo_url: "https://example.com/6suvai-logo.jpg",
        fssai_license: "12345678901234",
        location: {
          lat: 9.93523,
          lng: 78.130404,
          city: "Madurai",
          locality: "Anna Nagar",
        },
        distance: 1.8,
        rating: 4.7,
        review_count: 142,
        delivery_time: "25-30 mins",
        offers_count: 2,
        items_count: 38,
        is_open: true,
      },
    ],
  })
  top_rated_restaurants: TopRatedRestaurantDto[];

  @ApiProperty({
    description: "Pagination and search metadata",
    type: SearchMetaDto,
  })
  meta: SearchMetaDto;
}

export class SearchResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Search completed successfully",
  })
  message: string;

  @ApiProperty({
    description: "Search results data",
    type: SearchDataDto,
  })
  data: SearchDataDto;
}

// Search Suggestions Response DTOs
export class SearchSuggestionDto {
  @ApiProperty({
    description: "Suggestion ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Suggestion name",
    example: "Burger",
  })
  name: string;

  @ApiProperty({
    description: "Suggestion type",
    example: "dish",
    enum: ["dish", "restaurant", "category"],
  })
  type: "dish" | "restaurant" | "category";

  @ApiProperty({
    description: "Suggestion description",
    example: "Delicious burgers",
  })
  description: string;

  @ApiProperty({
    description: "Suggestion icon URL",
    example: "https://example.com/burger-icon.jpg",
  })
  icon: string;

  @ApiProperty({
    description: "Suggestion image URL",
    example: "https://example.com/burger-image.jpg",
  })
  image: string;

  @ApiProperty({
    description: "Number of restaurants serving this suggestion",
    example: 15,
    type: "number",
  })
  restaurant_count: number;

  @ApiProperty({
    description: "Number of items matching this suggestion",
    example: 25,
    type: "number",
  })
  item_count: number;
}

export class SearchSuggestionsDataDto {
  @ApiProperty({
    description: "Original search query",
    example: "burgl",
  })
  query: string;

  @ApiProperty({
    description: "List of search suggestions",
    type: [SearchSuggestionDto],
  })
  suggestions: SearchSuggestionDto[];

  @ApiProperty({
    description: "Total number of suggestions found",
    example: 8,
    type: "number",
  })
  total_suggestions: number;
}

export class SearchSuggestionsResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Search suggestions retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Search suggestions data",
    type: SearchSuggestionsDataDto,
  })
  data: SearchSuggestionsDataDto;
}
