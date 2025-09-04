import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe'
  })
  name: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false
  })
  avatar?: string;
}

export class RestaurantReviewDto {
  @ApiProperty({
    description: 'Review ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'User information',
    type: UserInfoDto
  })
  user: UserInfoDto;

  @ApiProperty({
    description: 'Restaurant ID',
    example: 1,
    type: 'number'
  })
  restaurant_id: number;

  @ApiProperty({
    description: 'Order ID',
    example: 123,
    type: 'number'
  })
  order_id: number;

  @ApiProperty({
    description: 'Overall rating',
    example: 4,
    type: 'number'
  })
  rating: number;

  @ApiProperty({
    description: 'Review title',
    example: 'Great food and fast delivery!'
  })
  title: string;

  @ApiProperty({
    description: 'Review comment',
    example: 'The pizza was delicious and arrived hot. Delivery was quick too!'
  })
  comment: string;

  @ApiProperty({
    description: 'Food quality rating',
    example: 5,
    type: 'number'
  })
  food_quality: number;

  @ApiProperty({
    description: 'Delivery time rating',
    example: 4,
    type: 'number'
  })
  delivery_time: number;

  @ApiProperty({
    description: 'Packaging rating',
    example: 4,
    type: 'number'
  })
  packaging: number;

  @ApiProperty({
    description: 'Value for money rating',
    example: 4,
    type: 'number'
  })
  value_for_money: number;

  @ApiProperty({
    description: 'Is verified review',
    example: true,
    type: 'boolean'
  })
  is_verified: boolean;

  @ApiProperty({
    description: 'Review created timestamp',
    example: '2025-01-15T12:00:00Z'
  })
  created_at: string;

  @ApiProperty({
    description: 'Review updated timestamp',
    example: '2025-01-15T12:00:00Z'
  })
  updated_at: string;
}

export class ItemReviewDto {
  @ApiProperty({
    description: 'Review ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'User information',
    type: UserInfoDto
  })
  user: UserInfoDto;

  @ApiProperty({
    description: 'Item ID',
    example: 1,
    type: 'number'
  })
  item_id: number;

  @ApiProperty({
    description: 'Order ID',
    example: 123,
    type: 'number'
  })
  order_id: number;

  @ApiProperty({
    description: 'Overall rating',
    example: 4,
    type: 'number'
  })
  rating: number;

  @ApiProperty({
    description: 'Review title',
    example: 'Amazing Margherita Pizza!'
  })
  title: string;

  @ApiProperty({
    description: 'Review comment',
    example: 'Perfect crust, fresh ingredients, and great taste!'
  })
  comment: string;

  @ApiProperty({
    description: 'Taste rating',
    example: 5,
    type: 'number'
  })
  taste: number;

  @ApiProperty({
    description: 'Portion size rating',
    example: 4,
    type: 'number'
  })
  portion_size: number;

  @ApiProperty({
    description: 'Value for money rating',
    example: 4,
    type: 'number'
  })
  value_for_money: number;

  @ApiProperty({
    description: 'Is verified review',
    example: true,
    type: 'boolean'
  })
  is_verified: boolean;

  @ApiProperty({
    description: 'Review created timestamp',
    example: '2025-01-15T12:00:00Z'
  })
  created_at: string;

  @ApiProperty({
    description: 'Review updated timestamp',
    example: '2025-01-15T12:00:00Z'
  })
  updated_at: string;
}

export class ReviewPaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
    type: 'number'
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    type: 'number'
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of reviews',
    example: 150,
    type: 'number'
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    type: 'number'
  })
  total_pages: number;

  @ApiProperty({
    description: 'Has next page',
    example: true,
    type: 'boolean'
  })
  has_next: boolean;

  @ApiProperty({
    description: 'Has previous page',
    example: false,
    type: 'boolean'
  })
  has_prev: boolean;
}

export class RestaurantReviewListResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Restaurant reviews retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'List of restaurant reviews',
    type: [RestaurantReviewDto]
  })
  data: RestaurantReviewDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: ReviewPaginationDto
  })
  pagination: ReviewPaginationDto;

  @ApiProperty({
    description: 'Average rating',
    example: 4.2,
    type: 'number'
  })
  average_rating: number;

  @ApiProperty({
    description: 'Total number of reviews',
    example: 150,
    type: 'number'
  })
  total_reviews: number;
}

export class ItemReviewListResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Item reviews retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'List of item reviews',
    type: [ItemReviewDto]
  })
  data: ItemReviewDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: ReviewPaginationDto
  })
  pagination: ReviewPaginationDto;

  @ApiProperty({
    description: 'Average rating',
    example: 4.2,
    type: 'number'
  })
  average_rating: number;

  @ApiProperty({
    description: 'Total number of reviews',
    example: 150,
    type: 'number'
  })
  total_reviews: number;
}

export class UserReviewListResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'User reviews retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'List of user reviews (restaurant and item reviews combined)',
    type: [Object],
    example: [
      {
        id: 1,
        user: { id: 1, name: 'John Doe' },
        restaurant_id: 1,
        order_id: 123,
        rating: 4,
        title: 'Great food!',
        comment: 'Delicious pizza',
        review_type: 'restaurant',
        created_at: '2025-01-15T12:00:00Z'
      }
    ]
  })
  data: Array<RestaurantReviewDto | ItemReviewDto & { review_type: string }>;

  @ApiProperty({
    description: 'Pagination metadata',
    type: ReviewPaginationDto
  })
  pagination: ReviewPaginationDto;
}

export class CreateReviewResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Review created successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Created review data',
    oneOf: [
      { $ref: '#/components/schemas/RestaurantReviewDto' },
      { $ref: '#/components/schemas/ItemReviewDto' }
    ]
  })
  data: RestaurantReviewDto | ItemReviewDto;
}

export class UpdateReviewResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Review updated successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Updated review data',
    oneOf: [
      { $ref: '#/components/schemas/RestaurantReviewDto' },
      { $ref: '#/components/schemas/ItemReviewDto' }
    ]
  })
  data: RestaurantReviewDto | ItemReviewDto;
}

export class DeleteReviewResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Review deleted successfully'
  })
  message: string;
}
