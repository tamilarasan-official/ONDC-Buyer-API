import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 12.9716,
    type: 'number'
  })
  lat: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 77.5946,
    type: 'number'
  })
  lng: number;

  @ApiProperty({
    description: 'Source of location data',
    enum: ['default_address', 'recent_address', 'device_location'],
    example: 'default_address'
  })
  source: string;
}

export class RestaurantLocationDto {
  @ApiProperty({
    description: 'Restaurant latitude',
    example: 12.9716,
    type: 'number'
  })
  lat: number;

  @ApiProperty({
    description: 'Restaurant longitude',
    example: 77.5946,
    type: 'number'
  })
  lng: number;

  @ApiProperty({
    description: 'City name',
    example: 'Bangalore'
  })
  city: string;

  @ApiProperty({
    description: 'Locality name',
    example: 'Koramangala'
  })
  locality: string;
}

export class FeaturedRestaurantDto {
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
    type: RestaurantLocationDto
  })
  location: RestaurantLocationDto;

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
}

export class PopularCategoryDto {
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
}

export class StoreInfoDto {
  @ApiProperty({
    description: 'Store name',
    example: 'Pizza Palace'
  })
  name: string;

  @ApiProperty({
    description: 'Store logo URL',
    example: 'https://example.com/logo.jpg'
  })
  logo_url: string;
}

export class PriceDto {
  @ApiProperty({
    description: 'Price amount',
    example: 299.00,
    type: 'number'
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'INR'
  })
  currency: string;
}

export class TrendingItemDto {
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
    example: 'Classic margherita'
  })
  description: string;

  @ApiProperty({
    description: 'Item images',
    type: [String],
    example: ['https://example.com/pizza.jpg']
  })
  images: string[];

  @ApiProperty({
    description: 'Store information',
    type: StoreInfoDto
  })
  store: StoreInfoDto;

  @ApiProperty({
    description: 'Item price',
    type: PriceDto
  })
  price: PriceDto;

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
}

export class ActiveOfferDto {
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
    description: 'Offer banner image URL',
    example: 'https://example.com/offer.jpg'
  })
  banner_image_url: string;

  @ApiProperty({
    description: 'Offer code',
    example: 'PIZZA50'
  })
  offer_code: string;

  @ApiProperty({
    description: 'Store name',
    example: 'Pizza Palace'
  })
  store_name: string;
}

export class HomeDataDto {
  @ApiProperty({
    description: 'User location information',
    type: LocationDto
  })
  location: LocationDto;

  @ApiProperty({
    description: 'Featured restaurants within radius',
    type: [FeaturedRestaurantDto]
  })
  featured_restaurants: FeaturedRestaurantDto[];

  @ApiProperty({
    description: 'Popular food categories',
    type: [PopularCategoryDto]
  })
  popular_categories: PopularCategoryDto[];

  @ApiProperty({
    description: 'Trending food items',
    type: [TrendingItemDto]
  })
  trending_items: TrendingItemDto[];

  @ApiProperty({
    description: 'Active offers and promotions',
    type: [ActiveOfferDto]
  })
  active_offers: ActiveOfferDto[];
}

export class HomeResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Home page data retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Home page data',
    type: HomeDataDto
  })
  data: HomeDataDto;
}
