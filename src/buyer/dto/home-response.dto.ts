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

  @ApiProperty({
    description: 'City name from user address',
    example: 'Chennai'
  })
  city: string;

  @ApiProperty({
    description: 'Full address from user address',
    example: 'Vigneshwar Nagar, Nanganallur, Tamilnadu'
  })
  address: string;
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

export class NearbyRestaurantDto {
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

export class WhatsOnYourMindDto {
  @ApiProperty({
    description: 'Dish ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Dish name',
    example: 'Biryani'
  })
  name: string;

  @ApiProperty({
    description: 'Dish description',
    example: 'Aromatic rice dish with spices'
  })
  description: string;

  @ApiProperty({
    description: 'Dish icon URL',
    example: 'https://example.com/biryani-icon.jpg'
  })
  icon: string;
}

export class PromotionalBannerDto {
  @ApiProperty({
    description: 'Banner title',
    example: 'Craving Something Delicious?'
  })
  title: string;

  @ApiProperty({
    description: 'Banner subtitle',
    example: 'Get your favorite meals delivered hot & fast—right to your doorstep.'
  })
  subtitle: string;

  @ApiProperty({
    description: 'Call-to-action button text',
    example: 'Order Now!'
  })
  cta_button: string;

  @ApiProperty({
    description: 'Banner image URL',
    example: '/images/promotional-thali.jpg'
  })
  image_url: string;

  @ApiProperty({
    description: 'Background color in hex',
    example: '#14b8a6'
  })
  background_color: string;
}

export class HomeDataDto {
  @ApiProperty({
    description: 'Nearby restaurants within radius',
    type: [NearbyRestaurantDto]
  })
  nearby_restaurants: NearbyRestaurantDto[];

  @ApiProperty({
    description: '"What\'s On Your Mind?" dish categories',
    type: [WhatsOnYourMindDto]
  })
  whats_on_your_mind: WhatsOnYourMindDto[];

  @ApiProperty({
    description: 'Promotional banner information',
    type: PromotionalBannerDto
  })
  promotional_banner: PromotionalBannerDto;
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
