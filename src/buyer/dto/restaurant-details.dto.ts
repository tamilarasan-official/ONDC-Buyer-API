import { ApiProperty } from '@nestjs/swagger';

export class RestaurantTimingDto {
  @ApiProperty({
    description: 'Day of week (1-7, Monday to Sunday)',
    example: 1,
    type: 'number'
  })
  day: number;

  @ApiProperty({
    description: 'Opening time in HHMM format',
    example: '0900'
  })
  open_time: string;

  @ApiProperty({
    description: 'Closing time in HHMM format',
    example: '2200'
  })
  close_time: string;

  @ApiProperty({
    description: 'Is restaurant open on this day',
    example: true,
    type: 'boolean'
  })
  is_open: boolean;
}

export class RestaurantLocationDto {
  @ApiProperty({
    description: 'Location ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Location latitude',
    example: 9.9352300,
    type: 'number'
  })
  lat: number;

  @ApiProperty({
    description: 'Location longitude',
    example: 78.1304040,
    type: 'number'
  })
  lng: number;

  @ApiProperty({
    description: 'Address locality',
    example: 'Koramangala'
  })
  locality: string;

  @ApiProperty({
    description: 'Address street',
    example: '5th Block'
  })
  street: string;

  @ApiProperty({
    description: 'City name',
    example: 'Bangalore'
  })
  city: string;

  @ApiProperty({
    description: 'Area code',
    example: '560034'
  })
  area_code: string;

  @ApiProperty({
    description: 'State code',
    example: 'KA'
  })
  state: string;

  @ApiProperty({
    description: 'Delivery radius in kilometers',
    example: 5,
    type: 'number'
  })
  delivery_radius: number;
}

export class RestaurantOfferDto {
  @ApiProperty({
    description: 'Offer ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Offer name',
    example: '50% Off on Pizza'
  })
  name: string;

  @ApiProperty({
    description: 'Offer description',
    example: 'Get 50% off on all pizzas'
  })
  description: string;

  @ApiProperty({
    description: 'Offer code',
    example: 'PIZZA50'
  })
  offer_code: string;

  @ApiProperty({
    description: 'Offer banner image URL',
    example: 'https://example.com/offer.jpg'
  })
  banner_image_url: string;

  @ApiProperty({
    description: 'Offer valid from date',
    example: '2025-01-01T00:00:00Z'
  })
  valid_from: string;

  @ApiProperty({
    description: 'Offer valid to date',
    example: '2025-01-31T23:59:59Z'
  })
  valid_to: string;
}

export class ItemCustomizationOptionDto {
  @ApiProperty({
    description: 'Option ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Option name',
    example: 'Thin Crust'
  })
  name: string;

  @ApiProperty({
    description: 'Option price',
    example: 0,
    type: 'number'
  })
  price: number;

  @ApiProperty({
    description: 'Is default option',
    example: true,
    type: 'boolean'
  })
  is_default: boolean;
}

export class ItemCustomizationGroupDto {
  @ApiProperty({
    description: 'Customization group ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Group name',
    example: 'Crust'
  })
  name: string;

  @ApiProperty({
    description: 'Group description',
    example: 'Choose your pizza crust'
  })
  description: string;

  @ApiProperty({
    description: 'Minimum selections required',
    example: 1,
    type: 'number'
  })
  min_selections: number;

  @ApiProperty({
    description: 'Maximum selections allowed',
    example: 1,
    type: 'number'
  })
  max_selections: number;

  @ApiProperty({
    description: 'Input type',
    example: 'select',
    enum: ['select', 'radio', 'checkbox']
  })
  input_type: string;

  @ApiProperty({
    description: 'Is mandatory',
    example: true,
    type: 'boolean'
  })
  is_mandatory: boolean;

  @ApiProperty({
    description: 'Available options',
    type: [ItemCustomizationOptionDto]
  })
  options: ItemCustomizationOptionDto[];
}

