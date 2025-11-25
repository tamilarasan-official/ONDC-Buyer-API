import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsObject,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import {
  DietaryPreference,
  DIETARY_PREFERENCE_VALUES,
} from "../../shared/enums/dietary-preference.enum";

export class SearchRequestDto {
  @ApiProperty({
    description: "Search query term (restaurant name, dish name, category)",
    example: "pizza",
    required: false,
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: "Device latitude for location-based filtering",
    example: 9.93523,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({
    description: "Device longitude for location-based filtering",
    example: 78.130404,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiProperty({
    description: "Search radius in kilometers (default: 10km)",
    example: 5,
    required: false,
    type: "number",
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radius?: number;

  @ApiProperty({
    description: "Category ID to filter by specific category",
    example: 1,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  category_id?: number;

  @ApiProperty({
    description: "Store ID to filter by specific restaurant",
    example: 1,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  store_id?: number;

  @ApiProperty({
    description: "Search type: restaurant, item, categories, or all",
    example: "all",
    required: false,
    enum: ["restaurant", "item", "categories", "all"],
  })
  @IsOptional()
  @IsString()
  type?: "restaurant" | "item" | "categories" | "all";

  @ApiProperty({
    description:
      "Sort by: distance, rating, price, name, best_sellers, highly_ordered",
    example: "distance",
    required: false,
    enum: [
      "distance",
      "rating",
      "price",
      "name",
      "best_sellers",
      "highly_ordered",
    ],
  })
  @IsOptional()
  @IsString()
  sort_by?:
    | "distance"
    | "rating"
    | "price"
    | "name"
    | "best_sellers"
    | "highly_ordered";

  @ApiProperty({
    description: "Sort order: asc or desc",
    example: "asc",
    required: false,
    enum: ["asc", "desc"],
  })
  @IsOptional()
  @IsString()
  sort_order?: "asc" | "desc";

  @ApiProperty({
    description: "Dietary preference: veg, non-veg, egg",
    example: "veg",
    required: false,
    enum: DietaryPreference,
    enumName: "DietaryPreference",
  })
  @IsOptional()
  @IsEnum(DietaryPreference)
  dietary_preference?: DietaryPreference;

  @ApiProperty({
    description: "Minimum price filter",
    example: 100,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiProperty({
    description: "Maximum price filter",
    example: 500,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiProperty({
    description: "Page number for pagination",
    example: 1,
    required: false,
    type: "number",
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: "Number of results per page",
    example: 20,
    required: false,
    type: "number",
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Search Suggestions DTOs
export class LocationDto {
  @ApiProperty({
    description: "Latitude coordinate",
    example: 9.93523,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({
    description: "Longitude coordinate",
    example: 78.130404,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class SearchFiltersDto {
  @ApiProperty({
    description: "Dietary preference filter: veg, non-veg, egg",
    example: "veg",
    enum: DietaryPreference,
    enumName: "DietaryPreference",
    required: false,
  })
  @IsOptional()
  @IsEnum(DietaryPreference)
  dietary_preference?: DietaryPreference;

  @ApiProperty({
    description: "Minimum price filter",
    example: 100,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiProperty({
    description: "Maximum price filter",
    example: 500,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiProperty({
    description: "Category ID filter",
    example: 1,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  category_id?: number;

  @ApiProperty({
    description: "Store ID filter",
    example: 1,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  store_id?: number;
}

export class SearchSuggestionsRequestDto {
  @ApiProperty({
    description: "Search query string (minimum 2 characters)",
    example: "burgl",
    minLength: 2,
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: "User location for location-based suggestions",
    type: LocationDto,
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({
    description:
      "Latitude (backwards compatibility - use location.lat instead)",
    example: 9.93523,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({
    description:
      "Longitude (backwards compatibility - use location.lng instead)",
    example: 78.130404,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiProperty({
    description: "Search filters to apply",
    type: SearchFiltersDto,
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters?: SearchFiltersDto;

  @ApiProperty({
    description: "Maximum number of suggestions to return",
    example: 10,
    type: "number",
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
