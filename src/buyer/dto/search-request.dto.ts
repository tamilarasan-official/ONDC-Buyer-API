import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRequestDto {
  @ApiProperty({
    description: 'Search query term (restaurant name, dish name, category)',
    example: 'pizza',
    required: false
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: 'Device latitude for location-based filtering',
    example: 12.9716,
    required: false,
    type: 'number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({
    description: 'Device longitude for location-based filtering',
    example: 77.5946,
    required: false,
    type: 'number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiProperty({
    description: 'Search radius in kilometers (default: 10km)',
    example: 5,
    required: false,
    type: 'number',
    minimum: 1,
    maximum: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radius?: number;

  @ApiProperty({
    description: 'Category ID to filter by specific category',
    example: 1,
    required: false,
    type: 'number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  category_id?: number;

  @ApiProperty({
    description: 'Store ID to filter by specific restaurant',
    example: 1,
    required: false,
    type: 'number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  store_id?: number;

  @ApiProperty({
    description: 'Search type: restaurant, item, categories, or all',
    example: 'all',
    required: false,
    enum: ['restaurant', 'item', 'categories', 'all']
  })
  @IsOptional()
  @IsString()
  type?: 'restaurant' | 'item' | 'categories' | 'all';

  @ApiProperty({
    description: 'Sort by: distance, rating, price, or name',
    example: 'distance',
    required: false,
    enum: ['distance', 'rating', 'price', 'name']
  })
  @IsOptional()
  @IsString()
  sort_by?: 'distance' | 'rating' | 'price' | 'name';

  @ApiProperty({
    description: 'Sort order: asc or desc',
    example: 'asc',
    required: false,
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    type: 'number',
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    required: false,
    type: 'number',
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
