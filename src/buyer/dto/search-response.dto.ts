import { ApiProperty } from '@nestjs/swagger';

export class SearchRestaurantDto {
  @ApiProperty({
    description: 'Restaurant ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Restaurant name',
    example: 'Pizza Palace'
  })
  name: string;

  @ApiProperty({
    description: 'Restaurant description',
    example: 'Best pizza in town'
  })
  description: string;

  @ApiProperty({
    description: 'Restaurant logo URL',
    example: 'https://example.com/logo.jpg'
  })
  logo_url: string;

  @ApiProperty({
    description: 'FSSAI license number',
    example: '12345678901234'
  })
  fssai_license: string;

  @ApiProperty({
    description: 'Restaurant location details',
    type: 'object',
    properties: {
      lat: { type: 'number', example: 12.9716 },
      lng: { type: 'number', example: 77.5946 },
      city: { type: 'string', example: 'Bangalore' },
      locality: { type: 'string', example: 'Koramangala' }
    }
  })
  location: {
    lat: number;
    lng: number;
    city: string;
    locality: string;
  };

  @ApiProperty({
    description: 'Distance from user in kilometers',
    example: 2.5,
    type: 'number'
  })
  distance: number;

  @ApiProperty({
    description: 'Restaurant rating',
    example: 4.5,
    type: 'number'
  })
  rating: number;

  @ApiProperty({
    description: 'Estimated delivery time',
    example: '25-30 mins'
  })
  delivery_time: string;

  @ApiProperty({
    description: 'Number of active offers',
    example: 3,
    type: 'number'
  })
  offers_count: number;

  @ApiProperty({
    description: 'Number of items available',
    example: 45,
    type: 'number'
  })
  items_count: number;

  @ApiProperty({
    description: 'Is restaurant currently open',
    example: true,
    type: 'boolean'
  })
  is_open: boolean;
}

export class SearchItemDto {
  @ApiProperty({
    description: 'Item ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Item name',
    example: 'Margherita Pizza'
  })
  name: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Classic margherita with fresh mozzarella'
  })
  description: string;

  @ApiProperty({
    description: 'Item images',
    type: [String],
    example: ['https://example.com/pizza.jpg']
  })
  images: string[];

  @ApiProperty({
    description: 'Item price',
    type: 'object',
    properties: {
      amount: { type: 'number', example: 299.00 },
      currency: { type: 'string', example: 'INR' }
    }
  })
  price: {
    amount: number;
    currency: string;
  };

  @ApiProperty({
    description: 'Store information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Pizza Palace' },
      logo_url: { type: 'string', example: 'https://example.com/logo.jpg' }
    }
  })
  store: {
    id: number;
    name: string;
    logo_url: string;
  };

  @ApiProperty({
    description: 'Distance from user in kilometers',
    example: 1.2,
    type: 'number'
  })
  distance: number;

  @ApiProperty({
    description: 'Item rating',
    example: 4.2,
    type: 'number'
  })
  rating: number;

  @ApiProperty({
    description: 'Category information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Pizza' }
    }
  })
  category: {
    id: number;
    name: string;
  };

  @ApiProperty({
    description: 'Is item currently available',
    example: true,
    type: 'boolean'
  })
  is_available: boolean;
}

export class SearchCategoryDto {
  @ApiProperty({
    description: 'Category ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Category name',
    example: 'Pizza'
  })
  name: string;

  @ApiProperty({
    description: 'Category description',
    example: 'Delicious pizzas'
  })
  description: string;

  @ApiProperty({
    description: 'Category icon URL',
    example: 'https://example.com/pizza-icon.jpg'
  })
  icon: string;

  @ApiProperty({
    description: 'Number of items in this category',
    example: 25,
    type: 'number'
  })
  item_count: number;

  @ApiProperty({
    description: 'Number of restaurants serving this category',
    example: 8,
    type: 'number'
  })
  restaurant_count: number;
}

export class SearchMetaDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
    type: 'number'
  })
  page: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    type: 'number'
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of results',
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

  @ApiProperty({
    description: 'Search query used',
    example: 'pizza'
  })
  query: string;

  @ApiProperty({
    description: 'Search type used',
    example: 'all'
  })
  type: string;

  @ApiProperty({
    description: 'Sort criteria used',
    example: 'distance'
  })
  sort_by: string;

  @ApiProperty({
    description: 'Sort order used',
    example: 'asc'
  })
  sort_order: string;
}

export class SearchDataDto {
  @ApiProperty({
    description: 'User location information',
    type: 'object',
    properties: {
      lat: { type: 'number', example: 12.9716 },
      lng: { type: 'number', example: 77.5946 },
      source: { type: 'string', example: 'default_address' }
    }
  })
  location: {
    lat: number;
    lng: number;
    source: string;
  };

  @ApiProperty({
    description: 'Search results for restaurants',
    type: [SearchRestaurantDto]
  })
  restaurants: SearchRestaurantDto[];

  @ApiProperty({
    description: 'Search results for items',
    type: [SearchItemDto]
  })
  items: SearchItemDto[];

  @ApiProperty({
    description: 'Search results for categories',
    type: [SearchCategoryDto]
  })
  categories: SearchCategoryDto[];

  @ApiProperty({
    description: 'Pagination and search metadata',
    type: SearchMetaDto
  })
  meta: SearchMetaDto;
}

export class SearchResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Search completed successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Search results data',
    type: SearchDataDto
  })
  data: SearchDataDto;
}