export class RestaurantItemDto {
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
    description: 'Item short description',
    example: 'Classic margherita with fresh mozzarella'
  })
  description: string;

  @ApiProperty({
    description: 'Item long description',
    example: 'Traditional Italian pizza with fresh mozzarella, tomato sauce, and basil',
    required: false
  })
  long_description?: string;

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
      base_price: { type: 'number', example: 299.00 },
      currency: { type: 'string', example: 'INR' }
    }
  })
  price: {
    base_price: number;
    currency: string;
  };

  @ApiProperty({
    description: 'Item rating',
    example: 4.2,
    type: 'number'
  })
  rating: number;

  @ApiProperty({
    description: 'Is item available',
    example: true,
    type: 'boolean'
  })
  is_available: boolean;

  @ApiProperty({
    description: 'Is item recommended',
    example: true,
    type: 'boolean'
  })
  is_recommended: boolean;

  @ApiProperty({
    description: 'Dietary preference',
    example: 'veg',
    enum: ['veg', 'non-veg', 'eggterian']
  })
  dietary_preference: string;

  @ApiProperty({
    description: 'Food type',
    example: 'Veg',
    required: false
  })
  food_type?: string;

  @ApiProperty({
    description: 'Cuisine tags',
    example: 'South Indian, North Indian, Chinese',
    required: false
  })
  cuisine_tags?: string;

  @ApiProperty({
    description: 'Has customizations',
    example: true,
    type: 'boolean'
  })
  has_customizations: boolean;

  @ApiProperty({
    description: 'Customization groups (always included in response)',
    type: [ItemCustomizationGroupDto]
  })
  customizations: ItemCustomizationGroupDto[];

  @ApiProperty({
    description: 'Is item marked as favorite by the logged-in user',
    example: false,
    type: 'boolean'
  })
  is_favorite: boolean;
}

export class RestaurantCategoryDto {
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
    description: 'Items in this category',
    type: [RestaurantItemDto]
  })
  items: RestaurantItemDto[];

  @ApiProperty({
    description: 'Number of items in this category',
    example: 15,
    type: 'number'
  })
  item_count: number;
}

export class RestaurantStatsDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 45,
    type: 'number'
  })
  total_items: number;

  @ApiProperty({
    description: 'Number of categories',
    example: 8,
    type: 'number'
  })
  total_categories: number;

  @ApiProperty({
    description: 'Number of active offers',
    example: 3,
    type: 'number'
  })
  active_offers: number;

  @ApiProperty({
    description: 'Average rating',
    example: 4.5,
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

export class RestaurantDetailsDto {
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
    example: 'Best pizza in town with authentic Italian flavors'
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
    description: 'GST number',
    example: '22AAAAA0000A1Z5'
  })
  gst_number: string;

  @ApiProperty({
    description: 'Food type',
    example: 'Veg',
    required: false
  })
  food_type?: string;

  @ApiProperty({
    description: 'Cuisine tags',
    example: 'South Indian, North Indian, Chinese',
    required: false
  })
  cuisine_tags?: string;

  @ApiProperty({
    description: 'Restaurant locations',
    type: [RestaurantLocationDto]
  })
  locations: RestaurantLocationDto[];

  @ApiProperty({
    description: 'Restaurant timings',
    type: [RestaurantTimingDto]
  })
  timings: RestaurantTimingDto[];

  @ApiProperty({
    description: 'Active offers',
    type: [RestaurantOfferDto]
  })
  offers: RestaurantOfferDto[];

  @ApiProperty({
    description: 'Restaurant statistics',
    type: RestaurantStatsDto
  })
  stats: RestaurantStatsDto;

  @ApiProperty({
    description: 'Is restaurant currently open',
    example: true,
    type: 'boolean'
  })
  is_open: boolean;

  @ApiProperty({
    description: 'Estimated delivery time',
    example: '25-30 mins'
  })
  delivery_time: string;

  @ApiProperty({
    description: 'Minimum order value',
    example: 199.00,
    type: 'number'
  })
  min_order_value: number;

  @ApiProperty({
    description: 'Delivery fee',
    example: 30.00,
    type: 'number'
  })
  delivery_fee: number;

  @ApiProperty({
    description: 'Categorized items (only included when include_items=true)',
    type: [RestaurantCategoryDto],
    required: false
  })
  categories?: RestaurantCategoryDto[];

  @ApiProperty({
    description: 'Applied filters for items',
    required: false,
    example: {
      search: 'pizza',
      dietary_preference: 'veg'
    }
  })
  applied_filters?: {
    search?: string;
    dietary_preference?: string;
  };
}

export class RestaurantDetailsResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Restaurant details retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Restaurant details data',
    type: RestaurantDetailsDto
  })
  data: RestaurantDetailsDto;
}
