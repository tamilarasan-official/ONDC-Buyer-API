import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class MenuRequestDto {
  @ApiProperty({
    description: "Category ID to filter menu items by specific category",
    example: 1,
    required: false,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  category_id?: number;

  @ApiProperty({
    description: "Search term to filter menu items by name or description",
    example: "pizza",
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: "Sort by: name, price, rating, or popularity",
    example: "name",
    required: false,
    enum: ["name", "price", "rating", "popularity"],
  })
  @IsOptional()
  @IsString()
  sort_by?: "name" | "price" | "rating" | "popularity";

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
    description: "Minimum price filter",
    example: 100,
    required: false,
    type: "number",
    minimum: 0,
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
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiProperty({
    description: "Filter by dietary preferences (veg, non-veg, vegan)",
    example: "veg",
    required: false,
    enum: ["veg", "non-veg", "vegan"],
  })
  @IsOptional()
  @IsString()
  dietary_preference?: "veg" | "non-veg" | "vegan";

  @ApiProperty({
    description: "Include customization groups and options",
    example: true,
    required: false,
    type: "boolean",
  })
  @IsOptional()
  include_customizations?: boolean;

  @ApiProperty({
    description: "Include variant groups and options",
    example: true,
    required: false,
    type: "boolean",
  })
  @IsOptional()
  include_variants?: boolean;
}
