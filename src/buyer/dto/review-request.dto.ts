import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, Max, IsEnum } from 'class-validator';

export class CreateRestaurantReviewDto {
  @ApiProperty({
    description: 'Restaurant ID to review',
    example: 1,
    type: 'number'
  })
  @IsNumber()
  restaurant_id: number;

  @ApiProperty({
    description: 'Order ID for this review',
    example: 123,
    type: 'number'
  })
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: 'Overall rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review title',
    example: 'Great food and fast delivery!',
    required: false
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Review comment',
    example: 'The pizza was delicious and arrived hot. Delivery was quick too!',
    required: false
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'Food quality rating (1-5)',
    example: 5,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  food_quality?: number;

  @ApiProperty({
    description: 'Delivery time rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  delivery_time?: number;

  @ApiProperty({
    description: 'Packaging rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  packaging?: number;

  @ApiProperty({
    description: 'Value for money rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  value_for_money?: number;
}

export class CreateItemReviewDto {
  @ApiProperty({
    description: 'Item ID to review',
    example: 1,
    type: 'number'
  })
  @IsNumber()
  item_id: number;

  @ApiProperty({
    description: 'Order ID for this review',
    example: 123,
    type: 'number'
  })
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: 'Overall rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review title',
    example: 'Amazing Margherita Pizza!',
    required: false
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Review comment',
    example: 'Perfect crust, fresh ingredients, and great taste!',
    required: false
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'Taste rating (1-5)',
    example: 5,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  taste?: number;

  @ApiProperty({
    description: 'Portion size rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  portion_size?: number;

  @ApiProperty({
    description: 'Value for money rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  value_for_money?: number;
}

export class UpdateReviewDto {
  @ApiProperty({
    description: 'Overall rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({
    description: 'Review title',
    example: 'Updated review title',
    required: false
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Review comment',
    example: 'Updated review comment',
    required: false
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'Food quality rating (1-5)',
    example: 5,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  food_quality?: number;

  @ApiProperty({
    description: 'Delivery time rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  delivery_time?: number;

  @ApiProperty({
    description: 'Packaging rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  packaging?: number;

  @ApiProperty({
    description: 'Value for money rating (1-5)',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  value_for_money?: number;

  @ApiProperty({
    description: 'Taste rating (1-5) - for item reviews',
    example: 5,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  taste?: number;

  @ApiProperty({
    description: 'Portion size rating (1-5) - for item reviews',
    example: 4,
    type: 'number',
    minimum: 1,
    maximum: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  portion_size?: number;
}
