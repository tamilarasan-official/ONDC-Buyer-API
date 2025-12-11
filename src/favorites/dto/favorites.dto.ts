import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsNotEmpty } from "class-validator";

// ===== Response DTOs =====

export class FavoriteItemDto {
  @ApiProperty({ description: "Item ID", example: 123 })
  id: number;

  @ApiProperty({ description: "Item name", example: "Chicken Biryani" })
  name: string;

  @ApiProperty({
    description: "Item description",
    example: "Authentic Hyderabadi style biryani",
  })
  description: string;

  @ApiProperty({
    description: "Item images",
    type: [String],
    example: ["https://example.com/biryani.jpg"],
  })
  images: string[];

  @ApiProperty({ description: "Item price", example: 299.0 })
  price: number;

  @ApiProperty({
    description: "Restaurant information",
    type: "object",
    properties: {
      id: { type: "number", example: 14 },
      name: { type: "string", example: "6SUVAI" },
      logo_url: { type: "string", example: "https://example.com/logo.jpg" },
    },
  })
  restaurant: {
    id: number;
    name: string;
    logo_url: string;
  };

  @ApiProperty({ description: "Item rating", example: 4.5 })
  rating: number;

  @ApiProperty({ description: "Is item available", example: true })
  is_available: boolean;

  @ApiProperty({
    description: "When item was favorited",
    example: "2025-01-15T10:30:00Z",
  })
  favorited_at: Date;

  @ApiProperty({ description: "Is item favorited by user", example: true })
  is_favorite: boolean;
}

export class FavoriteRestaurantDto {
  @ApiProperty({ description: "Restaurant ID", example: 14 })
  id: number;

  @ApiProperty({ description: "Restaurant name", example: "6SUVAI" })
  name: string;

  @ApiProperty({
    description: "Restaurant description",
    example: "Best South Indian cuisine",
  })
  description: string;

  @ApiProperty({
    description: "Restaurant logo URL",
    example: "https://example.com/logo.jpg",
  })
  logo_url: string;

  @ApiProperty({ description: "FSSAI license", example: "12345678901234" })
  fssai_license: string;

  @ApiProperty({
    description: "Location details",
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

  @ApiProperty({ description: "Distance from user in km", example: 2.3 })
  distance: number;

  @ApiProperty({ description: "Restaurant rating", example: 4.5 })
  rating: number;

  @ApiProperty({ description: "Delivery time estimate", example: "25-30 mins" })
  delivery_time: string;

  @ApiProperty({ description: "Is restaurant open", example: true })
  is_open: boolean;

  @ApiProperty({ description: "Number of active offers", example: 3 })
  offers_count: number;

  @ApiProperty({ description: "Number of items available", example: 45 })
  items_count: number;

  @ApiProperty({
    description: "When restaurant was favorited",
    example: "2025-01-15T10:30:00Z",
  })
  favorited_at: Date;

  @ApiProperty({
    description: "Is restaurant favorited by user",
    example: true,
  })
  is_favorite: boolean;
}

export class AllFavoritesResponseDto {
  @ApiProperty({ description: "Success status", example: true })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Favorites retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Favorites data",
    type: "object",
    properties: {
      restaurants: {
        type: "array",
        items: { $ref: "#/components/schemas/FavoriteRestaurantDto" },
      },
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/FavoriteItemDto" },
      },
      summary: {
        type: "object",
        properties: {
          total_favorites: { type: "number", example: 15 },
          favorite_restaurants: { type: "number", example: 5 },
          favorite_items: { type: "number", example: 10 },
        },
      },
    },
  })
  data: {
    restaurants: FavoriteRestaurantDto[];
    items: FavoriteItemDto[];
    summary: {
      total_favorites: number;
      favorite_restaurants: number;
      favorite_items: number;
    };
  };
}

export class FavoriteStatusDto {
  @ApiProperty({ description: "Is favorited", example: true })
  is_favorite: boolean;

  @ApiProperty({
    description: "When favorited (null if not favorited)",
    example: "2025-01-15T10:30:00Z",
    nullable: true,
  })
  favorited_at: Date | null;
}

export class ToggleFavoriteResponseDto {
  @ApiProperty({ description: "Success status", example: true })
  success: boolean;

  @ApiProperty({
    description: "Action performed",
    example: "added",
    enum: ["added", "removed"],
  })
  action: "added" | "removed";

  @ApiProperty({
    description: "Response message",
    example: "Item added to favorites",
  })
  message: string;

  @ApiProperty({
    description: "Current favorite status",
    type: FavoriteStatusDto,
  })
  data: FavoriteStatusDto;
}
