import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationService } from '../shared/services/location.service';
import { Store } from '../store/entities/store.entity';
import { StoreLocation } from '../store/entities/store-location.entity';
import { Category } from '../category/entities/category.entity';
import { Item } from '../item/entities/item.entity';
import { Offers } from '../offer/entities/offers.entity';
import { SearchRequestDto } from './dto/search-request.dto';
import { StoreTimings } from '../store/entities/store-timings.entity';
import { StoreConfigs } from '../store/entities/store-configs.entity';
import { ItemPrices } from '../item/entities/item-prices.entity';
import { ItemQuantities } from '../item/entities/item-quantities.entity';
import { ItemAttributes } from '../item/entities/item-attributes.entity';
import { ItemCustomizationGroups } from '../item/entities/item-customization-groups.entity';
import { CustomizationRelationships } from '../item/entities/customization-relationships.entity';
import { VariantGroups } from '../variant/entities/variant-groups.entity';
import { ItemVariants } from '../variant/entities/item-variants.entity';

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
    private readonly locationService: LocationService,
  ) {}

  /**
   * Get home page data with location-based filtering
   */
  async getHomeData(userId?: number, deviceLat?: number, deviceLng?: number) {
    try {
      // Get user location
      const userLocation = userId 
        ? await this.locationService.getUserLocation(userId, deviceLat, deviceLng)
        : { lat: deviceLat || 12.9716, lng: deviceLng || 77.5946, source: 'device_location' };

      this.logger.log(`📍 User location: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`);

      // Get featured restaurants (within 10km radius)
      const featuredRestaurants = await this.getFeaturedRestaurants(
        userLocation.lat, 
        userLocation.lng, 
        10
      );

      // Get popular categories
      const popularCategories = await this.getPopularCategories();

      // Get trending items
      const trendingItems = await this.getTrendingItems(
        userLocation.lat, 
        userLocation.lng, 
        10
      );

      // Get active offers
      const activeOffers = await this.getActiveOffers();

      return {
        success: true,
        message: 'Home page data retrieved successfully',
        data: {
          location: {
            lat: userLocation.lat,
            lng: userLocation.lng,
            source: userLocation.source
          },
          featured_restaurants: featuredRestaurants,
          popular_categories: popularCategories,
          trending_items: trendingItems,
          active_offers: activeOffers
        }
      };
    } catch (error) {
      this.logger.error(`❌ Error getting home data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get featured restaurants within radius
   */
  private async getFeaturedRestaurants(userLat: number, userLng: number, radiusKm: number) {
    this.logger.log(`🔍 Getting featured restaurants for location: ${userLat}, ${userLng} within ${radiusKm}km`);
    
    // First, let's check if we have any stores at all
    const totalStores = await this.storeRepository.count();
    this.logger.log(`📊 Total stores in database: ${totalStores}`);
    
    // Check active stores
    const activeStores = await this.storeRepository.count({ where: { status: true } });
    this.logger.log(`📊 Active stores: ${activeStores}`);
    
    // Check stores with locations
    const storesWithLocations = await this.storeRepository
      .createQueryBuilder('s')
      .leftJoin('s.locations', 'sl')
      .where('s.status = :status', { status: true })
      .andWhere('sl.id IS NOT NULL')
      .getCount();
    this.logger.log(`📊 Stores with locations: ${storesWithLocations}`);

    // Get all stores with their locations (no distance filter first)
    const allStores = await this.storeRepository
      .createQueryBuilder('s')
      .leftJoin('s.locations', 'sl')
      .where('s.status = :status', { status: true })
      .select([
        's.id',
        's.name',
        's.description',
        's.logo_url',
        's.fssai_license_no',
        'sl.gps_lat',
        'sl.gps_lng',
        'sl.address_city',
        'sl.address_locality'
      ])
      .getRawMany();
      
    this.logger.log(`📊 All active stores with location data: ${allStores.length}`);
    
    // Log the first few stores for debugging
    allStores.slice(0, 3).forEach((store, index) => {
      this.logger.log(`📊 Store ${index + 1}: ID=${store.s_id}, Name=${store.s_name}, Lat=${store.sl_gps_lat}, Lng=${store.sl_gps_lng}`);
    });
    
    // Filter by distance
    const filteredStores = allStores.filter(store => {
      if (!store.sl_gps_lat || !store.sl_gps_lng) {
        this.logger.log(`⚠️ Store ${store.s_id} has no location data`);
        return false;
      }
      
      const distance = this.locationService.calculateDistance(
        userLat, userLng,
        store.sl_gps_lat, store.sl_gps_lng
      );
      
      this.logger.log(`➡️ Store ${store.s_id} distance: ${distance.toFixed(2)}km`);
      return distance <= radiusKm;
    });
    
    this.logger.log(`📊 Stores within ${radiusKm}km: ${filteredStores.length}`);
    
    return filteredStores.map(store => {
      const distance = this.locationService.calculateDistance(
        userLat, userLng,
        store.sl_gps_lat, store.sl_gps_lng
      );
      
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
        rating: 4.5,
        delivery_time: '25-30 mins',
        offers_count: 0 // Will be calculated separately
      };
    });
  }

  /**
   * Get popular categories
   */
  private async getPopularCategories() {
    const categories = await this.categoryRepository
      .createQueryBuilder('c')
      .leftJoin('c.items', 'i')
      .where('c.status = :status', { status: true })
      .andWhere('c.type = :type', { type: 'custom_menu' })
      .select([
        'c.id',
        'c.name',
        'c.description',
        'c.icon',
        'COUNT(i.id) as item_count'
      ])
      .groupBy('c.id')
      .orderBy('item_count', 'DESC')
      .limit(8)
      .getRawMany();

    return categories.map(category => ({
      id: category.c_id,
      name: category.c_name,
      description: category.c_description,
      icon: category.c_icon,
      item_count: parseInt(category.item_count)
    }));
  }

  /**
   * Get trending items within radius
   */
  private async getTrendingItems(userLat: number, userLng: number, radiusKm: number) {
    const distanceQuery = this.locationService.buildDistanceQuery(userLat, userLng, radiusKm);
    const distanceFilter = this.locationService.buildDistanceFilter(userLat, userLng, radiusKm);

    const items = await this.itemRepository
      .createQueryBuilder('i')
      .leftJoin('i.store', 's')
      .leftJoin('s.locations', 'sl')
      .leftJoin('i.prices', 'p')
      .where('i.status = :status', { status: true })
      .andWhere('i.type = :type', { type: 'item' })
      .andWhere(distanceFilter)
      .select([
        'i.id',
        'i.name',
        'i.short_desc',
        'i.images',
        's.name as store_name',
        's.logo_url as store_logo',
        'p.base_price',
        'p.currency',
        distanceQuery
      ])
      .orderBy('distance', 'ASC')
      .limit(12)
      .getRawMany();

    return items.map(item => ({
      id: item.i_id,
      name: item.i_name,
      description: item.i_short_desc,
      images: item.i_images || [],
      store: {
        name: item.s_name,
        logo_url: item.s_logo_url
      },
      price: {
        amount: item.p_base_price,
        currency: item.p_currency
      },
      distance: Math.round(item.distance * 100) / 100,
      rating: 4.2 // TODO: Calculate from reviews
    }));
  }

  /**
   * Get active offers
   */
  private async getActiveOffers() {
    const now = new Date();
    const offers = await this.offersRepository
      .createQueryBuilder('o')
      .leftJoin('o.store', 's')
      .where('o.status = :status', { status: true })
      .andWhere('o.valid_from <= :now', { now })
      .andWhere('o.valid_to >= :now', { now })
      .select([
        'o.id',
        'o.name',
        'o.description',
        'o.banner_image_url',
        'o.offer_code',
        's.name as store_name'
      ])
      .orderBy('o.created_at', 'DESC')
      .limit(5)
      .getRawMany();

    return offers.map(offer => ({
      id: offer.o_id,
      name: offer.o_name,
      description: offer.o_description,
      banner_image_url: offer.o_banner_image_url,
      offer_code: offer.o_offer_code,
      store_name: offer.s_name
    }));
  }

  /**
   * Search restaurants, items, and categories with location-based filtering
   */
  async search(searchParams: SearchRequestDto, userId?: number) {
    try {
      // Set default values
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
        page = 1,
        limit = 20
      } = searchParams;

      // Get user location
      const userLocation = userId 
        ? await this.locationService.getUserLocation(userId, lat, lng)
        : { lat: lat || 12.9716, lng: lng || 77.5946, source: 'device_location' };

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
          category_id, store_id, sort_by, sort_order, page, limit
        );
      }

      // Search items
      if (type === 'all' || type === 'item') {
        results.items = await this.searchItems(
          query, userLocation.lat, userLocation.lng, radius,
          category_id, store_id, sort_by, sort_order, page, limit
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
      this.logger.error(`❌ Search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Search restaurants with location-based filtering
   */
  private async searchRestaurants(
    query: string, userLat: number, userLng: number, radius: number,
    categoryId?: number, storeId?: number, sortBy: string = 'distance',
    sortOrder: string = 'asc', page: number = 1, limit: number = 20
  ) {
    const distanceQuery = this.locationService.buildDistanceQuery(userLat, userLng, radius);
    const distanceFilter = this.locationService.buildDistanceFilter(userLat, userLng, radius);

    let queryBuilder = this.storeRepository
      .createQueryBuilder('s')
      .leftJoin('s.locations', 'sl')
      .leftJoin('s.offers', 'o')
      .leftJoin('s.items', 'i')
      .where('s.status = :status', { status: true })
      .andWhere(distanceFilter);

    // Add search query filter
    if (query) {
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(s.name) LIKE LOWER(:query) OR LOWER(s.description) LIKE LOWER(:query))',
        { query: `%${query}%` }
      );
    }

    // Add category filter
    if (categoryId) {
      queryBuilder = queryBuilder.andWhere('i.category_id = :categoryId', { categoryId });
    }

    // Add store filter
    if (storeId) {
      queryBuilder = queryBuilder.andWhere('s.id = :storeId', { storeId });
    }

    // Add sorting
    if (sortBy === 'distance') {
      queryBuilder = queryBuilder.orderBy('distance', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (sortBy === 'rating') {
      queryBuilder = queryBuilder.orderBy('s.rating', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (sortBy === 'name') {
      queryBuilder = queryBuilder.orderBy('s.name', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder = queryBuilder.skip(skip).limit(limit);

    const restaurants = await queryBuilder
      .select([
        's.id',
        's.name',
        's.description',
        's.logo_url',
        's.fssai_license_no',
        'sl.gps_lat',
        'sl.gps_lng',
        'sl.address_city',
        'sl.address_locality',
        distanceQuery,
        'COUNT(DISTINCT i.id) as items_count',
        'COUNT(DISTINCT o.id) as offers_count'
      ])
      .groupBy('s.id, sl.id')
      .getRawMany();

    return restaurants.map(restaurant => ({
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
      distance: Math.round(restaurant.distance * 100) / 100,
      rating: 4.5, // TODO: Calculate from reviews
      delivery_time: '25-30 mins', // TODO: Calculate from store timings
      offers_count: parseInt(restaurant.offers_count) || 0,
      items_count: parseInt(restaurant.items_count) || 0,
      is_open: true // TODO: Calculate from store timings
    }));
  }

  /**
   * Search items with location-based filtering
   */
  private async searchItems(
    query: string, userLat: number, userLng: number, radius: number,
    categoryId?: number, storeId?: number, sortBy: string = 'distance',
    sortOrder: string = 'asc', page: number = 1, limit: number = 20
  ) {
    const distanceQuery = this.locationService.buildDistanceQuery(userLat, userLng, radius);
    const distanceFilter = this.locationService.buildDistanceFilter(userLat, userLng, radius);

    let queryBuilder = this.itemRepository
      .createQueryBuilder('i')
      .leftJoin('i.store', 's')
      .leftJoin('s.locations', 'sl')
      .leftJoin('i.prices', 'p')
      .leftJoin('i.category', 'c')
      .where('i.status = :status', { status: true })
      .andWhere('i.type = :type', { type: 'item' })
      .andWhere(distanceFilter);

    // Add search query filter
    if (query) {
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(i.name) LIKE LOWER(:query) OR LOWER(i.short_desc) LIKE LOWER(:query) OR LOWER(i.long_desc) LIKE LOWER(:query))',
        { query: `%${query}%` }
      );
    }

    // Add category filter
    if (categoryId) {
      queryBuilder = queryBuilder.andWhere('i.category_id = :categoryId', { categoryId });
    }

    // Add store filter
    if (storeId) {
      queryBuilder = queryBuilder.andWhere('i.store_id = :storeId', { storeId });
    }

    // Add sorting
    if (sortBy === 'distance') {
      queryBuilder = queryBuilder.orderBy('distance', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (sortBy === 'rating') {
      queryBuilder = queryBuilder.orderBy('i.rating', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (sortBy === 'price') {
      queryBuilder = queryBuilder.orderBy('p.base_price', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (sortBy === 'name') {
      queryBuilder = queryBuilder.orderBy('i.name', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder = queryBuilder.skip(skip).limit(limit);

    const items = await queryBuilder
      .select([
        'i.id',
        'i.name',
        'i.short_desc',
        'i.images',
        's.id as store_id',
        's.name as store_name',
        's.logo_url as store_logo',
        'p.base_price',
        'p.currency',
        'c.id as category_id',
        'c.name as category_name',
        distanceQuery
      ])
      .getRawMany();

    return items.map(item => ({
      id: item.i_id,
      name: item.i_name,
      description: item.i_short_desc,
      images: item.i_images || [],
      price: {
        amount: item.p_base_price,
        currency: item.p_currency
      },
      store: {
        id: item.store_id,
        name: item.store_name,
        logo_url: item.store_logo
      },
      distance: Math.round(item.distance * 100) / 100,
      rating: 4.2, // TODO: Calculate from reviews
      category: {
        id: item.category_id,
        name: item.category_name
      },
      is_available: true // TODO: Check item availability
    }));
  }

  /**
   * Search categories
   */
  private async searchCategories(query: string, categoryId?: number, limit: number = 20) {
    let queryBuilder = this.categoryRepository
      .createQueryBuilder('c')
      .leftJoin('c.items', 'i')
      .leftJoin('c.store', 's')
      .where('c.status = :status', { status: true })
      .andWhere('c.type = :type', { type: 'custom_menu' });

    // Add search query filter
    if (query) {
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(c.name) LIKE LOWER(:query) OR LOWER(c.description) LIKE LOWER(:query))',
        { query: `%${query}%` }
      );
    }

    // Add category filter
    if (categoryId) {
      queryBuilder = queryBuilder.andWhere('c.id = :categoryId', { categoryId });
    }

    const categories = await queryBuilder
      .select([
        'c.id',
        'c.name',
        'c.description',
        'c.icon',
        'COUNT(DISTINCT i.id) as item_count',
        'COUNT(DISTINCT s.id) as restaurant_count'
      ])
      .groupBy('c.id')
      .orderBy('item_count', 'DESC')
      .limit(limit)
      .getRawMany();

    return categories.map(category => ({
      id: category.c_id,
      name: category.c_name,
      description: category.c_description,
      icon: category.c_icon,
      item_count: parseInt(category.item_count) || 0,
      restaurant_count: parseInt(category.restaurant_count) || 0
    }));
  }

  /**
   * Get restaurant details with menu, offers, and timings
   */
  async getRestaurantDetails(restaurantId: number, userId?: number, deviceLat?: number, deviceLng?: number) {
    try {
      this.logger.log(`🏪 Getting restaurant details for ID: ${restaurantId}`);

      // Get restaurant with all related data
      const restaurant = await this.storeRepository
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.locations', 'sl')
        .leftJoinAndSelect('s.timings', 'st')
        .leftJoinAndSelect('s.configs', 'sc')
        .leftJoinAndSelect('s.offers', 'o')
        .leftJoinAndSelect('s.items', 'i')
        .leftJoinAndSelect('s.categories', 'c')
        .where('s.id = :id', { id: restaurantId })
        .andWhere('s.status = :status', { status: true })
        .getOne();

      if (!restaurant) {
        throw new Error(`Restaurant with ID ${restaurantId} not found`);
      }

      // Get user location for distance calculation
      const userLocation = userId 
        ? await this.locationService.getUserLocation(userId, deviceLat, deviceLng)
        : { lat: deviceLat || 12.9716, lng: deviceLng || 77.5946, source: 'device_location' };

      // Calculate distance to nearest location
      let nearestDistance = Infinity;
      let nearestLocation: StoreLocation | null = null;
      
      for (const location of restaurant.locations) {
        const distance = this.locationService.calculateDistance(
          userLocation.lat, userLocation.lng,
          location.gps_lat, location.gps_lng
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLocation = location;
        }
      }

      // Get active offers
      const now = new Date();
      const activeOffers = restaurant.offers.filter(offer => 
        offer.status && 
        offer.valid_from <= now && 
        offer.valid_to >= now
      );

      // Get restaurant statistics
      const stats = {
        total_items: restaurant.items.filter(item => item.status && item.type === 'item').length,
        total_categories: restaurant.categories.filter(cat => cat.status && cat.type === 'custom_menu').length,
        active_offers: activeOffers.length,
        average_rating: 4.5, // TODO: Calculate from reviews
        total_reviews: 150 // TODO: Get from reviews table
      };

      // Get store configs for min order value and delivery fee
      const storeConfig = restaurant.configs?.[0];
      const minOrderValue = storeConfig?.min_order_value || 199.00;
      const deliveryFee = 30.00; // TODO: Calculate based on distance

      // Check if restaurant is currently open
      const isOpen = this.checkRestaurantOpen(restaurant.timings);

      return {
        success: true,
        message: 'Restaurant details retrieved successfully',
        data: {
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description,
          logo_url: restaurant.logo_url,
          fssai_license: restaurant.fssai_license_no,
          gst_number: restaurant.gst_number,
          locations: restaurant.locations.map(location => ({
            id: location.id,
            lat: location.gps_lat,
            lng: location.gps_lng,
            locality: location.address_locality,
            street: location.address_street,
            city: location.address_city,
            area_code: location.address_area_code,
            state: location.address_state,
            delivery_radius: location.delivery_radius_km
          })),
          timings: restaurant.timings.map(timing => ({
            day: timing.day_from,
            open_time: timing.time_from,
            close_time: timing.time_to,
            is_open: this.isDayOpen(timing.day_from, timing.time_from, timing.time_to)
          })),
          offers: activeOffers.map(offer => ({
            id: offer.id,
            name: offer.name,
            description: offer.description,
            offer_code: offer.offer_code,
            banner_image_url: offer.banner_image_url,
            valid_from: offer.valid_from.toISOString(),
            valid_to: offer.valid_to.toISOString()
          })),
          stats,
          is_open: isOpen,
          delivery_time: this.calculateDeliveryTime(nearestDistance),
          min_order_value: minOrderValue,
          delivery_fee: deliveryFee
        }
      };
    } catch (error) {
      this.logger.error(`❌ Error getting restaurant details: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if restaurant is currently open
   */
  private checkRestaurantOpen(timings: StoreTimings[]): boolean {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format

    for (const timing of timings) {
      if (timing.day_from <= currentDay && timing.day_to >= currentDay) {
        const openTime = parseInt(timing.time_from);
        const closeTime = parseInt(timing.time_to);
        
        if (currentTime >= openTime && currentTime <= closeTime) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if specific day is open
   */
  private isDayOpen(day: number, openTime: string, closeTime: string): boolean {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    if (day === currentDay) {
      const open = parseInt(openTime);
      const close = parseInt(closeTime);
      return currentTime >= open && currentTime <= close;
    }
    return true; // Assume open if not current day
  }

  /**
   * Calculate delivery time based on distance
   */
  private calculateDeliveryTime(distance: number): string {
    if (distance <= 2) return '20-25 mins';
    if (distance <= 5) return '25-30 mins';
    if (distance <= 10) return '30-35 mins';
    return '35-40 mins';
  }

  /**
   * Get restaurant menu with categories and items
   */
  async getRestaurantMenu(restaurantId: number, menuParams: any) {
    try {
      this.logger.log(`🍽️ Getting menu for restaurant ID: ${restaurantId}`);

      // Get restaurant basic info
      const restaurant = await this.storeRepository.findOne({
        where: { id: restaurantId, status: true },
        select: ['id', 'name']
      });

      if (!restaurant) {
        throw new Error(`Restaurant with ID ${restaurantId} not found`);
      }

      // Get categories with items
      const categories = await this.getMenuCategories(restaurantId, menuParams);

      // Calculate totals
      const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
      const totalCategories = categories.length;

      return {
        success: true,
        message: 'Menu retrieved successfully',
        data: {
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
        }
      };
    } catch (error) {
      this.logger.error(`❌ Error getting restaurant menu: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get menu categories with items
   */
  private async getMenuCategories(restaurantId: number, menuParams: any) {
    const {
      category_id,
      search,
      sort_by = 'name',
      sort_order = 'asc',
      min_price,
      max_price,
      dietary_preference,
      include_customizations = true,
      include_variants = true
    } = menuParams;

    // Build category query
    let categoryQuery = this.categoryRepository
      .createQueryBuilder('c')
      .leftJoin('c.items', 'i')
      .where('c.store_id = :restaurantId', { restaurantId })
      .andWhere('c.status = :status', { status: true })
      .andWhere('c.type = :type', { type: 'custom_menu' });

    // Filter by specific category
    if (category_id) {
      categoryQuery = categoryQuery.andWhere('c.id = :categoryId', { categoryId: category_id });
    }

    // Get categories
    const categories = await categoryQuery
      .select([
        'c.id',
        'c.name',
        'c.description',
        'c.icon',
        'c.display_rank',
        'COUNT(i.id) as item_count'
      ])
      .groupBy('c.id')
      .orderBy('c.display_rank', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getRawMany();

    // Get items for each category
    const categoriesWithItems = await Promise.all(
      categories.map(async (category) => {
        const items = await this.getMenuItems(
          restaurantId,
          category.c_id,
          { search, sort_by, sort_order, min_price, max_price, dietary_preference, include_customizations, include_variants }
        );

        return {
          id: category.c_id,
          name: category.c_name,
          description: category.c_description,
          icon: category.c_icon,
          display_rank: category.c_display_rank,
          item_count: parseInt(category.item_count) || 0,
          items
        };
      })
    );

    return categoriesWithItems;
  }

  /**
   * Get menu items for a category
   */
  private async getMenuItems(restaurantId: number, categoryId: number, params: any) {
    const {
      search,
      sort_by = 'name',
      sort_order = 'asc',
      min_price,
      max_price,
      dietary_preference,
      include_customizations = true,
      include_variants = true
    } = params;

    // Build item query
    let itemQuery = this.itemRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.prices', 'p')
      .leftJoinAndSelect('i.quantities', 'q')
      .leftJoinAndSelect('i.attributes', 'a')
      .where('i.store_id = :restaurantId', { restaurantId })
      .andWhere('i.category_id = :categoryId', { categoryId })
      .andWhere('i.status = :status', { status: true })
      .andWhere('i.type = :type', { type: 'item' });

    // Add search filter
    if (search) {
      itemQuery = itemQuery.andWhere(
        '(LOWER(i.name) LIKE LOWER(:search) OR LOWER(i.short_desc) LIKE LOWER(:search) OR LOWER(i.long_desc) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    // Add price filters
    if (min_price !== undefined) {
      itemQuery = itemQuery.andWhere('p.base_price >= :minPrice', { minPrice: min_price });
    }
    if (max_price !== undefined) {
      itemQuery = itemQuery.andWhere('p.base_price <= :maxPrice', { maxPrice: max_price });
    }

    // Add dietary preference filter
    if (dietary_preference) {
      itemQuery = itemQuery.andWhere('a.attribute_code = :dietaryCode', { dietaryCode: 'veg_nonveg' });
      if (dietary_preference === 'veg') {
        itemQuery = itemQuery.andWhere('a.attribute_value = :dietaryValue', { dietaryValue: 'veg' });
      } else if (dietary_preference === 'non-veg') {
        itemQuery = itemQuery.andWhere('a.attribute_value = :dietaryValue', { dietaryValue: 'non-veg' });
      } else if (dietary_preference === 'vegan') {
        itemQuery = itemQuery.andWhere('a.attribute_value = :dietaryValue', { dietaryValue: 'vegan' });
      }
    }

    // Add sorting
    if (sort_by === 'name') {
      itemQuery = itemQuery.orderBy('i.name', sort_order.toUpperCase() as 'ASC' | 'DESC');
    } else if (sort_by === 'price') {
      itemQuery = itemQuery.orderBy('p.base_price', sort_order.toUpperCase() as 'ASC' | 'DESC');
    } else if (sort_by === 'rating') {
      itemQuery = itemQuery.orderBy('i.rating', sort_order.toUpperCase() as 'ASC' | 'DESC');
    } else if (sort_by === 'popularity') {
      itemQuery = itemQuery.orderBy('i.is_recommended', 'DESC').addOrderBy('i.name', 'ASC');
    }

    const items = await itemQuery.getMany();

    // Process items with customizations and variants
    const processedItems = await Promise.all(
      items.map(async (item) => {
        const itemData = {
          id: item.id,
          name: item.name,
          short_desc: item.short_desc,
          long_desc: item.long_desc,
          images: item.images || [],
          price: item.prices?.[0] ? {
            base_price: item.prices[0].base_price,
            currency: item.prices[0].currency,
            maximum_price: item.prices[0].maximum_price,
            minimum_price_range: item.prices[0].minimum_price_range,
            maximum_price_range: item.prices[0].maximum_price_range
          } : {
            base_price: 0,
            currency: 'INR'
          },
          quantity: item.quantities?.[0] ? {
            unit_type: item.quantities[0].unit_type,
            unit_value: item.quantities[0].unit_value,
            available_count: item.quantities[0].available_count,
            maximum_count: item.quantities[0].maximum_count
          } : {
            unit_type: 'unit',
            unit_value: 1,
            available_count: 0,
            maximum_count: 10
          },
          attributes: item.attributes?.map(attr => ({
            attribute_code: attr.attribute_code,
            attribute_name: attr.attribute_name,
            attribute_value: attr.attribute_value,
            attribute_group: attr.attribute_group
          })) || [],
          rating: 4.2, // TODO: Calculate from reviews
          is_available: item.quantities?.[0]?.available_count > 0,
          is_recommended: item.is_recommended,
          tax_rate: item.tax_rate,
          tax_type: item.tax_type,
          hsn_code: item.hsn_code
        };

        // Add customizations if requested
        if (include_customizations) {
          itemData['customizations'] = await this.getItemCustomizations(item.id);
        }

        // Add variants if requested
        if (include_variants) {
          itemData['variants'] = await this.getItemVariants(item.id);
        }

        return itemData;
      })
    );

    return processedItems;
  }

  /**
   * Get item customizations
   */
  private async getItemCustomizations(itemId: number) {
    const customizations = await this.itemCustomizationGroupsRepository
      .createQueryBuilder('icg')
      .leftJoinAndSelect('icg.customization_group', 'cg')
      .leftJoinAndSelect('cg.customizationRelationships', 'cr')
      .leftJoinAndSelect('cr.parent_customization', 'pc')
      .where('icg.item_id = :itemId', { itemId })
      .orderBy('icg.sequence', 'ASC')
      .getMany();

    return customizations.map(customization => ({
      id: customization.customization_group.id,
      name: customization.customization_group.name,
      description: customization.customization_group.description,
      min_selections: customization.min_selections || customization.customization_group.configs?.[0]?.min_selections || 1,
      max_selections: customization.max_selections || customization.customization_group.configs?.[0]?.max_selections || 1,
      input_type: customization.customization_group.configs?.[0]?.input_type || 'select',
      is_mandatory: customization.is_mandatory,
      sequence: customization.sequence || 1,
      options: customization.customization_group.customizationRelationships?.map(rel => ({
        id: rel.parent_customization.id,
        name: rel.parent_customization.name,
        price: 0, // TODO: Get from item prices
        is_default: rel.is_default
      })) || []
    }));
  }

  /**
   * Get item variants
   */
  private async getItemVariants(itemId: number) {
    const variants = await this.itemVariantsRepository
      .createQueryBuilder('iv')
      .leftJoinAndSelect('iv.variant_group', 'vg')
      .where('iv.item_id = :itemId', { itemId })
      .orderBy('vg.id', 'ASC')
      .getMany();

    // Group variants by variant group
    const variantGroups = new Map();
    
    variants.forEach(variant => {
      const groupId = variant.variant_group.id;
      if (!variantGroups.has(groupId)) {
        variantGroups.set(groupId, {
          id: variant.variant_group.id,
          name: variant.variant_group.name,
          description: variant.variant_group.description,
          variants: []
        });
      }
      
      variantGroups.get(groupId).variants.push({
        id: variant.id,
        name: variant.variant_group.name, // TODO: Get variant name from item
        price: 0, // TODO: Get from item prices
        is_default: variant.is_default
      });
    });

    return Array.from(variantGroups.values());
  }
}
