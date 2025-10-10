import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationService } from '../shared/services/location.service';
import { Store } from '../store/entities/store.entity';
import { StoreLocation } from '../store/entities/store-location.entity';
import { Category } from '../category/entities/category.entity';
import { Item } from '../item/entities/item.entity';
import { Offers } from '../offer/entities/offers.entity';
import { SearchRequestDto, SearchSuggestionsRequestDto } from './dto/search-request.dto';
import { StoreTimings } from '../store/entities/store-timings.entity';
import { StoreConfigs } from '../store/entities/store-configs.entity';
import { ItemPrices } from '../item/entities/item-prices.entity';
import { ItemQuantities } from '../item/entities/item-quantities.entity';
import { ItemAttributes } from '../item/entities/item-attributes.entity';
import { ItemCustomizationGroups } from '../item/entities/item-customization-groups.entity';
import { CustomizationRelationships } from '../item/entities/customization-relationships.entity';
import { VariantGroups } from '../variant/entities/variant-groups.entity';
import { ItemVariants } from '../variant/entities/item-variants.entity';
import { Dish } from '../dish/entities/dish.entity';
import { RestaurantReview } from '../review/entities/restaurant-review.entity';
import { ItemReview } from '../review/entities/item-review.entity';

@Injectable()
export class BuyerService {
  private readonly logger = new Logger(BuyerService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(StoreLocation)
    private readonly storeLocationRepository: Repository<StoreLocation>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Offers)
    private readonly offersRepository: Repository<Offers>,
    @InjectRepository(StoreTimings)
    private readonly storeTimingsRepository: Repository<StoreTimings>,
    @InjectRepository(StoreConfigs)
    private readonly storeConfigsRepository: Repository<StoreConfigs>,
    @InjectRepository(ItemPrices)
    private readonly itemPricesRepository: Repository<ItemPrices>,
    @InjectRepository(ItemQuantities)
    private readonly itemQuantitiesRepository: Repository<ItemQuantities>,
    @InjectRepository(ItemAttributes)
    private readonly itemAttributesRepository: Repository<ItemAttributes>,
    @InjectRepository(ItemCustomizationGroups)
    private readonly itemCustomizationGroupsRepository: Repository<ItemCustomizationGroups>,
    @InjectRepository(CustomizationRelationships)
    private readonly customizationRelationshipsRepository: Repository<CustomizationRelationships>,
    @InjectRepository(VariantGroups)
    private readonly variantGroupsRepository: Repository<VariantGroups>,
    @InjectRepository(ItemVariants)
    private readonly itemVariantsRepository: Repository<ItemVariants>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(RestaurantReview)
    private readonly restaurantReviewRepository: Repository<RestaurantReview>,
    @InjectRepository(ItemReview)
    private readonly itemReviewRepository: Repository<ItemReview>,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Get home page data with nearby restaurants, trending items, and promotional banner
   */
  async getHomeData(userId?: number, deviceLat?: number, deviceLng?: number, vegMode?: boolean) {
    this.logger.log(`🏠 Getting home page data for user: ${userId || 'guest'}`);
    this.logger.log(`📍 Input location - deviceLat: ${deviceLat}, deviceLng: ${deviceLng}`);

    try {
      // Get user location
      let userLocation;
      if (userId) {
        this.logger.log(`🔍 Fetching location for authenticated user: ${userId}`);
        userLocation = await this.locationService.getUserLocation(userId, deviceLat, deviceLng);
        this.logger.log(`📍 User location from service: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`);
      } else {
        this.logger.log(`🔍 Using device location for guest user`);
        userLocation = { 
          lat: deviceLat || 9.9352300, 
          lng: deviceLng || 78.1304040, 
          source: 'device_location' as const 
        };
        this.logger.log(`📍 Guest location: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`);
      }

      // Define search radius
      const radiusKm = 10; // 10km radius
      this.logger.log(`🔍 Search radius: ${radiusKm}km`);

      // Get all data in parallel
      this.logger.log(`🔍 Fetching nearby restaurants for location: ${userLocation.lat}, ${userLocation.lng}`);
      const [nearbyRestaurants, whatsOnYourMind, promotionalBanner] = await Promise.all([
        this.getFeaturedRestaurants(userLocation.lat, userLocation.lng, radiusKm, vegMode),
        this.getWhatsOnYourMind(),
        this.getPromotionalBanner()
      ]);

      this.logger.log(`📊 Results - Restaurants: ${nearbyRestaurants.length}, Dishes: ${whatsOnYourMind.length}`);

      const data = {
        nearby_restaurants: nearbyRestaurants,
        whats_on_your_mind: whatsOnYourMind,
        promotional_banner: promotionalBanner
      };

      this.logger.log(`✅ Home page data retrieved successfully`);
      
      return {
        success: true,
        message: 'Home page data retrieved successfully',
        data
      };

    } catch (error) {
      this.logger.error(`❌ Error getting home page data: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve home page data');
    }
  }

  /**
   * Get nearby restaurants (was getFeaturedRestaurants)
   */
  private async getFeaturedRestaurants(userLat: number, userLng: number, radiusKm: number, vegMode?: boolean) {
    try {
      this.logger.log(`🔍 Getting nearby restaurants within ${radiusKm}km of ${userLat}, ${userLng}`);
      this.logger.log(`🥬 Veg mode: ${vegMode ? 'enabled' : 'disabled'}`);

      // First, let's check total stores in database
      const totalStores = await this.storeRepository.count();
      this.logger.log(`📊 Total stores in database: ${totalStores}`);

      const activeStores = await this.storeRepository.count({ where: { status: true } });
      this.logger.log(`📊 Active stores: ${activeStores}`);

      const storesWithLocations = await this.storeRepository
        .createQueryBuilder('s')
        .leftJoin('s.locations', 'sl')
        .where('s.status = :status', { status: true })
        .andWhere('sl.gps_lat IS NOT NULL')
        .andWhere('sl.gps_lng IS NOT NULL')
        .getCount();
      this.logger.log(`📊 Stores with locations: ${storesWithLocations}`);

      const distanceFilter = this.locationService.buildDistanceFilter(userLat, userLng, radiusKm);
      const distanceSubquery = this.locationService.buildDistanceQuery(userLat, userLng, radiusKm);
      
      this.logger.log(`🔍 Distance filter: ${distanceFilter}`);
      this.logger.log(`🔍 Distance subquery: ${distanceSubquery}`);

      const queryBuilder = this.storeRepository
        .createQueryBuilder('s')
        .innerJoin('s.locations', 'sl')
        .where('s.status = :status', { status: true })
        .andWhere('sl.gps_lat IS NOT NULL')
        .andWhere('sl.gps_lng IS NOT NULL')
        .andWhere(distanceFilter)
        .select([
          'DISTINCT s.id as s_id',
          's.name as s_name',
          's.description as s_description',
          's.logo_url as s_logo_url',
          's.fssai_license_no as s_fssai_license_no',
          'sl.gps_lat as sl_gps_lat',
          'sl.gps_lng as sl_gps_lng',
          'sl.address_city as sl_address_city',
          'sl.address_locality as sl_address_locality',
          distanceSubquery
        ])
        .orderBy('distance', 'ASC')
        .addOrderBy('s.name', 'ASC'); // Secondary sort for same distances

      this.logger.log(`🔍 Executing restaurant query...`);
      const stores = await queryBuilder.getRawMany();
      this.logger.log(`🏪 Found ${stores.length} nearby restaurants`);
      
      // Debug: Log all found stores
      stores.forEach((store, index) => {
        this.logger.log(`🏪 Store ${index + 1}: ${store.s_name} (ID: ${store.s_id}) - Distance: ${store.distance}km - Lat: ${store.sl_gps_lat}, Lng: ${store.sl_gps_lng}`);
      });

      if (stores.length === 0) {
        this.logger.warn(`⚠️ No restaurants found within ${radiusKm}km of ${userLat}, ${userLng}`);
        return [];
      }

      this.logger.log(`🔍 Processing ${stores.length} restaurants...`);
      // Calculate ratings, open status, and delivery times for each restaurant
      const storesWithRatings = await Promise.all(
        stores.map(async (store, index) => {
          this.logger.log(`🔍 Processing restaurant ${index + 1}/${stores.length}: ${store.s_name} (ID: ${store.s_id})`);
          
          const distance = store.distance;
          this.logger.log(`📍 Distance: ${distance}km`);
          
          // Get rating data
          const ratingData = await this.calculateRestaurantRating(store.s_id);
          this.logger.log(`⭐ Rating: ${ratingData.rating} (${ratingData.reviewCount} reviews)`);
          
          // Check if store is open
          const storeOpenData = await this.isStoreOpen(store.s_id);
          this.logger.log(`🕐 Store open: ${storeOpenData.isOpen}`);
          
          // Calculate delivery time
          const deliveryTime = this.calculateDeliveryTime(distance, store.s_id);
          this.logger.log(`🚚 Delivery time: ${deliveryTime}`);

          return {
            id: store.s_id,
            name: store.s_name,
            description: store.s_description,
            logo_url: store.s_logo_url,
            fssai_license: store.s_fssai_license_no,
            location: {
              lat: store.sl_gps_lat,
              lng: store.sl_gps_lng,
              city: store.sl_address_city,
              locality: store.sl_address_locality
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            delivery_time: deliveryTime,
            offers_count: 0 // Will be calculated separately
          };
        })
      );
      
      // Sort by distance, then rating (highest first), then name
      storesWithRatings.sort((a, b) => {
        // First sort by distance
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        // Then by rating (highest first)
        if (a.rating !== b.rating) {
          return b.rating - a.rating;
        }
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      this.logger.log(`✅ Successfully processed and sorted ${storesWithRatings.length} restaurants`);
      return storesWithRatings;
    } catch (error) {
      this.logger.error(`❌ Error getting nearby restaurants: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * MODIFY: Get "What's On Your Mind?" dishes (was getPopularCategories)
   */
  private async getWhatsOnYourMind() {
    const dishes = await this.dishRepository
      .createQueryBuilder('d')
      .where('d.status = :status', { status: true })
      .select([
        'd.id',
        'd.name',
        'd.description',
        'd.icon'
      ])
      .orderBy('d.name', 'ASC')
      .limit(5) // Based on image: Biryani, South Indian, Pizza, Burger, Cakes
      .getMany();

    return dishes.map(dish => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      icon: dish.icon
    }));
  }

  /**
   * Get promotional banner data
   */
  private async getPromotionalBanner() {
    return {
      title: "Craving Something Delicious?",
      subtitle: "Get your favorite meals delivered hot & fast—right to your doorstep.",
      cta_button: "Order Now!",
      image_url: "https://sqc-bucket.in-maa-1.linodeobjects.com/chinese-noodles-fast-food-with-soda%20(1).jpg",
      background_color: "#14b8a6"
    };
  }

  /**
   * Get trending items near user location
   */
  private async getTrendingItems(userLat: number, userLng: number, radiusKm: number) {
    try {
      this.logger.log(`🔥 Getting trending items within ${radiusKm}km of ${userLat}, ${userLng}`);

      const distanceSubquery = this.locationService.buildDistanceQuery(userLat, userLng, radiusKm);

      const queryBuilder = this.itemRepository
        .createQueryBuilder('i')
        .leftJoin('i.store', 's')
        .leftJoin('s.locations', 'sl')
        .leftJoin('i.prices', 'p')
        .where('i.status = :status', { status: true })
        .andWhere('s.status = :status', { status: true })
        .andWhere(`(${distanceSubquery}) <= :radius`, { 
          userLat, 
          userLng, 
          radius: radiusKm 
        })
        .select([
          'i.id',
          'i.name', 
          'i.short_desc',
          'i.images',
          's.id',
          's.name',
          's.logo_url',
          'p.base_price',
          'p.currency',
          `(${distanceSubquery}) as distance`
        ])
        .orderBy('distance', 'ASC')
        .addOrderBy('i.is_recommended', 'DESC')
        .limit(20);

      const items = await queryBuilder.getRawMany();

      this.logger.log(`📱 Found ${items.length} trending items`);

      // Calculate ratings for each item
      const itemsWithRatings = await Promise.all(
        items.map(async (item) => {
          const distance = parseFloat(item.distance);
          
          // Get rating data
          const ratingData = await this.calculateItemRating(item.i_id);

          return {
            id: item.i_id,
            name: item.i_name,
            description: item.i_short_desc,
            images: item.i_images ? JSON.parse(item.i_images) : [],
            store: {
              name: item.s_name,
              logo_url: item.s_logo_url
            },
            price: {
              amount: parseFloat(item.p_base_price) || 0,
              currency: item.p_currency || 'INR'
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating
          };
        })
      );

      return itemsWithRatings;

    } catch (error) {
      this.logger.error(`❌ Error getting trending items: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get active offers
   */
  private async getActiveOffers() {
    try {
      this.logger.log(`🎁 Getting active offers`);

      const offers = await this.offersRepository
        .createQueryBuilder('o')
        .leftJoin('o.store', 's')
        .where('o.status = :status', { status: true })
        .andWhere('s.status = :status', { status: true })
        .andWhere('o.valid_from <= :now', { now: new Date() })
        .andWhere('o.valid_to >= :now', { now: new Date() })
        .select([
          'o.id',
          'o.name',
          'o.description',
          'o.offer_code',
          'o.banner_image_url',
          's.name'
        ])
        .orderBy('o.created_at', 'DESC')
        .limit(10)
        .getMany();

      this.logger.log(`🎯 Found ${offers.length} active offers`);

      return offers.map(offer => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        offer_code: offer.offer_code,
        banner_image_url: offer.banner_image_url,
        restaurant_name: offer.store?.name
      }));

    } catch (error) {
      this.logger.error(`❌ Error getting active offers: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Search functionality with enhanced filters
   */
  async search(searchParams: SearchRequestDto, userId?: number) {
    try {
      const {
        query = '',
        lat,
        lng,
        radius = 10,
        category_id,
        store_id,
        type = 'all',
        sort_by = 'distance',
        sort_order = 'asc',
        dietary_preference,
        min_price,
        max_price,
        page = 1,
        limit = 20
      } = searchParams;

      // Get user location
      const userLocation = userId 
        ? await this.locationService.getUserLocation(userId, lat, lng)
        : { lat: lat || 9.9352300, lng: lng || 78.1304040, source: 'device_location' };

      this.logger.log(`🔍 Search query: "${query}" | Location: ${userLocation.lat}, ${userLocation.lng} | Type: ${type}`);

      const results = {
        restaurants: [] as any[],
        items: [] as any[],
        categories: [] as any[]
      };

      // Search restaurants
      if (type === 'all' || type === 'restaurant') {
        results.restaurants = await this.searchRestaurants(
          query, userLocation.lat, userLocation.lng, radius, 
          category_id, store_id, sort_by, sort_order, page, limit,
          dietary_preference, min_price, max_price
        );
      }

      // Search items
      if (type === 'all' || type === 'item') {
        results.items = await this.searchItems(
          query, userLocation.lat, userLocation.lng, radius,
          category_id, store_id, sort_by, sort_order, page, limit,
          dietary_preference, min_price, max_price
        );
      }

      // Search categories
      if (type === 'all' || type === 'categories') {
        results.categories = await this.searchCategories(query, category_id, limit);
      }

      // Calculate total results
      const totalResults = results.restaurants.length + results.items.length + results.categories.length;
      const totalPages = Math.ceil(totalResults / limit);

      return {
        success: true,
        message: 'Search completed successfully',
        data: {
          location: {
            lat: userLocation.lat,
            lng: userLocation.lng,
            source: userLocation.source
          },
          restaurants: results.restaurants,
          items: results.items,
          categories: results.categories,
          meta: {
            page,
            limit,
            total: totalResults,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
            query,
            type,
            sort_by,
            sort_order
          }
        }
      };

    } catch (error) {
      this.logger.error(`❌ Search error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Search failed');
    }
  }

  /**
   * Search restaurants with enhanced filters
   */
  private async searchRestaurants(
    query: string, userLat: number, userLng: number, radius: number,
    categoryId?: number, storeId?: number, sortBy: string = 'distance',
    sortOrder: string = 'asc', page: number = 1, limit: number = 20,
    dietaryPreference?: string, minPrice?: number, maxPrice?: number
  ) {
    try {
      const distanceQuery = this.locationService.buildDistanceQuery(userLat, userLng, radius);
      const distanceFilter = this.locationService.buildDistanceFilter(userLat, userLng, radius);

      let queryBuilder = this.storeRepository
        .createQueryBuilder('s')
        .leftJoin('s.locations', 'sl')
        .leftJoin('s.items', 'i')
        .leftJoin('i.prices', 'p')
        .leftJoin('i.attributes', 'a')
        .where('s.status = :status', { status: true })
        .andWhere(distanceFilter);

      // Apply search query
      // NOTE: Extend matching to include item names as well, using partial (LIKE) match
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          '(LOWER(s.name) LIKE LOWER(:query) OR LOWER(s.description) LIKE LOWER(:query) OR LOWER(i.name) LIKE LOWER(:query))',
          { query: `%${query}%` }
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder
          .leftJoin('i.item_categories', 'ic')
          .andWhere('ic.categoryId = :categoryId', { categoryId });
      }

      // Apply store filter
      if (storeId) {
        queryBuilder = queryBuilder.andWhere('s.id = :storeId', { storeId });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        queryBuilder = queryBuilder.andWhere('a.attribute_code = :attrCode', { attrCode: 'veg_nonveg' });
        queryBuilder = queryBuilder.andWhere('a.attribute_value = :dietary', { dietary: dietaryPreference });
      }

      // Apply price filters
      if (minPrice) {
        queryBuilder = queryBuilder.andWhere('p.base_price >= :minPrice', { minPrice });
      }
      if (maxPrice) {
        queryBuilder = queryBuilder.andWhere('p.base_price <= :maxPrice', { maxPrice });
      }

      queryBuilder = queryBuilder
        .select([
          'DISTINCT s.id as s_id',
          's.name as s_name',
          's.description as s_description',
          's.logo_url as s_logo_url',
          's.fssai_license_no as s_fssai_license_no',
          'sl.gps_lat as sl_gps_lat',
          'sl.gps_lng as sl_gps_lng',
          'sl.address_city as sl_address_city',
          'sl.address_locality as sl_address_locality',
          `${distanceQuery}`
        ])
        .groupBy('s.id, sl.id');

      // Apply sorting
      if (sortBy === 'distance') {
        queryBuilder = queryBuilder.orderBy('distance', sortOrder.toUpperCase() as 'ASC' | 'DESC');
      } else if (sortBy === 'name') {
        queryBuilder = queryBuilder.orderBy('s.name', sortOrder.toUpperCase() as 'ASC' | 'DESC');
      } else if (sortBy === 'best_sellers') {
        queryBuilder = queryBuilder.orderBy('s.name', 'ASC'); // TODO: Add order count logic
      } else if (sortBy === 'highly_ordered') {
        queryBuilder = queryBuilder.orderBy('s.name', 'ASC'); // TODO: Add popularity logic
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.offset(offset).limit(limit);

      const restaurants = await queryBuilder.getRawMany();

      // Calculate ratings and additional data for each restaurant
      const restaurantsWithData = await Promise.all(
        restaurants.map(async (restaurant) => {
          const distance = parseFloat(restaurant.distance);
          
          // Get rating data
          const ratingData = await this.calculateRestaurantRating(restaurant.s_id);
          
          // Check if store is open
          const storeOpenData = await this.isStoreOpen(restaurant.s_id);
          
          // Calculate delivery time
          const deliveryTime = this.calculateDeliveryTime(distance, restaurant.s_id);

          // Count items in this restaurant
          const itemsCount = await this.itemRepository
            .createQueryBuilder('i')
            .where('i.storeId = :storeId', { storeId: restaurant.s_id })
            .andWhere('i.status = :status', { status: true })
            .getCount();

          return {
            id: restaurant.s_id,
            name: restaurant.s_name,
            description: restaurant.s_description,
            logo_url: restaurant.s_logo_url,
            fssai_license: restaurant.s_fssai_license_no,
            location: {
              lat: restaurant.sl_gps_lat,
              lng: restaurant.sl_gps_lng,
              city: restaurant.sl_address_city,
              locality: restaurant.sl_address_locality
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            delivery_time: deliveryTime,
            offers_count: 0,
            items_count: itemsCount,
            is_open: storeOpenData.isOpen
          };
        })
      );

      return restaurantsWithData;

    } catch (error) {
      this.logger.error(`❌ Error searching restaurants: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Search items with enhanced filters
   */
  private async searchItems(
    query: string, userLat: number, userLng: number, radius: number,
    categoryId?: number, storeId?: number, sortBy: string = 'distance',
    sortOrder: string = 'asc', page: number = 1, limit: number = 20,
    dietaryPreference?: string, minPrice?: number, maxPrice?: number
  ) {
    try {
      const distanceSubquery = this.locationService.buildDistanceQuery(userLat, userLng, radius);

      let queryBuilder = this.itemRepository
        .createQueryBuilder('i')
        .leftJoin('i.store', 's')
        .leftJoin('s.locations', 'sl')
        .leftJoin('i.prices', 'p')
        .leftJoin('i.quantities', 'q')
        .leftJoin('i.attributes', 'a')
        .leftJoin('i.item_categories', 'ic')
        .leftJoin('ic.category', 'c')
        .where('i.status = :status', { status: true })
        .andWhere('s.status = :status', { status: true })
        .andWhere(`(${distanceSubquery}) <= :radius`, { 
          userLat, 
          userLng, 
          radius 
        });

      // Apply search query
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          '(LOWER(i.name) LIKE LOWER(:query) OR LOWER(i.short_desc) LIKE LOWER(:query) OR LOWER(c.name) LIKE LOWER(:query))',
          { query: `%${query}%` }
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder.andWhere('ic.categoryId = :categoryId', { categoryId });
      }

      // Apply store filter
      if (storeId) {
        queryBuilder = queryBuilder.andWhere('i.storeId = :storeId', { storeId });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        queryBuilder = queryBuilder.andWhere('a.attribute_code = :attrCode', { attrCode: 'veg_nonveg' });
        queryBuilder = queryBuilder.andWhere('a.attribute_value = :dietary', { dietary: dietaryPreference });
      }

      // Apply price filters
      if (minPrice) {
        queryBuilder = queryBuilder.andWhere('p.base_price >= :minPrice', { minPrice });
      }
      if (maxPrice) {
        queryBuilder = queryBuilder.andWhere('p.base_price <= :maxPrice', { maxPrice });
      }

      queryBuilder = queryBuilder
        .select([
          'i.id',
          'i.name',
          'i.short_desc',
          'i.images',
          's.id',
          's.name',
          's.logo_url',
          'p.base_price',
          'p.currency',
          'c.id',
          'c.name',
          'q.available_count',
          `(${distanceSubquery}) as distance`
        ]);

      // Apply sorting
      if (sortBy === 'distance') {
        queryBuilder = queryBuilder.orderBy('distance', sortOrder.toUpperCase() as 'ASC' | 'DESC');
      } else if (sortBy === 'price') {
        queryBuilder = queryBuilder.orderBy('p.base_price', sortOrder.toUpperCase() as 'ASC' | 'DESC');
      } else if (sortBy === 'name') {
        queryBuilder = queryBuilder.orderBy('i.name', sortOrder.toUpperCase() as 'ASC' | 'DESC');
      } else if (sortBy === 'best_sellers') {
        queryBuilder = queryBuilder.orderBy('i.is_recommended', 'DESC');
      } else if (sortBy === 'highly_ordered') {
        queryBuilder = queryBuilder.orderBy('i.name', 'ASC'); // TODO: Add order count logic
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.offset(offset).limit(limit);

      const items = await queryBuilder.getRawMany();

      // Calculate ratings for each item
      const itemsWithData = await Promise.all(
        items.map(async (item) => {
          const distance = parseFloat(item.distance);
          
          // Get rating data
          const ratingData = await this.calculateItemRating(item.i_id);

          return {
            id: item.i_id,
            name: item.i_name,
            description: item.i_short_desc,
            images: item.i_images ? JSON.parse(item.i_images) : [],
            price: {
              amount: parseFloat(item.p_base_price) || 0,
              currency: item.p_currency || 'INR'
            },
            store: {
              id: item.s_id,
              name: item.s_name,
              logo_url: item.s_logo_url
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            category: {
              id: item.c_id,
              name: item.c_name
            },
            is_available: (item.q_available_count || 0) > 0
          };
        })
      );

      return itemsWithData;

    } catch (error) {
      this.logger.error(`❌ Error searching items: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Search categories
   */
  private async searchCategories(query: string, categoryId?: number, limit: number = 20) {
    try {
      let queryBuilder = this.categoryRepository
        .createQueryBuilder('c')
        .where('c.status = :status', { status: true });

      // Apply search query
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          '(LOWER(c.name) LIKE LOWER(:query) OR LOWER(c.description) LIKE LOWER(:query))',
          { query: `%${query}%` }
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder.andWhere('c.id = :categoryId', { categoryId });
      }

      const categories = await queryBuilder
        .select([
          'c.id',
          'c.name',
          'c.description',
          'c.icon'
        ])
        .orderBy('c.name', 'ASC')
        .limit(limit)
        .getMany();

      // Get counts for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          // Count items in this category
          const itemCount = await this.itemRepository
            .createQueryBuilder('i')
            .leftJoin('i.item_categories', 'ic')
            .where('ic.categoryId = :categoryId', { categoryId: category.id })
            .andWhere('i.status = :status', { status: true })
            .getCount();

          // Count restaurants serving this category
          const restaurantCount = await this.storeRepository
            .createQueryBuilder('s')
            .leftJoin('s.items', 'i')
            .leftJoin('i.item_categories', 'ic')
            .where('ic.categoryId = :categoryId', { categoryId: category.id })
            .andWhere('s.status = :status', { status: true })
            .getCount();

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            item_count: itemCount,
            restaurant_count: restaurantCount
          };
        })
      );

      return categoriesWithCounts;

    } catch (error) {
      this.logger.error(`❌ Error searching categories: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get restaurant details
   */
  async getRestaurantDetails(
    restaurantId: number, 
    userId?: number, 
    deviceLat?: number, 
    deviceLng?: number,
    includeItems: boolean = false,
    search?: string,
    dietaryPreference?: string
  ) {
    try {
      this.logger.log(`🏪 Getting details for restaurant ID: ${restaurantId}`);

      // Get user location for distance calculation
      const userLocation = userId 
        ? await this.locationService.getUserLocation(userId, deviceLat, deviceLng)
        : { lat: deviceLat || 9.9352300, lng: deviceLng || 78.1304040, source: 'device_location' };

      // Get restaurant basic info
      const restaurant = await this.storeRepository
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.locations', 'sl')
        .leftJoinAndSelect('s.timings', 'st')
        .leftJoinAndSelect('s.offers', 'o')
        .leftJoinAndSelect('s.configs', 'sc')
        .where('s.id = :id', { id: restaurantId })
        .andWhere('s.status = :status', { status: true })
        .getOne();

      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      // Calculate distance if location data is available
      let distance = 0;
      if (restaurant.locations && restaurant.locations.length > 0) {
        const storeLocation = restaurant.locations[0];
        distance = this.locationService.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          storeLocation.gps_lat,
          storeLocation.gps_lng
        );
      }

      // Get rating data
      const ratingData = await this.calculateRestaurantRating(restaurant.id);
      
      // Check if store is open
      const storeOpenData = await this.isStoreOpen(restaurant.id);

      // Calculate delivery time
      const deliveryTime = this.calculateDeliveryTime(distance, restaurant.id);

      // Get item counts
      const itemCount = await this.itemRepository
        .createQueryBuilder('i')
        .where('i.storeId = :storeId', { storeId: restaurant.id })
        .andWhere('i.status = :status', { status: true })
        .getCount();

      // Get category counts
      const categoryCount = await this.categoryRepository
        .createQueryBuilder('c')
        .leftJoin('c.item_categories', 'ic')
        .leftJoin('ic.item', 'i')
        .where('i.storeId = :storeId', { storeId: restaurant.id })
        .andWhere('c.status = :status', { status: true })
        .getCount();

      // Get active offers count
      const offersCount = await this.offersRepository
        .createQueryBuilder('o')
        .where('o.storeId = :storeId', { storeId: restaurant.id })
        .andWhere('o.status = :status', { status: true })
        .andWhere('o.valid_from <= :now', { now: new Date() })
        .andWhere('o.valid_to >= :now', { now: new Date() })
        .getCount();

      // Format response
      const restaurantDetails: any = {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        logo_url: restaurant.logo_url,
        fssai_license: restaurant.fssai_license_no,
        gst_number: restaurant.gst_number,
        locations: restaurant.locations?.map(location => ({
          id: location.id,
          lat: location.gps_lat,
          lng: location.gps_lng,
          locality: location.address_locality,
          street: location.address_street,
          city: location.address_city,
          area_code: location.address_area_code,
          state: location.address_state,
          delivery_radius: location.delivery_radius_km
        })) || [],
        timings: restaurant.timings?.map(timing => ({
          day: timing.day_from,
          open_time: timing.time_from,
          close_time: timing.time_to,
          is_open: this.isDayOpen(timing.day_from, timing.time_from, timing.time_to)
        })) || [],
        offers: restaurant.offers?.filter(offer => 
          offer.status && 
          new Date(offer.valid_from) <= new Date() && 
          new Date(offer.valid_to) >= new Date()
        ).map(offer => ({
          id: offer.id,
          name: offer.name,
          description: offer.description,
          offer_code: offer.offer_code,
          banner_image_url: offer.banner_image_url,
          valid_from: offer.valid_from.toISOString(),
          valid_to: offer.valid_to.toISOString()
        })) || [],
        stats: {
          total_items: itemCount,
          total_categories: categoryCount,
          active_offers: offersCount,
          average_rating: ratingData.rating,
          total_reviews: ratingData.reviewCount
        },
        is_open: storeOpenData.isOpen,
        delivery_time: deliveryTime,
        min_order_value: restaurant.configs?.[0]?.min_order_value || 0,
        delivery_fee: 30.00 // TODO: Calculate based on distance and store config
      };

      // Add categorized items if requested
      if (includeItems) {
        this.logger.log(`🍽️ Fetching categorized items for restaurant ${restaurantId}`);
        
        const categorizedItems = await this.getCategorizedItems(
          restaurantId, 
          search, 
          dietaryPreference
        );
        
        restaurantDetails.categories = categorizedItems;
        restaurantDetails.applied_filters = {
          search: search || undefined,
          dietary_preference: dietaryPreference || undefined
        };
      }

      this.logger.log(`✅ Restaurant details retrieved successfully`);

      return {
        success: true,
        message: 'Restaurant details retrieved successfully',
        data: restaurantDetails
      };

    } catch (error) {
      this.logger.error(`❌ Error getting restaurant details: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve restaurant details');
    }
  }

  /**
   * Check if restaurant is open based on current time and day
   */
  private checkRestaurantOpen(timings: StoreTimings[]): boolean {
    if (!timings || timings.length === 0) return false;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

    const todayTiming = timings.find(timing => timing.day_from <= currentDay && timing.day_to >= currentDay);
    if (!todayTiming) return false;

    const openTime = parseInt(todayTiming.time_from);
    const closeTime = parseInt(todayTiming.time_to);

    // Handle cases where closing time is next day (e.g., 2300 to 0200)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Check if specific day is open
   */
  private isDayOpen(day: number, openTime: string, closeTime: string): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    
    if (day !== currentDay) return false;
    
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const open = parseInt(openTime);
    const close = parseInt(closeTime);
    
    if (close < open) {
      return currentTime >= open || currentTime <= close;
    }
    
    return currentTime >= open && currentTime <= close;
  }

  /**
   * Get restaurant menu
   */
  async getRestaurantMenu(restaurantId: number, menuParams: any) {
    try {
      this.logger.log(`📜 Getting menu for restaurant ID: ${restaurantId}`);

      // Get restaurant basic info
      const restaurant = await this.storeRepository
        .createQueryBuilder('s')
        .where('s.id = :id', { id: restaurantId })
        .andWhere('s.status = :status', { status: true })
        .select(['s.id', 's.name'])
        .getOne();

      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      // Get menu categories with items
      const categories = await this.getMenuCategories(restaurantId, menuParams);

      // Calculate totals
      const totalItems = categories.reduce((total, category) => total + category.items.length, 0);
      const totalCategories = categories.length;

      const menuData = {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        categories,
        total_items: totalItems,
        total_categories: totalCategories,
        applied_filters: {
          category_id: menuParams.category_id,
          search: menuParams.search,
          min_price: menuParams.min_price,
          max_price: menuParams.max_price,
          dietary_preference: menuParams.dietary_preference
        }
      };

      this.logger.log(`✅ Menu retrieved successfully - ${totalCategories} categories, ${totalItems} items`);

      return {
        success: true,
        message: 'Menu retrieved successfully',
        data: menuData
      };

    } catch (error) {
      this.logger.error(`❌ Error getting restaurant menu: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve restaurant menu');
    }
  }

  /**
   * Get menu categories with items
   */
  private async getMenuCategories(restaurantId: number, menuParams: any) {
    try {
      let categoryQuery = this.categoryRepository
        .createQueryBuilder('c')
        .leftJoin('c.item_categories', 'ic')
        .leftJoin('ic.item', 'i')
        .where('i.storeId = :restaurantId', { restaurantId })
        .andWhere('c.status = :status', { status: true })
        .andWhere('i.status = :status', { status: true });

      // Apply category filter
      if (menuParams.category_id) {
        categoryQuery = categoryQuery.andWhere('c.id = :categoryId', { categoryId: menuParams.category_id });
      }

      const categories = await categoryQuery
        .select([
          'c.id',
          'c.name',
          'c.description',
          'c.icon',
          'c.display_rank'
        ])
        .groupBy('c.id')
        .orderBy('c.display_rank', 'ASC')
        .addOrderBy('c.name', 'ASC')
        .getMany();

      // Get items for each category
      const categoriesWithItems = await Promise.all(
        categories.map(async (category) => {
          const items = await this.getMenuItems(restaurantId, category.id, menuParams);
          
          return {
            id: category.id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            display_rank: category.display_rank,
            item_count: items.length,
            items
          };
        })
      );

      // Filter out empty categories if search or filters are applied
      return categoriesWithItems.filter(category => category.items.length > 0);

    } catch (error) {
      this.logger.error(`❌ Error getting menu categories: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get menu items for a category
   */
  private async getMenuItems(restaurantId: number, categoryId: number, params: any) {
    try {
      let itemQuery = this.itemRepository
        .createQueryBuilder('i')
        .leftJoin('i.item_categories', 'ic')
        .leftJoin('i.prices', 'p')
        .leftJoin('i.quantities', 'q')
        .leftJoin('i.attributes', 'a')
        .where('i.storeId = :restaurantId', { restaurantId })
        .andWhere('ic.categoryId = :categoryId', { categoryId })
        .andWhere('i.status = :status', { status: true });

      // Apply search filter
      if (params.search) {
        itemQuery = itemQuery.andWhere(
          '(LOWER(i.name) LIKE LOWER(:search) OR LOWER(i.short_desc) LIKE LOWER(:search))',
          { search: `%${params.search}%` }
        );
      }

      // Apply price filters
      if (params.min_price) {
        itemQuery = itemQuery.andWhere('p.base_price >= :minPrice', { minPrice: params.min_price });
      }
      if (params.max_price) {
        itemQuery = itemQuery.andWhere('p.base_price <= :maxPrice', { maxPrice: params.max_price });
      }

      // Apply dietary preference filter
      if (params.dietary_preference) {
        itemQuery = itemQuery.andWhere('a.attribute_code = :attrCode', { attrCode: 'veg_nonveg' });
        itemQuery = itemQuery.andWhere('a.attribute_value = :dietary', { dietary: params.dietary_preference });
      }

      const items = await itemQuery
        .select([
          'i.id',
          'i.name',
          'i.short_desc',
          'i.long_desc',
          'i.images',
          'i.is_recommended',
          'i.tax_rate',
          'i.tax_type',
          'i.hsn_code',
          'p.base_price',
          'p.currency',
          'p.maximum_price',
          'p.minimum_price_range',
          'p.maximum_price_range',
          'q.unit_type',
          'q.unit_value',
          'q.available_count',
          'q.maximum_count'
        ])
        .orderBy('i.is_recommended', 'DESC')
        .addOrderBy('i.name', 'ASC')
        .getRawMany();

      // Process items and add additional data
      const processedItems = await Promise.all(
        items.map(async (item) => {
          // Get rating data
          const ratingData = await this.calculateItemRating(item.i_id);

          // Get attributes
          const attributes = await this.itemAttributesRepository
            .createQueryBuilder('a')
            .where('a.itemId = :itemId', { itemId: item.i_id })
            .select([
              'a.attribute_code',
              'a.attribute_name',
              'a.attribute_value',
              'a.attribute_group'
            ])
            .getMany();

          // Get customizations if requested
          let customizations: any[] = [];
          if (params.include_customizations) {
            customizations = await this.getCustomizationGroups(item.i_id);
          }

          // Get variants if requested
          let variants: any[] = [];
          if (params.include_variants) {
            variants = await this.getItemVariants(item.i_id);
          }

          return {
            id: item.i_id,
            name: item.i_name,
            short_desc: item.i_short_desc,
            long_desc: item.i_long_desc,
            images: item.i_images ? JSON.parse(item.i_images) : [],
            price: {
              base_price: parseFloat(item.p_base_price) || 0,
              currency: item.p_currency || 'INR',
              maximum_price: parseFloat(item.p_maximum_price) || null,
              minimum_price_range: parseFloat(item.p_minimum_price_range) || null,
              maximum_price_range: parseFloat(item.p_maximum_price_range) || null
            },
            quantity: {
              unit_type: item.q_unit_type || 'unit',
              unit_value: parseFloat(item.q_unit_value) || 1,
              available_count: parseInt(item.q_available_count) || 0,
              maximum_count: parseInt(item.q_maximum_count) || 99
            },
            attributes: attributes.map(attr => ({
              attribute_code: attr.attribute_code,
              attribute_name: attr.attribute_name,
              attribute_value: attr.attribute_value,
              attribute_group: attr.attribute_group
            })),
            customizations,
            variants,
            rating: ratingData.rating,
            is_available: (parseInt(item.q_available_count) || 0) > 0,
            is_recommended: item.i_is_recommended || false,
            tax_rate: parseFloat(item.i_tax_rate) || null,
            tax_type: item.i_tax_type || null,
            hsn_code: item.i_hsn_code || null
          };
        })
      );

      return processedItems;

    } catch (error) {
      this.logger.error(`❌ Error getting menu items: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get customization groups for an item
   * Updated to use parent_item relation for better performance and accuracyIdm
   */
  private async getCustomizationGroups(itemId: number) {
    try {
      this.logger.log(`🔧 Getting customizations for item ${itemId}`);
      
      // Simple query: Get customization items where parentItemId = itemId
      const customizationItems = await this.itemRepository
        .createQueryBuilder('i')
        .leftJoinAndSelect('i.prices', 'p')
        .where('i."parentItemId" = :itemId', { itemId })
        .andWhere('i.type = :type', { type: 'customization' })
        .andWhere('i.status = :status', { status: true })
        .orderBy('i.id', 'ASC')
        .getMany();

      this.logger.log(`📋 Found ${customizationItems.length} customization items for item ${itemId}`);

      // For now, return a simple structure with all customization items as one group
      if (customizationItems.length === 0) {
        return [];
      }

      const options = customizationItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.prices?.[0]?.base_price || 0,
        is_default: false
      }));

      // Get the actual customization group details for this item
      const customizationGroup = await this.itemCustomizationGroupsRepository
        .createQueryBuilder('icg')
        .leftJoin('icg.item', 'i')
        .leftJoin('icg.customization_group', 'cg')
        .where('i.id = :itemId', { itemId })
        .andWhere('cg.type = :type', { type: 'custom_group' })
        .select([
          'icg.id', 
          'icg.min_selections', 
          'icg.max_selections', 
          'icg.is_mandatory',
          'cg.id',
          'cg.name',
          'cg.description'
        ])
        .getOne();

      const groupId = customizationGroup?.customization_group?.id || 1;
      const groupName = customizationGroup?.customization_group?.name || 'Customizations';
      const groupDescription = customizationGroup?.customization_group?.description || 'Available customization options';
      const minSelections = customizationGroup?.min_selections || 0;
      const maxSelections = customizationGroup?.max_selections || 1;
      const inputType = 'select'; // Default input type
      const isMandatory = customizationGroup?.is_mandatory || false;

      return [{
        id: groupId,
        name: groupName,
        description: groupDescription,
        min_selections: minSelections,
        max_selections: maxSelections,
        input_type: inputType,
        is_mandatory: isMandatory,
        options: options
      }];

    } catch (error) {
      this.logger.error(`❌ Error getting item customizations: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Check if item has customizations (efficient method)
   * Returns true if there are any customization items with parent_item = itemId
   */
  // Made public so CartService can use it (avoiding code duplication)
  async checkItemHasCustomizations(itemId: number): Promise<boolean> {
    try {
      this.logger.log(`🔍 Checking if item ${itemId} has customizations`);
      
      const count = await this.itemRepository
        .createQueryBuilder('i')
        .where('i."parentItemId" = :itemId', { itemId })
        .andWhere('i.type = :type', { type: 'customization' })
        .andWhere('i.status = :status', { status: true })
        .getCount();
      
      this.logger.log(`📊 Found ${count} customization items for item ${itemId}`);
      return count > 0;
    } catch (error) {
      this.logger.warn(`Failed to check customizations for item ${itemId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get item variants
   */
  private async getItemVariants(itemId: number) {
    try {
      const variants = await this.itemVariantsRepository
        .createQueryBuilder('iv')
        .leftJoinAndSelect('iv.variant_group', 'vg')
        .where('iv.itemId = :itemId', { itemId })
        .getMany();

      // TODO: Get variant options for each group
      return variants.map(variant => ({
        id: variant.variant_group.id,
        name: variant.variant_group.name,
        description: variant.variant_group.description,
        variants: [] // TODO: Implement variant option fetching with prices
      }));

    } catch (error) {
      this.logger.error(`❌ Error getting item variants: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Calculate restaurant rating from reviews
   */
  private async calculateRestaurantRating(storeId: number): Promise<{ rating: number; reviewCount: number }> {
    try {
      const result = await this.restaurantReviewRepository
        .createQueryBuilder('rr')
        .select('AVG(rr.rating)', 'avgRating')
        .addSelect('COUNT(rr.id)', 'reviewCount')
        .where('rr.storeId = :storeId', { storeId })
        .getRawOne();

      return {
        rating: parseFloat(result.avgRating) || 0,
        reviewCount: parseInt(result.reviewCount) || 0
      };
    } catch (error) {
      this.logger.warn(`Failed to calculate restaurant rating for store ${storeId}: ${error.message}`);
      return { rating: 0, reviewCount: 0 };
    }
  }

  /**
   * Calculate item rating from reviews
   */
  private async calculateItemRating(itemId: number): Promise<{ rating: number; reviewCount: number }> {
    try {
      const result = await this.itemReviewRepository
        .createQueryBuilder('ir')
        .select('AVG(ir.rating)', 'avgRating')
        .addSelect('COUNT(ir.id)', 'reviewCount')
        .where('ir.itemId = :itemId', { itemId })
        .getRawOne();

      return {
        rating: parseFloat(result.avgRating) || 0,
        reviewCount: parseInt(result.reviewCount) || 0
      };
    } catch (error) {
      this.logger.warn(`Failed to calculate item rating for item ${itemId}: ${error.message}`);
      return { rating: 0, reviewCount: 0 };
    }
  }

  /**
   * Check if store is currently open
   */
  private async isStoreOpen(storeId: number): Promise<{ isOpen: boolean; nextOpenTime?: string }> {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

      // Check regular timings
      const todayTiming = await this.storeTimingsRepository
        .createQueryBuilder('st')
        .where('st.storeId = :storeId', { storeId })
        .andWhere('st.day_from <= :day AND st.day_to >= :day', { day: currentDay })
        .getOne();

      if (!todayTiming) {
        return { isOpen: false };
      }

      const openTime = parseInt(todayTiming.time_from);
      const closeTime = parseInt(todayTiming.time_to);

      // Check if currently within operating hours
      let isWithinHours = false;
      if (closeTime < openTime) {
        // Handle overnight operations (e.g., 2300 to 0200)
        isWithinHours = currentTime >= openTime || currentTime <= closeTime;
      } else {
        isWithinHours = currentTime >= openTime && currentTime <= closeTime;
      }

      if (!isWithinHours) {
        return { isOpen: false, nextOpenTime: todayTiming.time_from };
      }

      // Check for special closures (holidays, maintenance, etc.)
      const specialClosure = await this.storeRepository
        .createQueryBuilder('s')
        .leftJoin('s.closeTimings', 'sct')
        .where('s.id = :storeId', { storeId })
        .andWhere('sct.close_start_datetime <= :now', { now })
        .andWhere('sct.close_end_datetime >= :now', { now })
        .getOne();

      if (specialClosure) {
        return { isOpen: false };
      }

      return { isOpen: true };

    } catch (error) {
      this.logger.warn(`Failed to check store timing for store ${storeId}: ${error.message}`);
      return { isOpen: false };
    }
  }

  /**
   * Calculate delivery time based on distance and store preparation time
   */
  private calculateDeliveryTime(distance: number, storeId?: number): string {
    try {
      // Base preparation time (in minutes)
      const basePrepTime = 15;
      
      // Distance-based delivery time (1 minute per km, minimum 5 minutes)
      const deliveryTime = Math.max(5, Math.round(distance));
      
      // Total time
      const totalTime = basePrepTime + deliveryTime;
      
      // Add some buffer time
      const bufferTime = 5;
      const finalTime = totalTime + bufferTime;
      
      // Round to nearest 5 minutes
      const roundedTime = Math.ceil(finalTime / 5) * 5;
      
      // Format as range (e.g., "25-30 mins")
      const minTime = roundedTime;
      const maxTime = roundedTime + 5;
      
      return `${minTime}-${maxTime} mins`;
    } catch (error) {
      this.logger.warn(`Failed to calculate delivery time: ${error.message}`);
      return '25-30 mins'; // Default fallback
    }
  }

  /**
   * Get search suggestions based on dishes and nearby restaurants only
   * Restaurants are sorted by distance (ascending)
   */
  async getSearchSuggestions(request: SearchSuggestionsRequestDto, userId?: number) {
    const { query, location, filters, limit = 10 } = request;
    
    this.logger.log(`🔍 Getting search suggestions for: "${query}"`);
    this.logger.log(`👤 User ID: ${userId || 'guest'}`);
    this.logger.log(`📍 Input location - lat: ${location?.lat}, lng: ${location?.lng}`);
    
    const suggestions: any[] = [];
    
    try {
      // Get user location using the same logic as search endpoint
      let userLocation;
      if (userId) {
        this.logger.log(`🔍 Fetching location for authenticated user: ${userId}`);
        userLocation = await this.locationService.getUserLocation(userId, location?.lat, location?.lng);
        this.logger.log(`📍 User location from service: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`);
      } else {
        this.logger.log(`🔍 Using device location for guest user`);
        userLocation = { 
          lat: location?.lat || 9.9352300, 
          lng: location?.lng || 78.1304040, 
          source: 'device_location' as const 
        };
      }

      // 1. Search dishes (primary suggestions)
      this.logger.log(`🔍 Searching dishes...`);
      const dishSuggestions = await this.dishRepository
        .createQueryBuilder('d')
        .where('d.status = :status', { status: true })
        .andWhere('LOWER(d.name) LIKE LOWER(:query)', { query: `%${query}%` })
        .select([
          'd.id',
          'd.name', 
          'd.description',
          'd.icon'
        ])
        .orderBy('d.name', 'ASC')
        .limit(Math.ceil(limit * 0.6)) // 60% of suggestions are dishes
        .getMany();

      this.logger.log(`🍽️ Found ${dishSuggestions.length} dishes`);

      // Add dish suggestions
      for (const dish of dishSuggestions) {
        suggestions.push({
          id: dish.id,
          name: dish.name,
          type: 'dish',
          description: dish.description,
          icon: dish.icon,
          image: dish.icon
        });
      }

      // 2. Search nearby restaurants (secondary suggestions)
      // Now always searches restaurants since we always have a location
      const remainingLimit = limit - suggestions.length;
      this.logger.log(`🔍 Remaining limit for restaurants: ${remainingLimit}`);
      
      if (remainingLimit > 0) {
        this.logger.log(`🏪 Searching nearby restaurants with location: ${userLocation.lat}, ${userLocation.lng}`);
        
        // Get nearby restaurants sorted by distance
        // Search restaurants by name OR restaurants that have items matching the query
        const restaurantSuggestions = await this.storeRepository
          .createQueryBuilder('s')
          .leftJoin('s.locations', 'sl')
          .leftJoin('s.items', 'i') // Join with items to search by item names
          .where('s.status = :status', { status: true })
          .andWhere('sl.gps_lat IS NOT NULL')
          .andWhere('sl.gps_lng IS NOT NULL')
          .andWhere(
            '(LOWER(s.name) LIKE LOWER(:query) OR LOWER(i.name) LIKE LOWER(:query))',
            { query: `%${query}%` }
          )
          .select([
            's.id',
            's.name',
            's.description', 
            's.logo_url',
            'sl.gps_lat',
            'sl.gps_lng',
            'sl.address_city',
            'sl.address_locality'
          ])
          .addSelect(
            `(6371 * acos(cos(radians(:userLat)) * cos(radians(sl.gps_lat)) * cos(radians(sl.gps_lng) - radians(:userLng)) + sin(radians(:userLat)) * sin(radians(sl.gps_lat))))`,
            'distance'
          )
          .setParameters({
            userLat: userLocation.lat,
            userLng: userLocation.lng
          })
          .groupBy('s.id, sl.gps_lat, sl.gps_lng, sl.address_city, sl.address_locality') // Group to avoid duplicates
          .orderBy('distance', 'ASC')
          .limit(remainingLimit)
          .getRawMany();

        this.logger.log(`🏪 Found ${restaurantSuggestions.length} restaurants`);

        // Add restaurant suggestions
        for (const restaurant of restaurantSuggestions) {
          suggestions.push({
            id: restaurant.s_id,
            name: restaurant.s_name,
            type: 'restaurant',
            description: restaurant.s_description,
            icon: restaurant.s_logo_url,
            image: restaurant.s_logo_url,
            distance: restaurant.distance,
            location: {
              lat: restaurant.sl_gps_lat,
              lng: restaurant.sl_gps_lng,
              city: restaurant.sl_address_city,
              locality: restaurant.sl_address_locality
            }
          });
        }
      }

      // Sort suggestions by type (dishes first, then restaurants by distance)
      suggestions.sort((a, b) => {
        if (a.type === 'dish' && b.type === 'restaurant') return -1;
        if (a.type === 'restaurant' && b.type === 'dish') return 1;
        if (a.type === 'restaurant' && b.type === 'restaurant') {
          return a.distance - b.distance; // Sort restaurants by distance
        }
        return 0;
      });

      this.logger.log(`✅ Found ${suggestions.length} total suggestions for "${query}"`);

      return {
        success: true,
        message: 'Search suggestions retrieved successfully',
        data: {
          query,
          location: {
            lat: userLocation.lat,
            lng: userLocation.lng,
            source: userLocation.source
          },
          suggestions: suggestions.slice(0, limit),
          total_suggestions: suggestions.length
        }
      };

    } catch (error) {
      this.logger.error(`❌ Error getting search suggestions: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get search suggestions');
    }
  }

  /**
   * Get item customizations for a main item
   */
  async getItemCustomizations(itemId: number) {
    try {
      this.logger.log(`🔧 Getting customizations for item ${itemId}`);

      // First, verify the item exists and is a main item
      const item = await this.itemRepository
        .createQueryBuilder('i')
        .leftJoin('i.parent_item', 'parent')
        .where('i.id = :itemId', { itemId })
        .andWhere('i.status = :status', { status: true })
        .andWhere('i.type = :type', { type: 'item' })
        .andWhere('parent.id IS NULL')
        .select(['i.id', 'i.name', 'i.type'])
        .getOne();

      if (!item) {
        throw new NotFoundException('Item not found or is not a main item');
      }

      // Check if item has customizations
      const hasCustomizations = await this.checkItemHasCustomizations(itemId);

      if (!hasCustomizations) {
        return {
          success: true,
          message: 'Item customizations retrieved successfully',
          data: {
            item_id: item.id,
            item_name: item.name,
            has_customizations: false,
            customizations: []
          }
        };
      }

      // Get customization groups and options
      const customizations = await this.getCustomizationGroups(itemId);

      return {
        success: true,
        message: 'Item customizations retrieved successfully',
        data: {
          item_id: item.id,
          item_name: item.name,
          has_customizations: true,
          customizations: customizations
        }
      };

    } catch (error) {
      this.logger.error(`❌ Error getting item customizations: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve item customizations');
    }
  }

  /**
   * Get categorized items for a restaurant with filtering and sorting
   */
  private async getCategorizedItems(
    restaurantId: number, 
    search?: string, 
    dietaryPreference?: string
  ) {
    try {
      this.logger.log(`🍽️ Getting categorized items for restaurant ${restaurantId}`);
      this.logger.log(`🔍 Search: ${search || 'none'}, Dietary: ${dietaryPreference || 'none'}`);

      // Get categories with their items
      const categoriesQuery = this.categoryRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.item_categories', 'ic')
        .leftJoinAndSelect('ic.item', 'i')
        .leftJoinAndSelect('i.prices', 'p')
        .leftJoinAndSelect('i.attributes', 'a')
        .leftJoinAndSelect('i.parent_item', 'parent')
        .where('c.storeId = :storeId', { storeId: restaurantId })
        .andWhere('c.status = :status', { status: true })
        .andWhere('i.status = :status', { status: true });

      // Apply search filter
      if (search && search.trim()) {
        categoriesQuery.andWhere('LOWER(i.name) LIKE LOWER(:search)', { 
          search: `%${search.trim()}%` 
        });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        categoriesQuery.andWhere('a.attribute_code = :attrCode', { 
          attrCode: 'veg_nonveg' 
        });
        categoriesQuery.andWhere('a.attribute_value = :attrValue', { 
          attrValue: dietaryPreference 
        });
      }

      const categories = await categoriesQuery
        .orderBy('c.display_rank', 'ASC')
        .addOrderBy('i.name', 'ASC')
        .getMany();

      // Process categories and items
      const processedCategories: any[] = [];
      
      for (const category of categories) {
        if (!category.item_categories || category.item_categories.length === 0) {
          continue; // Skip categories with no items
        }

        // Get items with ratings (only main items, not customization items)
        const items: any[] = [];
        for (const itemCategory of category.item_categories) {
          const item = itemCategory.item;
          if (!item) continue;

          // Only show main items (type='item' and parent_item=null)
          if (item.type !== 'item' || item.parent_item !== null) {
            continue;
          }

          // Get item rating
          const itemRating = await this.calculateItemRating(item.id);
          
          // Get dietary preference from attributes
          const dietaryAttr = item.attributes?.find(attr => attr.attribute_code === 'veg_nonveg');
          const dietaryPref = dietaryAttr?.attribute_value || 'non-veg';

          // Get base price
          const basePrice = item.prices?.[0]?.base_price || 0;
          const currency = item.prices?.[0]?.currency || 'INR';

          // Check if item has customizations (more efficient)
          const hasCustomizations = await this.checkItemHasCustomizations(item.id);

          items.push({
            id: item.id,
            name: item.name,
            description: item.short_desc || '',
            long_description: item.long_desc || undefined,
            images: item.images || [],
            price: {
              base_price: basePrice,
              currency: currency
            },
            rating: itemRating.rating,
            is_available: item.status,
            is_recommended: item.is_recommended,
            dietary_preference: dietaryPref,
            has_customizations: hasCustomizations
          });
        }

        // Sort items by rating (highest first)
        items.sort((a, b) => b.rating - a.rating);

        if (items.length > 0) {
          processedCategories.push({
            id: category.id,
            name: category.name,
            description: category.description || '',
            icon: category.icon || '',
            items: items,
            item_count: items.length
          });
        }
      }

      this.logger.log(`✅ Found ${processedCategories.length} categories with items`);
      return processedCategories;

    } catch (error) {
      this.logger.error(`❌ Error getting categorized items: ${error.message}`, error.stack);
      return []; // Return empty array on error to not break the main response
    }
  }

}