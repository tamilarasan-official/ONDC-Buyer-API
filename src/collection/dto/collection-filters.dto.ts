import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CollectionFiltersDto {
  @ApiPropertyOptional({ example: "%Dosa%" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 4.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  ratings?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: ["veg", "pure-veg"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  food_type_in?: string[];

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radius_km?: number;

  @ApiPropertyOptional({ example: 9.9252 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  user_lat?: number;

  @ApiPropertyOptional({ example: 78.1198 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  user_lng?: number;

  @ApiPropertyOptional({
    example: "rating",
    enum: ["name", "price", "rating", "distance"],
  })
  @IsOptional()
  @IsIn(["name", "price", "rating", "distance"])
  sort_by?: "name" | "price" | "rating" | "distance";

  @ApiPropertyOptional({ example: "desc", enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sort_order?: "asc" | "desc";

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

