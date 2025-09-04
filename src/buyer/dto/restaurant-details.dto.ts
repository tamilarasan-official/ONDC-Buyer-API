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
    example: 12.9716,
    type: 'number'
  })
  lat: number;

  @ApiProperty({
    description: 'Location longitude',
    example: 77.5946,
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
