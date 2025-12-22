import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from "typeorm";
import { LocationService } from "../shared/services/location.service";
import { Store } from "../store/entities/store.entity";
import { StoreLocation } from "../store/entities/store-location.entity";
import { StoreFulfillment } from "../store/entities/store-fulfillment.entity";
import { Category } from "../category/entities/category.entity";
import { Item } from "../item/entities/item.entity";
import { Offers } from "../offer/entities/offers.entity";
import {
  SearchRequestDto,
  SearchSuggestionsRequestDto,
} from "./dto/search-request.dto";
import { StoreTimings } from "../store/entities/store-timings.entity";
import { StoreConfigs } from "../store/entities/store-configs.entity";
import { ItemPrices } from "../item/entities/item-prices.entity";
import { ItemQuantities } from "../item/entities/item-quantities.entity";
import { ItemAttributes } from "../item/entities/item-attributes.entity";
import { ItemCustomizationGroups } from "../item/entities/item-customization-groups.entity";
import { CustomizationRelationships } from "../item/entities/customization-relationships.entity";
import { VariantGroups } from "../variant/entities/variant-groups.entity";
import { ItemVariants } from "../variant/entities/item-variants.entity";
import { Dish } from "../dish/entities/dish.entity";
import { RestaurantReview } from "../review/entities/restaurant-review.entity";
import { ItemReview } from "../review/entities/item-review.entity";
import { TimezoneUtil } from "../shared/utils/timezone.util";
import { UserFavoriteRestaurant } from "../favorites/entities/user-favorite-restaurant.entity";
import { UserFavoriteItem } from "../favorites/entities/user-favorite-item.entity";
import { Banner } from "../banner/entities/banner.entity";
import { StoreCloseTimings } from "../store/entities/store-close-timings.entity";
import { DietaryPreference } from "../shared/enums/dietary-preference.enum";
import { StoreDietaryPreference } from "../shared/enums/store-dietary-preference.enum";
import { VegMode } from "../shared/enums/veg-mode.enum";
import { Coupon } from "../coupon/entities/coupon.entity";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { CouponType, CouponStatus } from "../coupon/entities/coupon.entity";
import { CampaignStatus } from "../coupon/entities/coupon-campaign.entity";
import { AppOperationHoursService } from "../shared/services/app-operation-hours.service";
import { AppSettingsService } from "../shared/services/app-settings.service";

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
    @InjectRepository(StoreCloseTimings)
    private readonly storeCloseTimingsRepository: Repository<StoreCloseTimings>,
    @InjectRepository(StoreConfigs)
    private readonly storeConfigsRepository: Repository<StoreConfigs>,
    @InjectRepository(StoreFulfillment)
    private readonly storeFulfillmentRepository: Repository<StoreFulfillment>,
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
    @InjectRepository(UserFavoriteRestaurant)
    private readonly favoriteRestaurantRepository: Repository<UserFavoriteRestaurant>,
    @InjectRepository(UserFavoriteItem)
    private readonly favoriteItemRepository: Repository<UserFavoriteItem>,
    @InjectRepository(Banner)
    private readonly bannerRepository: Repository<Banner>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly redisCouponService: RedisCouponService,
    private readonly locationService: LocationService,
    private readonly appOperationHoursService: AppOperationHoursService,
    private readonly appSettingsService: AppSettingsService,
  ) { }

  /**
   * Get home page data with nearby restaurants, trending items, and promotional banner
   */
  async getHomeData(
    userId?: number,
    deviceLat?: number,
    deviceLng?: number,
    vegMode?: VegMode,
    page: number = 1,
    limit: number = 10,
  ) {
    this.logger.log(
      `🏠 Getting home page data for user: ${userId || "guest"} (page: ${page}, limit: ${limit})`,
    );
    this.logger.log(
      `📍 Input location - deviceLat: ${deviceLat}, deviceLng: ${deviceLng}`,
    );

    try {
      // Get user location
      let userLocation;
      if (userId) {
        this.logger.log(
          `🔍 Fetching location for authenticated user: ${userId}`,
        );
        userLocation = await this.locationService.getUserLocation(
          userId,
          deviceLat,
          deviceLng,
        );
        this.logger.log(
          `📍 User location from service: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`,
        );
      } else {
        this.logger.log(`🔍 Using device location for guest user`);
        userLocation = {
          lat: deviceLat || 9.93523,
          lng: deviceLng || 78.130404,
          source: "device_location" as const,
        };
        this.logger.log(
          `📍 Guest location: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`,
        );
      }

      // Define search radius
      const radiusKm = 10; // 10km radius
      this.logger.log(`🔍 Search radius: ${radiusKm}km`);

      // Get all data in parallel
      this.logger.log(
        `🔍 Fetching nearby restaurants for location: ${userLocation.lat}, ${userLocation.lng}`,
      );
      const [restaurantsResult, whatsOnYourMind, promotionalBanner, appOperationStatus, homeScreenCardStyle] =
        await Promise.all([
          this.getFeaturedRestaurants(
            userLocation.lat,
            userLocation.lng,
            radiusKm,
            vegMode,
            userId,
            page,
            limit,
          ),
          this.getWhatsOnYourMind(vegMode),
          this.getPromotionalBanner(),
          this.appOperationHoursService.checkAppOperationStatus(),
          this.appSettingsService.get("HOME_SCREEN_RESTAURANT_CARD_STYLE"),
        ]);

      this.logger.log(
        `📊 Results - Restaurants: ${restaurantsResult.restaurants.length}/${restaurantsResult.total}, Dishes: ${whatsOnYourMind.length}`,
      );
      this.logger.log(
        `🕐 App operation status: ${appOperationStatus.isOpen ? "OPEN" : "CLOSED"} - ${appOperationStatus.message}`,
      );

      const data = {
        nearby_restaurants: restaurantsResult.restaurants,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(restaurantsResult.total / limit),
          total_count: restaurantsResult.total,
          page_size: limit,
          has_more: page * limit < restaurantsResult.total,
        },
        whats_on_your_mind: whatsOnYourMind,
        promotional_banner: promotionalBanner,
        app_operation_status: {
          is_open: appOperationStatus.isOpen,
          reason: appOperationStatus.reason,
          message: appOperationStatus.message,
          next_open_time: appOperationStatus.nextOpenTime || null,
        },
        home_screen_restaurant_card_style: homeScreenCardStyle || "1",
      };

      this.logger.log(`✅ Home page data retrieved successfully`);

      return {
        success: true,
        message: "Home page data retrieved successfully",
        data,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting home page data: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to retrieve home page data",
      );
    }
  }

  /**
   * Get nearby restaurants (was getFeaturedRestaurants)
   */
  private async getFeaturedRestaurants(
    userLat: number,
    userLng: number,
    radiusKm: number,
    vegMode?: VegMode,
    userId?: number,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      this.logger.log(
        `🔍 Getting nearby restaurants within ${radiusKm}km of ${userLat}, ${userLng} (page: ${page}, limit: ${limit})`,
      );
      if (vegMode) {
        this.logger.log(
          `🥬 Veg mode: ${vegMode} (${vegMode === VegMode.ALL ? "showing all restaurants with veg items only" : "showing pure-veg restaurants only"})`,
        );
      } else {
        this.logger.log(`🥬 Veg mode: disabled (showing all restaurants)`);
      }

      // First, let's check total stores in database
      const totalStores = await this.storeRepository.count();
      this.logger.log(`📊 Total stores in database: ${totalStores}`);

      const activeStores = await this.storeRepository.count({
        where: { status: true },
      });
      this.logger.log(`📊 Active stores: ${activeStores}`);

      const storesWithLocations = await this.storeRepository
        .createQueryBuilder("s")
        .leftJoin("s.locations", "sl")
        .where("s.status = :status", { status: true })
        .andWhere("sl.gps_lat IS NOT NULL")
        .andWhere("sl.gps_lng IS NOT NULL")
        .getCount();
      this.logger.log(`📊 Stores with locations: ${storesWithLocations}`);

      const distanceFilter = this.locationService.buildDistanceFilter(
        userLat,
        userLng,
        radiusKm,
      );
      const distanceSubquery = this.locationService.buildDistanceQuery(
        userLat,
        userLng,
        radiusKm,
      );

      this.logger.log(`🔍 Distance filter: ${distanceFilter}`);
      this.logger.log(`🔍 Distance subquery: ${distanceSubquery}`);

      const queryBuilder = this.storeRepository
        .createQueryBuilder("s")
        .innerJoin("s.locations", "sl")
        .leftJoin("s.fulfillments", "sf", "sf.type = :deliveryType", {
          deliveryType: "Delivery",
        })
        .where("s.status = :status", { status: true })
        .andWhere("sl.gps_lat IS NOT NULL")
        .andWhere("sl.gps_lng IS NOT NULL")
        .andWhere(distanceFilter);

      // Apply veg_mode filter based on mode
      if (vegMode === VegMode.PURE) {
        // Option 2: Show only pure-veg restaurants
        queryBuilder.andWhere("s.food_type = :pureVeg", {
          pureVeg: StoreDietaryPreference.PURE_VEG,
        });
        this.logger.log(
          `🥬 Veg mode filter: showing only pure-veg restaurants`,
        );
      }
      // Note: For VegMode.ALL, we don't filter restaurants here
      // Instead, we'll filter items in the response processing

      queryBuilder
        .select([
          "DISTINCT s.id as s_id",
          "s.name as s_name",
          "s.description as s_description",
          "s.logo_url as s_logo_url",
          "s.fssai_license_no as s_fssai_license_no",
          "s.food_type as s_food_type",
          "s.tags as s_tags",
          "s.preparation_time as s_preparation_time",
          "sl.gps_lat as sl_gps_lat",
          "sl.gps_lng as sl_gps_lng",
          "sl.address_city as sl_address_city",
          "sl.address_locality as sl_address_locality",
          "sf.contact_phone as sf_contact_phone",
          "sf.contact_email as sf_contact_email",
          distanceSubquery,
        ])
        .orderBy("distance", "ASC")
        .addOrderBy("s.name", "ASC"); // Secondary sort for same distances

      this.logger.log(`🔍 Executing restaurant query...`);
      const allStores = await queryBuilder.getRawMany();
      const totalCount = allStores.length;
      this.logger.log(`🏪 Found ${totalCount} nearby restaurants in total`);

      if (totalCount === 0) {
        this.logger.warn(
          `⚠️ No restaurants found within ${radiusKm}km of ${userLat}, ${userLng}`,
        );
        return { restaurants: [], total: 0 };
      }

      // Get user's favorite restaurant IDs
      let favoriteStoreIds: Set<number> = new Set();
      if (userId) {
        try {
          const favorites = await this.favoriteRestaurantRepository.find({
            where: { user: { id: userId } },
            select: ["store"],
            relations: ["store"],
          });
          favoriteStoreIds = new Set(favorites.map((f) => f.store.id));
          this.logger.log(
            `❤️ User has ${favoriteStoreIds.size} favorite restaurants`,
          );
        } catch (error) {
          this.logger.warn(
            `⚠️ Could not fetch favorite restaurants (table may not exist): ${error.message}`,
          );
          // Continue without favorites
        }
      }

      this.logger.log(`🔍 Processing all ${allStores.length} restaurants...`);

      // Batch fetch all active close timings for ALL stores at once (optimization to avoid N+1 queries)
      const allStoreIds = allStores.map((store) => store.s_id);
      const now = new Date();
      const activeCloseTimings = await this.storeCloseTimingsRepository.find({
        where: {
          store: { id: In(allStoreIds) },
          close_start_datetime: LessThanOrEqual(now),
          close_end_datetime: MoreThanOrEqual(now),
        },
        relations: ["store"],
      });
      // Create a Set of store IDs with active close timings for O(1) lookup
      const storesWithActiveCloseTimings = new Set(
        activeCloseTimings.map((ct) => ct.store.id),
      );

      // Calculate ratings, open status, and delivery times for ALL restaurants
      const allStoresWithRatings = await Promise.all(
        allStores.map(async (store, index) => {
          this.logger.log(
            `🔍 Processing restaurant ${index + 1}/${allStores.length}: ${store.s_name} (ID: ${store.s_id})`,
          );

          const distance = store.distance;
          this.logger.log(`📍 Distance: ${distance}km`);

          // Get rating data
          const ratingData = await this.calculateRestaurantRating(store.s_id);
          this.logger.log(
            `⭐ Rating: ${ratingData.rating} (${ratingData.reviewCount} reviews)`,
          );

          // Check if store is open
          const storeOpenData = await this.isStoreOpen(store.s_id);
          this.logger.log(`🕐 Store open: ${storeOpenData.isOpen}`);

          // Calculate delivery time with hyperlocal improvements
          const deliveryTime = this.calculateDeliveryTime(
            distance,
            store.s_id,
            ratingData.rating,
            store.s_preparation_time || undefined, // Use store-specific preparation time from ONDC
          );
          this.logger.log(`🚚 Delivery time: ${deliveryTime}`);

          // Fetch timings for the restaurant
          const store_timings = await this.storeTimingsRepository.find({
            where: { store: { id: store.s_id } },
            order: { day_from: "ASC" },
          });
          this.logger.log(
            `🕐 Found ${store_timings.length} timing entries for restaurant ${store.s_id}`,
          );

          const hasActiveCloseTiming = storesWithActiveCloseTimings.has(store.s_id);
          const timings = this.expandTimingsToDays(store_timings, hasActiveCloseTiming);

          return {
            id: store.s_id,
            name: store.s_name,
            description: store.s_description,
            logo_url: store.s_logo_url,
            fssai_license: store.s_fssai_license_no,
            food_type: (store.s_food_type as StoreDietaryPreference) || undefined,
            cuisine_tags: store.s_tags ? store.s_tags.join(", ") : "",
            location: {
              lat: store.sl_gps_lat,
              lng: store.sl_gps_lng,
              city: store.sl_address_city,
              locality: store.sl_address_locality,
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            total_reviews: ratingData.reviewCount,
            delivery_time: deliveryTime,
            offers_count: 0, // Will be calculated separately
            is_favorite: favoriteStoreIds.has(store.s_id),
            timings,
            is_open: storeOpenData.isOpen,
            phone_number: store.sf_contact_phone || null,
            email: store.sf_contact_email || null,
          };
        }),
      );

      // Sort ALL restaurants: open first, then closed; within each group by distance, then rating, then name
      allStoresWithRatings.sort((a, b) => {
        // First priority: Sort by open status (open restaurants first)
        if (a.is_open !== b.is_open) {
          return a.is_open ? -1 : 1; // Open restaurants come first
        }
        // Second priority: Sort by distance
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        // Third priority: Sort by rating (highest first)
        if (a.rating !== b.rating) {
          return b.rating - a.rating;
        }
        // Finally: Sort by name
        return a.name.localeCompare(b.name);
      });

      this.logger.log(
        `✅ Successfully processed and sorted all ${allStoresWithRatings.length} restaurants`,
      );

      // Apply pagination AFTER sorting all restaurants
      const skip = (page - 1) * limit;
      const paginatedRestaurants = allStoresWithRatings.slice(skip, skip + limit);
      this.logger.log(
        `📄 Returning page ${page}: ${paginatedRestaurants.length} restaurants (${skip + 1}-${skip + paginatedRestaurants.length} of ${totalCount})`,
      );

      // Debug: Log paginated restaurants
      paginatedRestaurants.forEach((store, index) => {
        this.logger.log(
          `🏪 Restaurant ${skip + index + 1}: ${store.name} (ID: ${store.id}) - Open: ${store.is_open} - Distance: ${store.distance}km`,
        );
      });

      return { restaurants: paginatedRestaurants, total: totalCount };
    } catch (error) {
      this.logger.error(
        `❌ Error getting nearby restaurants: ${error.message}`,
        error.stack,
      );
      return { restaurants: [], total: 0 };
    }
  }

  /**
   * MODIFY: Get "What's On Your Mind?" dishes (was getPopularCategories)
   * Filters to veg dishes if vegMode is ALL
   */
  private async getWhatsOnYourMind(vegMode?: VegMode) {
    const queryBuilder = this.dishRepository
      .createQueryBuilder("d")
      .where("d.status = :status", { status: true });

    // Filter to veg dishes if ALL mode is enabled
    if (vegMode === VegMode.ALL) {
      queryBuilder.andWhere(
        "(d.food_type = :pureVeg OR d.food_type = :veg)",
        {
          pureVeg: StoreDietaryPreference.PURE_VEG,
          veg: StoreDietaryPreference.VEG,
        },
      );
      this.logger.log(
        `🥬 Filtering "What's on your mind" dishes to veg only`,
      );
    }

    const dishes = await queryBuilder
      .select([
        "d.id",
        "d.name",
        "d.description",
        "d.icon",
        "d.food_type",
        "d.sequence",
        "d.status",
        "d.created_at",
        "d.updated_at",
      ])
      .orderBy("d.name", "ASC")
      .limit(10) // Increased from 5 to 10 dishes
      .getMany();

    return dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      food_type: (dish.food_type as StoreDietaryPreference) || undefined,
      icon: dish.icon,
      sequence: dish.sequence,
      status: dish.status,
      created_at: dish.created_at,
      updated_at: dish.updated_at,
    }));
  }

  /**
   * Get promotional banner data from database
   */
  private async getPromotionalBanner() {
    try {
      // Get all active banners ordered by sequence
      const banners = await this.bannerRepository.find({
        where: { status: true },
        order: { sequence: "ASC" },
      });

      // Return default banner if no active banners found
      if (!banners || banners.length === 0) {
        this.logger.warn("No active banners found, returning default banner");
        return [
          {
            title: "Craving Something Delicious?",
            subtitle:
              "Get your favorite meals delivered hot & fast—right to your doorstep.",
            cta_button: "Order Now!",
            image_url:
              "https://sqc-bucket.in-maa-1.linodeobjects.com/chinese-noodles-fast-food-with-soda%20(1).jpg",
            background_color: "#14b8a6",
          },
        ];
      }

      // Return all banner data from database
      return Promise.all(
        banners.map(async (banner) => {
          if (banner.promotion_type === "restaurant_id") {
            const restaurant = await this.storeRepository.findOne({
              where: { reference_id: banner.promotion_link },
            });
            if (!restaurant) {
              return null;
            }
            return {
              title: banner.title,
              subtitle: banner.subtitle || undefined,
              cta_button: banner.cta_button || undefined,
              image_url: banner.image_url,
              background_color: banner.background_color || undefined,
              promotion_type: banner.promotion_type || undefined,
              promotion_link:
                restaurant?.id?.toString() || banner.promotion_link || undefined,
              sequence: banner.sequence,
            };
          } else {
            return {
              title: banner.title,
              subtitle: banner.subtitle || undefined,
              cta_button: banner.cta_button || undefined,
              image_url: banner.image_url,
              background_color: banner.background_color || undefined,
              promotion_type: banner.promotion_type || undefined,
              promotion_link: banner.promotion_link || undefined,
              sequence: banner.sequence,
            };
          }
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching promotional banners: ${error.message}`,
        error.stack,
      );
      // Return default banner on error
      return [
        {
          title: "Craving Something Delicious?",
          subtitle:
            "Get your favorite meals delivered hot & fast—right to your doorstep.",
          cta_button: "Order Now!",
          image_url:
            "https://sqc-bucket.in-maa-1.linodeobjects.com/chinese-noodles-fast-food-with-soda%20(1).jpg",
          background_color: "#14b8a6",
        },
      ];
    }
  }

  /**
   * Get trending items near user location
   */
  private async getTrendingItems(
    userLat: number,
    userLng: number,
    radiusKm: number,
  ) {
    try {
      this.logger.log(
        `🔥 Getting trending items within ${radiusKm}km of ${userLat}, ${userLng}`,
      );

      const distanceSubquery = this.locationService.buildDistanceQuery(
        userLat,
        userLng,
        radiusKm,
      );

      const queryBuilder = this.itemRepository
        .createQueryBuilder("i")
        .leftJoin("i.store", "s")
        .leftJoin("s.locations", "sl")
        .leftJoin("i.prices", "p")
        .where("i.status = :status", { status: true })
        .andWhere("s.status = :status", { status: true })
        .andWhere(`(${distanceSubquery}) <= :radius`, {
          userLat,
          userLng,
          radius: radiusKm,
        })
        .select([
          "i.id",
          "i.name",
          "i.short_desc",
          "i.images",
          "s.id",
          "s.name",
          "s.logo_url",
          "s.food_type",
          "s.tags",
          "p.base_price",
          "p.currency",
        ])
        .addSelect(`(${distanceSubquery})`, "distance")
        .orderBy("distance", "ASC")
        .addOrderBy("i.is_recommended", "DESC")
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
              logo_url: item.s_logo_url,
            },
            price: {
              amount: parseFloat(item.p_base_price) || 0,
              currency: item.p_currency || "INR",
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            food_type: (item.s_food_type as StoreDietaryPreference) || undefined,
            cuisine_tags: item.s_tags ? item.s_tags.join(", ") : undefined,
          };
        }),
      );

      return itemsWithRatings;
    } catch (error) {
      this.logger.error(
        `❌ Error getting trending items: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get active offers
   */
  private async getActiveOffers() {
    try {
      this.logger.log(`🎁 Getting active offers`);

      const now = TimezoneUtil.getCurrentISTTime();
      const offers = await this.offersRepository
        .createQueryBuilder("o")
        .leftJoin("o.store", "s")
        .where("o.status = :status", { status: true })
        .andWhere("s.status = :status", { status: true })
        .andWhere("o.valid_from <= :now", { now })
        .andWhere("o.valid_to >= :now", { now })
        .select([
          "o.id",
          "o.name",
          "o.description",
          "o.offer_code",
          "o.banner_image_url",
          "s.name",
        ])
        .orderBy("o.created_at", "DESC")
        .limit(10)
        .getMany();

      this.logger.log(`🎯 Found ${offers.length} active offers`);

      return offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        offer_code: offer.offer_code,
        banner_image_url: offer.banner_image_url,
        restaurant_name: offer.store?.name,
      }));
    } catch (error) {
      this.logger.error(
        `❌ Error getting active offers: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Search functionality with enhanced filters
   */
  async search(searchParams: SearchRequestDto, userId?: number) {
    try {
      const {
        query = "",
        lat,
        lng,
        radius = 10,
        category_id,
        store_id,
        type = "all",
        sort_by = "distance",
        sort_order = "asc",
        dietary_preference,
        min_price,
        max_price,
        page = 1,
        limit = 20,
        veg_mode,
      } = searchParams;

      // Get user location - prioritize lat/lng from request
      let userLocation;
      if (lat && lng) {
        // Use location from request if provided
        userLocation = {
          lat,
          lng,
          source: "device_location",
        };
      } else if (userId) {
        // Only fetch user's saved location if not provided in request
        userLocation = await this.locationService.getUserLocation(userId);
      } else {
        // Guest user without location - use default
        userLocation = {
          lat: 9.93523,
          lng: 78.130404,
          source: "device_location",
        };
      }

      this.logger.log(
        `🔍 Search query: "${query}" | Location: ${userLocation.lat}, ${userLocation.lng} | Type: ${type}`,
      );

      // Fetch user's favorite restaurants if userId is provided
      let favoriteStoreIds: Set<number> = new Set();
      let favoriteItemIds: Set<number> = new Set();
      if (userId) {
        try {
          const [favoriteStores, favoriteItems] = await Promise.all([
            this.favoriteRestaurantRepository.find({
              where: { user: { id: userId } },
              select: ["store"],
              relations: ["store"],
            }),
            this.favoriteItemRepository.find({
              where: { user: { id: userId } },
              select: ["item"],
              relations: ["item"],
            }),
          ]);
          favoriteStoreIds = new Set(favoriteStores.map((f) => f.store.id));
          favoriteItemIds = new Set(favoriteItems.map((f) => f.item.id));
          this.logger.log(
            `❤️ User has ${favoriteStoreIds.size} favorite restaurants and ${favoriteItemIds.size} favorite items for search`,
          );
        } catch (error) {
          this.logger.warn(
            `⚠️ Could not fetch favorites (table may not exist): ${error.message}`,
          );
          // Continue without favorites
        }
      }

      const results = {
        restaurants: [] as any[],
        items: [] as any[],
        categories: [] as any[],
      };

      // Search restaurants
      if (type === "all" || type === "restaurant") {
        results.restaurants = await this.searchRestaurants(
          query,
          userLocation.lat,
          userLocation.lng,
          radius,
          category_id,
          store_id,
          sort_by,
          sort_order,
          page,
          limit,
          dietary_preference,
          min_price,
          max_price,
          favoriteStoreIds,
          veg_mode,
        );
      }

      // Search items
      if (type === "all" || type === "item") {
        results.items = await this.searchItems(
          query,
          userLocation.lat,
          userLocation.lng,
          radius,
          category_id,
          store_id,
          sort_by,
          sort_order,
          page,
          limit,
          dietary_preference,
          min_price,
          max_price,
          favoriteItemIds,
        );
      }

      // Search categories
      if (type === "all" || type === "categories") {
        results.categories = await this.searchCategories(
          query,
          category_id,
          limit,
        );
      }

      // Get top 5 highly rated restaurants (always included regardless of search query)
      const topRatedRestaurants = await this.getTopRatedRestaurants(
        userLocation.lat,
        userLocation.lng,
        radius,
        favoriteStoreIds,
      );

      // Calculate total results
      const totalResults =
        results.restaurants.length +
        results.items.length +
        results.categories.length;
      const totalPages = Math.ceil(totalResults / limit);

      // Get app operation status
      const appOperationStatus = await this.appOperationHoursService.checkAppOperationStatus();

      return {
        success: true,
        message: "Search completed successfully",
        data: {
          location: {
            lat: userLocation.lat,
            lng: userLocation.lng,
            source: userLocation.source,
          },
          restaurants: results.restaurants,
          items: results.items,
          categories: results.categories,
          top_rated_restaurants: topRatedRestaurants,
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
            sort_order,
          },
          app_operation_status: {
            is_open: appOperationStatus.isOpen,
            reason: appOperationStatus.reason,
            message: appOperationStatus.message,
            next_open_time: appOperationStatus.nextOpenTime || null,
          },
        },
      };
    } catch (error) {
      this.logger.error(`❌ Search error: ${error.message}`, error.stack);
      throw new InternalServerErrorException("Search failed");
    }
  }

  /**
   * Search restaurants with enhanced filters
   */
  private async searchRestaurants(
    query: string,
    userLat: number,
    userLng: number,
    radius: number,
    categoryId?: number,
    storeId?: number,
    sortBy: string = "distance",
    sortOrder: string = "asc",
    page: number = 1,
    limit: number = 20,
    dietaryPreference?: string,
    minPrice?: number,
    maxPrice?: number,
    favoriteStoreIds: Set<number> = new Set(),
    veg_mode?: string
  ) {
    try {
      const distanceQuery = this.locationService.buildDistanceQuery(
        userLat,
        userLng,
        radius,
      );
      const distanceFilter = this.locationService.buildDistanceFilter(
        userLat,
        userLng,
        radius,
      );

      let queryBuilder = this.storeRepository
        .createQueryBuilder("s")
        .leftJoin("s.locations", "sl")
        .leftJoin("s.items", "i")
        .leftJoin("i.prices", "p")
        .leftJoin("i.attributes", "a")
        .leftJoin("s.fulfillments", "sf", "sf.type = :deliveryType", {
          deliveryType: "Delivery",
        })
        .where("s.status = :status", { status: true })
        .andWhere(distanceFilter);

      // Apply search query
      // NOTE: Extend matching to include item names as well, using partial (LIKE) match
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          "(LOWER(s.name) LIKE LOWER(:query) OR LOWER(s.description) LIKE LOWER(:query) OR LOWER(i.name) LIKE LOWER(:query))",
          { query: `%${query}%` },
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder
          .leftJoin("i.item_categories", "ic")
          .andWhere("ic.categoryId = :categoryId", { categoryId });
      }

      // Apply store filter
      if (storeId) {
        queryBuilder = queryBuilder.andWhere("s.id = :storeId", { storeId });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        queryBuilder = queryBuilder.andWhere("a.attribute_code = :attrCode", {
          attrCode: "veg_nonveg",
        });
        queryBuilder = queryBuilder.andWhere("a.attribute_value = :dietary", {
          dietary: dietaryPreference,
        });
      }

      // Apply price filters
      if (minPrice) {
        queryBuilder = queryBuilder.andWhere("p.base_price >= :minPrice", {
          minPrice,
        });
      }
      if (maxPrice) {
        queryBuilder = queryBuilder.andWhere("p.base_price <= :maxPrice", {
          maxPrice,
        });
      }

      queryBuilder = queryBuilder
        .select([
          "DISTINCT s.id as s_id",
          "s.name as s_name",
          "s.description as s_description",
          "s.logo_url as s_logo_url",
          "s.fssai_license_no as s_fssai_license_no",
          "s.preparation_time as s_preparation_time",
          "sl.gps_lat as sl_gps_lat",
          "sl.gps_lng as sl_gps_lng",
          "sl.address_city as sl_address_city",
          "sl.address_locality as sl_address_locality",
          "sf.contact_phone as sf_contact_phone",
          "sf.contact_email as sf_contact_email",
          `${distanceQuery}`,
        ])
        .groupBy("s.id, sl.id, sf.id");

      // Apply sorting
      if (sortBy === "distance") {
        queryBuilder = queryBuilder.orderBy(
          "distance",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      } else if (sortBy === "name") {
        queryBuilder = queryBuilder.orderBy(
          "s.name",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      } else if (sortBy === "best_sellers") {
        queryBuilder = queryBuilder.orderBy("s.name", "ASC"); // TODO: Add order count logic
      } else if (sortBy === "highly_ordered") {
        queryBuilder = queryBuilder.orderBy("s.name", "ASC"); // TODO: Add popularity logic
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.offset(offset).limit(limit);

      const restaurants = await queryBuilder.getRawMany();

      // Batch fetch all active close timings for all restaurants at once (optimization to avoid N+1 queries)
      const restaurantIds = restaurants.map((r) => r.s_id);
      const now = new Date();
      const activeCloseTimings = await this.storeCloseTimingsRepository.find({
        where: {
          store: { id: In(restaurantIds) },
          close_start_datetime: LessThanOrEqual(now),
          close_end_datetime: MoreThanOrEqual(now),
        },
      });
      // Create a Set of restaurant IDs with active close timings for O(1) lookup
      const restaurantsWithActiveCloseTimings = new Set(
        activeCloseTimings.map((ct) => ct.store.id),
      );

      // Calculate ratings and additional data for each restaurant
      const restaurantsWithData = await Promise.all(
        restaurants.map(async (restaurant) => {
          const distance = parseFloat(restaurant.distance);

          // Get rating data
          const ratingData = await this.calculateRestaurantRating(
            restaurant.s_id,
          );

          // Check if store is open
          const storeOpenData = await this.isStoreOpen(restaurant.s_id);

          // Calculate delivery time with hyperlocal improvements
          const deliveryTime = this.calculateDeliveryTime(
            distance,
            restaurant.s_id,
            ratingData.rating,
            restaurant.s_preparation_time || undefined, // Use store-specific preparation time from ONDC
          );

          // Count items in this restaurant
          const itemsCount = await this.itemRepository
            .createQueryBuilder("i")
            .where("i.storeId = :storeId", { storeId: restaurant.s_id })
            .andWhere("i.status = :status", { status: true })
            .getCount();

          // Fetch timings for the restaurant
          const store_timings = await this.storeTimingsRepository.find({
            where: { store: { id: restaurant.s_id } },
            order: { day_from: "ASC" },
          });

          const hasActiveCloseTiming = restaurantsWithActiveCloseTimings.has(restaurant.s_id);
          const timings = this.expandTimingsToDays(store_timings, hasActiveCloseTiming);

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
              locality: restaurant.sl_address_locality,
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            delivery_time: deliveryTime,
            offers_count: 0,
            items_count: itemsCount,
            is_open: storeOpenData.isOpen,
            is_favorite: favoriteStoreIds.has(restaurant.s_id),
            timings,
            phone_number: restaurant.sf_contact_phone || null,
            email: restaurant.sf_contact_email || null,
          };
        }),
      );

      return restaurantsWithData;
    } catch (error) {
      this.logger.error(
        `❌ Error searching restaurants: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Search items with enhanced filters
   */
  private async searchItems(
    query: string,
    userLat: number,
    userLng: number,
    radius: number,
    categoryId?: number,
    storeId?: number,
    sortBy: string = "distance",
    sortOrder: string = "asc",
    page: number = 1,
    limit: number = 20,
    dietaryPreference?: string,
    minPrice?: number,
    maxPrice?: number,
    favoriteItemIds: Set<number> = new Set(),
  ) {
    try {
      const distanceSubquery = this.locationService.buildDistanceQuery(
        userLat,
        userLng,
        radius,
      );

      let queryBuilder = this.itemRepository
        .createQueryBuilder("i")
        .leftJoin("i.store", "s")
        .leftJoin("s.locations", "sl")
        .leftJoin("i.prices", "p")
        .leftJoin("i.quantities", "q")
        .leftJoin("i.attributes", "a")
        .leftJoin("i.item_categories", "ic")
        .leftJoin("ic.category", "c")
        .where("i.status = :status", { status: true })
        .andWhere("s.status = :status", { status: true })
        .andWhere(`(${distanceSubquery}) <= :radius`, {
          userLat,
          userLng,
          radius,
        });

      // Apply search query
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          "(LOWER(i.name) LIKE LOWER(:query) OR LOWER(i.short_desc) LIKE LOWER(:query) OR LOWER(c.name) LIKE LOWER(:query))",
          { query: `%${query}%` },
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder.andWhere("ic.categoryId = :categoryId", {
          categoryId,
        });
      }

      // Apply store filter
      if (storeId) {
        queryBuilder = queryBuilder.andWhere("i.storeId = :storeId", {
          storeId,
        });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        queryBuilder = queryBuilder.andWhere("a.attribute_code = :attrCode", {
          attrCode: "veg_nonveg",
        });
        queryBuilder = queryBuilder.andWhere("a.attribute_value = :dietary", {
          dietary: dietaryPreference,
        });
      }

      // Apply price filters
      if (minPrice) {
        queryBuilder = queryBuilder.andWhere("p.base_price >= :minPrice", {
          minPrice,
        });
      }
      if (maxPrice) {
        queryBuilder = queryBuilder.andWhere("p.base_price <= :maxPrice", {
          maxPrice,
        });
      }

      queryBuilder = queryBuilder
        .select([
          "i.id",
          "i.name",
          "i.short_desc",
          "i.images",
          "s.id",
          "s.name",
          "s.logo_url",
          "s.food_type",
          "s.tags",
          "p.base_price",
          "p.currency",
          "c.id",
          "c.name",
          "q.available_count",
          "q.maximum_count"
        ])
        .addSelect(`(${distanceSubquery})`, "distance");

      // Apply sorting
      if (sortBy === "distance") {
        queryBuilder = queryBuilder.orderBy(
          "distance",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      } else if (sortBy === "price") {
        queryBuilder = queryBuilder.orderBy(
          "p.base_price",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      } else if (sortBy === "name") {
        queryBuilder = queryBuilder.orderBy(
          "i.name",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      } else if (sortBy === "best_sellers") {
        queryBuilder = queryBuilder.orderBy("i.is_recommended", "DESC");
      } else if (sortBy === "highly_ordered") {
        queryBuilder = queryBuilder.orderBy("i.name", "ASC"); // TODO: Add order count logic
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
              currency: item.p_currency || "INR",
            },
            store: {
              id: item.s_id,
              name: item.s_name,
              logo_url: item.s_logo_url,
            },
            distance: Math.round(distance * 100) / 100,
            rating: ratingData.rating,
            category: {
              id: item.c_id,
              name: item.c_name,
            },
            quantity: {
              available_count: parseInt(item.q_available_count) || 0,
              maximum_count: parseInt(item.q_maximum_count) || 0,
            },
            is_available: (item.q_available_count || 0) > 0,
            is_favorite: favoriteItemIds.has(item.i_id),
            food_type: (item.s_food_type as StoreDietaryPreference) || undefined,
            cuisine_tags: item.s_tags ? item.s_tags.join(", ") : undefined,
          };
        }),
      );

      // NEW: Enrich items with preorder info
      for (const item of itemsWithData) {
        await this.enrichItemWithPreorderInfo(item, item.store.id);
      }

      return itemsWithData;
    } catch (error) {
      this.logger.error(
        `❌ Error searching items: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Enrich item with preorder campaign info
   */
  private async enrichItemWithPreorderInfo(
    item: any,
    storeId: number
  ): Promise<void> {
    try {
      this.logger.debug(
        `🔍 Checking preorder campaign for item_id=${item.id}, store_id=${storeId}`
      );

      // Find active PREORDER coupon for this item
      // IMPORTANT: Must check both coupon status AND campaign status
      // If multiple coupons match, select by priority (higher first), then by creation date (newest first)
      const preorderCoupons = await this.couponRepository
        .createQueryBuilder("coupon")
        .leftJoinAndSelect("coupon.campaign", "campaign")
        .where("coupon.type = :type", { type: CouponType.PREORDER })
        .andWhere("coupon.status = :status", { status: CouponStatus.ACTIVE })
        .andWhere("campaign.status = :campaignStatus", { campaignStatus: CampaignStatus.ACTIVE })
        .andWhere("coupon.type_meta->>'item_id' = :itemId", { itemId: item.id.toString() })
        .andWhere(
          "(coupon.applicable_store_ids IS NULL OR array_length(coupon.applicable_store_ids, 1) IS NULL OR :storeId = ANY(coupon.applicable_store_ids))",
          { storeId }
        )
        .orderBy("coupon.priority", "DESC", "NULLS LAST") // Higher priority first, nulls last
        .addOrderBy("coupon.created_at", "DESC") // Newest first if same priority
        .getMany();

      // Log warning if multiple coupons match
      if (preorderCoupons.length > 1) {
        this.logger.warn(
          `⚠️ Multiple preorder coupons found for item_id=${item.id}, store_id=${storeId}. ` +
          `Found ${preorderCoupons.length} coupons: ${preorderCoupons.map(c => `coupon_id=${c.id}, priority=${c.priority || 'null'}`).join(', ')}. ` +
          `Selecting coupon_id=${preorderCoupons[0].id} (highest priority/newest)`
        );
      }

      const preorderCoupon = preorderCoupons.length > 0 ? preorderCoupons[0] : null;

      if (!preorderCoupon) {
        this.logger.debug(
          `❌ No preorder coupon found for item_id=${item.id}, store_id=${storeId} ` +
          `(checked: coupon.status=ACTIVE AND campaign.status=ACTIVE)`
        );
        return;
      }

      this.logger.log(
        `✅ Found preorder coupon: coupon_id=${preorderCoupon.id}, campaign_id=${preorderCoupon.campaign_id}, ` +
        `campaign_status=${preorderCoupon.campaign?.status || 'unknown'}, code=${preorderCoupon.code}, ` +
        `item_id=${item.id}, store_id=${storeId}`
      );

      // Check if campaign is active (time-based)
      // Use IST time to ensure consistent timezone comparison with database timestamps
      const now = TimezoneUtil.getCurrentISTTime();
      const isActive = 
        (!preorderCoupon.start_at || now >= preorderCoupon.start_at) &&
        (!preorderCoupon.end_at || now <= preorderCoupon.end_at);

      this.logger.debug(
        `⏰ Preorder campaign time check: coupon_id=${preorderCoupon.id}, ` +
        `start_at=${preorderCoupon.start_at ? preorderCoupon.start_at.toISOString() : 'null'}, ` +
        `end_at=${preorderCoupon.end_at ? preorderCoupon.end_at.toISOString() : 'null'}, ` +
        `now_IST=${now.toISOString()}, isActive=${isActive}`
      );

      if (!isActive) {
        this.logger.debug(
          `⏰ Preorder campaign ${preorderCoupon.id} is not active (time-based check failed) for item_id=${item.id}`
        );
        return;
      }

      // Get available slots
      let availableSlots = 0;
      try {
        const quota = await this.redisCouponService.getQuota(preorderCoupon.id);
        availableSlots = quota !== null ? quota : (preorderCoupon.global_usage_limit ? Number(preorderCoupon.global_usage_limit) : 0);
      } catch (error) {
        this.logger.warn(
          `Could not fetch quota for coupon ${preorderCoupon.id}: ${error.message}`,
        );
        // Fallback to global_usage_limit if quota fetch fails
        availableSlots = preorderCoupon.global_usage_limit ? Number(preorderCoupon.global_usage_limit) : 0;
      }

      // Show preorder info regardless of available slots (even if 0, user should know it's a preorder)
      item.is_preorder_available = true;
      
      this.logger.log(
        `✅ Setting is_preorder_available=true for item_id=${item.id}, store_id=${storeId}, coupon_id=${preorderCoupon.id}`
      );
      
      // Calculate discount_amount so that: slashed_price = base_price - discount_amount = final_order_total
      // Handle both number and string formats for base_price
      const basePrice = item.price?.base_price 
        ? (typeof item.price.base_price === 'string' 
            ? parseFloat(item.price.base_price) 
            : parseFloat(item.price.base_price.toString()))
        : 0;
      
      // Final order price to show (12 as per requirement)
      // This is the price after discount, which should equal: base_price - discount_amount
      const finalOrderPrice = 12.0;
      
      let discountAmount = 0;
      let discountAmountString = "0.00";
      
      if (basePrice > 0) {
        // Calculate discount_amount so that: base_price - discount_amount = final_order_price
        // Therefore: discount_amount = base_price - final_order_price
        discountAmount = parseFloat((basePrice - finalOrderPrice).toFixed(2));
        discountAmountString = discountAmount.toFixed(2); // Convert to string with 2 decimal places
        
        // Verify: slashed_price = base_price - discount_amount should equal final_order_price
        const slashedPrice = basePrice - discountAmount;
        
        this.logger.log(
          `💰 Preorder item ${item.id}: base_price=${basePrice}, final_order_price=${finalOrderPrice}, discount_amount=${discountAmountString}, slashed_price=${slashedPrice}`
        );
      }
      
      item.preorder_campaign = {
        id: preorderCoupon.campaign_id || preorderCoupon.id,
        title: preorderCoupon.type_meta?.title || "Preorder",
        available_slots: availableSlots,
        delivery_date: preorderCoupon.type_meta?.delivery_date,
        discount_amount: discountAmountString, // String format with 2 decimal places
        free_delivery: preorderCoupon.type_meta?.free_delivery === true,
      };

      this.logger.log(
        `📦 Preorder campaign attached to item_id=${item.id}: ` +
        `campaign_id=${item.preorder_campaign.id}, ` +
        `title="${item.preorder_campaign.title}", ` +
        `available_slots=${item.preorder_campaign.available_slots}, ` +
        `delivery_date=${item.preorder_campaign.delivery_date || 'null'}, ` +
        `discount_amount=${item.preorder_campaign.discount_amount}, ` +
        `free_delivery=${item.preorder_campaign.free_delivery}, ` +
        `is_preorder_available=${item.is_preorder_available}`
      );
    } catch (error) {
      // Log error but don't fail the request
      this.logger.warn(
        `❌ Failed to enrich item ${item.id} with preorder info: ${error.message}`,
        error.stack
      );
    } finally {
      // Log final state for debugging
      if (!item.is_preorder_available) {
        this.logger.debug(
          `ℹ️ Item ${item.id} does not have is_preorder_available set (no active preorder campaign found)`
        );
      }
    }
  }

  /**
   * Search categories
   */
  private async searchCategories(
    query: string,
    categoryId?: number,
    limit: number = 20,
  ) {
    try {
      let queryBuilder = this.categoryRepository
        .createQueryBuilder("c")
        .where("c.status = :status", { status: true });

      // Apply search query
      if (query) {
        queryBuilder = queryBuilder.andWhere(
          "(LOWER(c.name) LIKE LOWER(:query) OR LOWER(c.description) LIKE LOWER(:query))",
          { query: `%${query}%` },
        );
      }

      // Apply category filter
      if (categoryId) {
        queryBuilder = queryBuilder.andWhere("c.id = :categoryId", {
          categoryId,
        });
      }

      const categories = await queryBuilder
        .select(["c.id", "c.name", "c.description", "c.icon"])
        .orderBy("c.name", "ASC")
        .limit(limit)
        .getMany();

      // Get counts for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          // Count items in this category
          const itemCount = await this.itemRepository
            .createQueryBuilder("i")
            .leftJoin("i.item_categories", "ic")
            .where("ic.categoryId = :categoryId", { categoryId: category.id })
            .andWhere("i.status = :status", { status: true })
            .getCount();

          // Count restaurants serving this category
          const restaurantCount = await this.storeRepository
            .createQueryBuilder("s")
            .leftJoin("s.items", "i")
            .leftJoin("i.item_categories", "ic")
            .where("ic.categoryId = :categoryId", { categoryId: category.id })
            .andWhere("s.status = :status", { status: true })
            .getCount();

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            item_count: itemCount,
            restaurant_count: restaurantCount,
          };
        }),
      );

      return categoriesWithCounts;
    } catch (error) {
      this.logger.error(
        `❌ Error searching categories: ${error.message}`,
        error.stack,
      );
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
    dietaryPreference?: string,
  ) {
    try {
      this.logger.log(`🏪 Getting details for restaurant ID: ${restaurantId}`);

      // Get user location for distance calculation
      const userLocation = userId
        ? await this.locationService.getUserLocation(
          userId,
          deviceLat,
          deviceLng,
        )
        : {
          lat: deviceLat || 9.93523,
          lng: deviceLng || 78.130404,
          source: "device_location",
        };

      // Get restaurant basic info
      const restaurant = await this.storeRepository
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.locations", "sl")
        .leftJoinAndSelect("s.timings", "st")
        .leftJoinAndSelect("s.closeTimings", "sct")
        .leftJoinAndSelect("s.offers", "o")
        .leftJoinAndSelect("s.configs", "sc")
        .leftJoinAndSelect("s.fulfillments", "sf")
        .where("s.id = :id", { id: restaurantId })
        .andWhere("s.status = :status", { status: true })
        .getOne();

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      // Get Delivery fulfillment for phone and email
      const deliveryFulfillment = restaurant.fulfillments?.find(
        (f) => f.type === "Delivery",
      );

      // Calculate distance if location data is available
      let distance = 0;
      if (restaurant.locations && restaurant.locations.length > 0) {
        const storeLocation = restaurant.locations[0];
        distance = await this.locationService.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          storeLocation.gps_lat,
          storeLocation.gps_lng,
        );
      }

      // Get rating data
      const ratingData = await this.calculateRestaurantRating(restaurant.id);

      // Check if store is open
      const storeOpenData = await this.isStoreOpen(restaurant.id);

      // Calculate delivery time with hyperlocal improvements
      const deliveryTime = this.calculateDeliveryTime(
        distance,
        restaurant.id,
        ratingData.rating,
        restaurant.preparation_time || undefined, // Use store-specific preparation time from ONDC
      );

      // Get item counts
      const itemCount = await this.itemRepository
        .createQueryBuilder("i")
        .where("i.storeId = :storeId", { storeId: restaurant.id })
        .andWhere("i.status = :status", { status: true })
        .getCount();

      // Get category counts
      const categoryCount = await this.categoryRepository
        .createQueryBuilder("c")
        .leftJoin("c.item_categories", "ic")
        .leftJoin("ic.item", "i")
        .where("i.storeId = :storeId", { storeId: restaurant.id })
        .andWhere("c.status = :status", { status: true })
        .getCount();

      // Get active offers count
      const now = TimezoneUtil.getCurrentISTTime();
      const offersCount = await this.offersRepository
        .createQueryBuilder("o")
        .where("o.storeId = :storeId", { storeId: restaurant.id })
        .andWhere("o.status = :status", { status: true })
        .andWhere("o.valid_from <= :now", { now })
        .andWhere("o.valid_to >= :now", { now })
        .getCount();

      // Format response
      const restaurantDetails: any = {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        logo_url: restaurant.logo_url,
        fssai_license: restaurant.fssai_license_no,
        gst_number: restaurant.gst_number,
        food_type: (restaurant.food_type as StoreDietaryPreference) || undefined,
        cuisine_tags: restaurant.tags ? restaurant.tags.join(", ") : "",
        locations:
          restaurant.locations?.map((location) => ({
            id: location.id,
            lat: location.gps_lat,
            lng: location.gps_lng,
            locality: location.address_locality,
            street: location.address_street,
            city: location.address_city,
            area_code: location.address_area_code,
            state: location.address_state,
            delivery_radius: location.delivery_radius_km,
          })) || [],
        timings: restaurant.timings
          ? (() => {
            // Check for active close timing for this single restaurant
            const now = new Date();
            const hasActiveCloseTiming = restaurant.closeTimings?.some(
              (ct) =>
                ct.close_start_datetime <= now && ct.close_end_datetime >= now,
            ) || false;
            return this.expandTimingsToDays(restaurant.timings, hasActiveCloseTiming);
          })()
          : [],
        offers:
          restaurant.offers
            ?.filter((offer) => {
              const nowIST = TimezoneUtil.getCurrentISTTime();
              return (
                offer.status &&
                new Date(offer.valid_from) <= nowIST &&
                new Date(offer.valid_to) >= nowIST
              );
            })
            .map((offer) => ({
              id: offer.id,
              name: offer.name,
              description: offer.description,
              offer_code: offer.offer_code,
              banner_image_url: offer.banner_image_url,
              valid_from: offer.valid_from.toISOString(),
              valid_to: offer.valid_to.toISOString(),
            })) || [],
        stats: {
          total_items: itemCount,
          total_categories: categoryCount,
          active_offers: offersCount,
          average_rating: ratingData.rating,
          total_reviews: ratingData.reviewCount,
        },
        is_open: storeOpenData.isOpen,
        delivery_time: deliveryTime,
        min_order_value: restaurant.configs?.[0]?.min_order_value || 0,
        delivery_fee: 30.0, // TODO: Calculate based on distance and store config
        phone_number: deliveryFulfillment?.contact_phone || null,
        email: deliveryFulfillment?.contact_email || null,
      };

      // Add categorized items if requested
      if (includeItems) {
        this.logger.log(
          `🍽️ Fetching categorized items for restaurant ${restaurantId}`,
        );

        // Fetch user's favorite items if userId is provided
        let favoriteItemIds: Set<number> = new Set();
        if (userId) {
          try {
            const favoriteItems = await this.favoriteItemRepository.find({
              where: { user: { id: userId } },
              select: ["item"],
              relations: ["item"],
            });
            favoriteItemIds = new Set(favoriteItems.map((f) => f.item.id));
            this.logger.log(
              `❤️ User has ${favoriteItemIds.size} favorite items for restaurant detail`,
            );
          } catch (error) {
            this.logger.warn(
              `⚠️ Could not fetch favorite items (table may not exist): ${error.message}`,
            );
            // Continue without favorite items
          }
        }

        const categorizedItems = await this.getCategorizedItems(
          restaurantId,
          search,
          dietaryPreference,
          favoriteItemIds,
          restaurant, // Pass store information for food_type and tags
        );

        restaurantDetails.categories = categorizedItems;
        restaurantDetails.applied_filters = {
          search: search || undefined,
          dietary_preference: dietaryPreference || undefined,
        };
      }

      this.logger.log(`✅ Restaurant details retrieved successfully`);

      // Get app operation status
      const appOperationStatus = await this.appOperationHoursService.checkAppOperationStatus();
      restaurantDetails.app_operation_status = {
        is_open: appOperationStatus.isOpen,
        reason: appOperationStatus.reason,
        message: appOperationStatus.message,
        next_open_time: appOperationStatus.nextOpenTime || null,
      };

      return {
        success: true,
        message: "Restaurant details retrieved successfully",
        data: restaurantDetails,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting restaurant details: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to retrieve restaurant details",
      );
    }
  }

  /**
   * Check if restaurant is open based on current time and day
   */
  private checkRestaurantOpen(timings: StoreTimings[]): boolean {
    if (!timings || timings.length === 0) return false;

    // Use IST timezone
    const currentDay = TimezoneUtil.getCurrentISTDay(); // Monday=1, ..., Saturday=6, Sunday=7
    const currentTime = TimezoneUtil.getCurrentISTTimeHHMM(); // HHMM format

    const todayTiming = timings.find(
      (timing) => timing.day_from <= currentDay && timing.day_to >= currentDay,
    );
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
   * Check if restaurant is open now based on timing window
   * @param dayFrom - Starting day (1-7, where 1=Monday, 7=Sunday)
   * @param dayTo - Ending day (1-7, where 1=Monday, 7=Sunday)
   * @param openTime - Opening time in HHMM format
   * @param closeTime - Closing time in HHMM format
   */
  private isDayOpen(
    dayFrom: number,
    dayTo: number,
    openTime: string,
    closeTime: string,
  ): boolean {
    // Use IST timezone
    const currentDay = TimezoneUtil.getCurrentISTDay(); // Monday=1, ..., Saturday=6, Sunday=7

    // Check if current day is within the day range
    let isDayInRange = false;
    if (dayFrom <= dayTo) {
      // Normal range (e.g., Monday to Friday: 1-5)
      isDayInRange = currentDay >= dayFrom && currentDay <= dayTo;
    } else {
      // Wrapped range (e.g., Saturday to Monday: 6-1)
      isDayInRange = currentDay >= dayFrom || currentDay <= dayTo;
    }

    if (!isDayInRange) return false;

    // Check if current time is within operating hours
    const currentTime = TimezoneUtil.getCurrentISTTimeHHMM(); // HHMM format
    const open = parseInt(openTime);
    const close = parseInt(closeTime);

    if (close < open) {
      // Overnight hours (e.g., 2200 to 0200)
      return currentTime >= open || currentTime <= close;
    }

    return currentTime >= open && currentTime <= close;
  }

  /**
   * Convert database day format to display format
   * Database: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
   * Display: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
   */
  private convertDbDayToDisplayDay(dbDay: number): number {
    // Database 7 (Sunday) → Display 1 (Sunday)
    // Database 1-6 (Mon-Sat) → Display 2-7 (Mon-Sat)
    return dbDay === 7 ? 1 : dbDay + 1;
  }

  /**
   * Convert display day format to database format
   * Display: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
   * Database: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
   */
  private convertDisplayDayToDbDay(displayDay: number): number {
    // Display 1 (Sunday) → Database 7 (Sunday)
    // Display 2-7 (Mon-Sat) → Database 1-6 (Mon-Sat)
    return displayDay === 1 ? 7 : displayDay - 1;
  }

  /**
   * Convert JavaScript getDay() to display format
   * JS: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
   * Display: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
   */
  private convertJsDayToDisplayDay(jsDay: number): number {
    return jsDay === 0 ? 1 : jsDay + 1;
  }

  /**
   * Expand timing ranges into individual day entries
   * Transforms timings with day_from-day_to ranges into separate entries for each day
   * Days are converted to display format: 1=Sunday, 2=Monday, ..., 7=Saturday
   * @param timings - Array of timing objects with day_from, day_to, time_from, time_to (in database format)
   * @param hasActiveCloseTiming - Whether the store has an active close timing (pre-computed to avoid N+1 queries)
   * @returns Array of expanded timing entries, one per day (in display format)
   */
  private expandTimingsToDays(
    timings: StoreTimings[],
    hasActiveCloseTiming: boolean = false,
  ): Array<{
    day: number;
    open_time: string;
    close_time: string;
    is_open: boolean;
  }> {
    const expandedTimings: Array<{
      day: number;
      open_time: string;
      close_time: string;
      is_open: boolean;
    }> = [];

    // Use IST timezone for current day and time calculation
    const now = TimezoneUtil.getCurrentISTTime();
    // Convert JavaScript's getDay() to display format (1=Sunday, 7=Saturday)
    // JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // Display format: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
    const jsDay = now.getDay();
    const currentDayDisplay = this.convertJsDayToDisplayDay(jsDay); // 1=Sunday, 7=Saturday
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

    for (const timing of timings) {
      // Database format: 1=Monday, 7=Sunday
      const dayFromDb = timing.day_from;
      const dayToDb = timing.day_to;

      // Generate days in the range (in database format)
      const daysDb: number[] = [];

      if (dayFromDb <= dayToDb) {
        // Normal range (e.g., Monday to Friday: 1-5)
        for (let day = dayFromDb; day <= dayToDb; day++) {
          daysDb.push(day);
        }
      } else {
        // Wrapped range (e.g., Friday to Monday: 5-1)
        // Handle as two separate ranges: from dayFromDb to 7, and from 1 to dayToDb
        for (let day = dayFromDb; day <= 7; day++) {
          daysDb.push(day);
        }
        for (let day = 1; day <= dayToDb; day++) {
          daysDb.push(day);
        }
      }

      // Create an entry for each day, converting to display format
      for (const dayDb of daysDb) {
        const dayDisplay = this.convertDbDayToDisplayDay(dayDb); // Convert to display format (1=Sun, 7=Sat)

        // Calculate is_open: true only if this day is today AND current time is within operating hours AND no active close timing
        let isOpen = false;

        // Check if this day entry is today (compare in display format)
        if (dayDisplay === currentDayDisplay && !hasActiveCloseTiming) {
          // Check if current time is within operating hours for this timing entry
          const openTime = parseInt(timing.time_from);
          const closeTime = parseInt(timing.time_to);

          if (closeTime < openTime) {
            // Overnight hours (e.g., 2200 to 0200)
            isOpen = currentTime >= openTime || currentTime <= closeTime;
          } else {
            // Normal hours (e.g., 0900 to 2200)
            isOpen = currentTime >= openTime && currentTime <= closeTime;
          }
        }

        expandedTimings.push({
          day: dayDisplay, // Return in display format: 1=Sunday, 7=Saturday
          open_time: timing.time_from,
          close_time: timing.time_to,
          is_open: isOpen,
        });
      }
    }

    // Sort by day (1-7) for consistent ordering: Sunday (1) to Saturday (7)
    return expandedTimings.sort((a, b) => a.day - b.day);
  }

  /**
   * Check if an item is currently available based on its timing window
   * Note: Uses database format internally (1=Monday, 7=Sunday)
   * @param dayFrom - Starting day in database format (1-7, where 1=Monday, 7=Sunday)
   * @param dayTo - Ending day in database format (1-7, where 1=Monday, 7=Sunday)
   * @param timeFrom - Start time in HHMM format
   * @param timeTo - End time in HHMM format
   * @returns boolean indicating if item is available now
   */
  private isItemAvailableNow(
    dayFrom: number,
    dayTo: number,
    timeFrom: string,
    timeTo: string,
  ): boolean {
    // Use IST timezone (returns database format: 1=Monday, 7=Sunday)
    const currentDay = TimezoneUtil.getCurrentISTDay(); // Monday=1, ..., Saturday=6, Sunday=7

    // Check if current day is within the day range
    let isDayInRange = false;
    if (dayFrom <= dayTo) {
      // Normal range (e.g., Monday to Friday: 1-5)
      isDayInRange = currentDay >= dayFrom && currentDay <= dayTo;
    } else {
      // Wrapped range (e.g., Saturday to Monday: 6-1)
      isDayInRange = currentDay >= dayFrom || currentDay <= dayTo;
    }

    if (!isDayInRange) return false;

    // Check if current time is within the time range
    const currentTime = TimezoneUtil.getCurrentISTTimeHHMM(); // HHMM format
    const open = parseInt(timeFrom);
    const close = parseInt(timeTo);

    if (close < open) {
      // Time range crosses midnight (e.g., 2200 to 0200)
      return currentTime >= open || currentTime <= close;
    }

    return currentTime >= open && currentTime <= close;
  }

  /**
   * Helper method to check if current day/time falls within timing range
   * Uses display format for days (1=Sunday, 7=Saturday)
   * @param dayFrom - Starting day in display format (1-7, where 1=Sunday, 7=Saturday)
   * @param dayTo - Ending day in display format (1-7, where 1=Sunday, 7=Saturday)
   * @param timeFrom - Start time in HHMM format
   * @param timeTo - End time in HHMM format
   * @param currentDay - Current day in display format (1=Sunday, 7=Saturday)
   * @param currentTime - Current time in HHMM format
   * @returns boolean indicating if item is available now
   */
  private checkTimingAvailability(
    dayFrom: number,
    dayTo: number,
    timeFrom: string,
    timeTo: string,
    currentDay: number,
    currentTime: number,
  ): boolean {
    // Check if current day is within range
    const isDayInRange = currentDay >= dayFrom && currentDay <= dayTo;

    if (!isDayInRange) {
      return false;
    }

    // Check if current time is within range
    const openTime = parseInt(timeFrom);
    const closeTime = parseInt(timeTo);

    if (closeTime < openTime) {
      // Overnight hours (e.g., 2200 to 0200)
      return currentTime >= openTime || currentTime <= closeTime;
    } else {
      // Normal hours (e.g., 0900 to 2200)
      return currentTime >= openTime && currentTime <= closeTime;
    }
  }

  /**
   * Normalize item timings by splitting wrapped ranges into readable ranges
   * Ensures day_from < day_to in display format (1=Sunday, 7=Saturday)
   * @param itemTimings - Array of ItemTimings entities (in database format)
   * @returns Array of normalized timing entries (in display format)
   */
  private normalizeItemTimings(
    itemTimings: Array<{
      day_from: number;
      day_to: number;
      time_from: string;
      time_to: string;
    }>,
  ): Array<{
    day_from: number;
    day_to: number;
    time_from: string;
    time_to: string;
    is_available_now: boolean;
  }> {
    const normalizedTimings: Array<{
      day_from: number;
      day_to: number;
      time_from: string;
      time_to: string;
      is_available_now: boolean;
    }> = [];

    // Use IST timezone for current day and time calculation
    const now = TimezoneUtil.getCurrentISTTime();
    const jsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const currentDayDisplay = this.convertJsDayToDisplayDay(jsDay); // 1=Sunday, 7=Saturday
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

    for (const timing of itemTimings) {
      // Convert database format to display format
      const dayFromDisplay = this.convertDbDayToDisplayDay(timing.day_from);
      const dayToDisplay = this.convertDbDayToDisplayDay(timing.day_to);

      if (dayFromDisplay <= dayToDisplay) {
        // Normal range - no splitting needed (e.g., 1-7, 2-5)
        const isAvailableNow = this.checkTimingAvailability(
          dayFromDisplay,
          dayToDisplay,
          timing.time_from,
          timing.time_to,
          currentDayDisplay,
          currentTime,
        );

        normalizedTimings.push({
          day_from: dayFromDisplay,
          day_to: dayToDisplay,
          time_from: timing.time_from,
          time_to: timing.time_to,
          is_available_now: isAvailableNow,
        });
      } else {
        // Wrapped range - split into two ranges
        // Example: day_from=3 (Tuesday), day_to=2 (Monday) becomes:
        //   Range 1: 3-7 (Tuesday to Saturday)
        //   Range 2: 1-2 (Sunday to Monday)

        // First range: from day_from to Saturday (7)
        const isAvailableNow1 = this.checkTimingAvailability(
          dayFromDisplay,
          7, // Saturday
          timing.time_from,
          timing.time_to,
          currentDayDisplay,
          currentTime,
        );

        normalizedTimings.push({
          day_from: dayFromDisplay,
          day_to: 7, // Saturday
          time_from: timing.time_from,
          time_to: timing.time_to,
          is_available_now: isAvailableNow1,
        });

        // Second range: from Sunday (1) to day_to
        if (dayToDisplay >= 1) {
          const isAvailableNow2 = this.checkTimingAvailability(
            1, // Sunday
            dayToDisplay,
            timing.time_from,
            timing.time_to,
            currentDayDisplay,
            currentTime,
          );

          normalizedTimings.push({
            day_from: 1, // Sunday
            day_to: dayToDisplay,
            time_from: timing.time_from,
            time_to: timing.time_to,
            is_available_now: isAvailableNow2,
          });
        }
      }
    }

    // Sort by time_from, then day_from, then day_to for consistent ordering
    // This groups timings with same time window together for merging
    const sortedTimings = normalizedTimings.sort((a, b) => {
      const timeDiff = parseInt(a.time_from) - parseInt(b.time_from);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      const timeToDiff = parseInt(a.time_to) - parseInt(b.time_to);
      if (timeToDiff !== 0) {
        return timeToDiff;
      }
      if (a.day_from !== b.day_from) {
        return a.day_from - b.day_from;
      }
      return a.day_to - b.day_to;
    });

    // Merge consecutive/adjacent ranges with the same time window
    return this.mergeAdjacentRanges(sortedTimings, currentDayDisplay, currentTime);
  }

  /**
   * Merge adjacent/consecutive ranges with the same time window
   * Example: (1-1, 2-7) with same time becomes (1-7)
   */
  private mergeAdjacentRanges(
    timings: Array<{
      day_from: number;
      day_to: number;
      time_from: string;
      time_to: string;
      is_available_now: boolean;
    }>,
    currentDay: number,
    currentTime: number,
  ): Array<{
    day_from: number;
    day_to: number;
    time_from: string;
    time_to: string;
    is_available_now: boolean;
  }> {
    if (timings.length === 0) {
      return [];
    }

    const merged: Array<{
      day_from: number;
      day_to: number;
      time_from: string;
      time_to: string;
      is_available_now: boolean;
    }> = [];

    for (const timing of timings) {
      const lastMerged = merged[merged.length - 1];

      // Check if we can merge with the last entry
      if (
        lastMerged &&
        lastMerged.time_from === timing.time_from &&
        lastMerged.time_to === timing.time_to
      ) {
        // Check if ranges are adjacent, consecutive, or can be combined
        const isAdjacent =
          // Case 1: Consecutive (e.g., 1-1 and 2-7, or 2-6 and 7-7)
          lastMerged.day_to + 1 === timing.day_from ||
          // Case 2: Wraps around (e.g., 2-7 and 1-1, or 7-7 and 1-1)
          (lastMerged.day_to === 7 && timing.day_from === 1) ||
          // Case 3: Overlapping or touching (e.g., 2-5 and 3-7)
          (timing.day_from <= lastMerged.day_to + 1);

        if (isAdjacent) {
          // Merge: extend the range
          const newDayFrom = Math.min(lastMerged.day_from, timing.day_from);
          const newDayTo = Math.max(lastMerged.day_to, timing.day_to);

          // Recalculate availability for merged range
          const isAvailableNow = this.checkTimingAvailability(
            newDayFrom,
            newDayTo,
            lastMerged.time_from,
            lastMerged.time_to,
            currentDay,
            currentTime,
          );

          merged[merged.length - 1] = {
            day_from: newDayFrom,
            day_to: newDayTo,
            time_from: lastMerged.time_from,
            time_to: lastMerged.time_to,
            is_available_now: isAvailableNow,
          };
          continue;
        }
      }

      // Cannot merge - add as new entry
      merged.push({ ...timing });
    }

    // Final sort by day_from, then day_to, then time_from
    return merged.sort((a, b) => {
      if (a.day_from !== b.day_from) {
        return a.day_from - b.day_from;
      }
      if (a.day_to !== b.day_to) {
        return a.day_to - b.day_to;
      }
      return parseInt(a.time_from) - parseInt(b.time_from);
    });
  }

  /**
   * Get restaurant menu
   */
  async getRestaurantMenu(
    restaurantId: number,
    menuParams: any,
    userId?: number,
  ) {
    try {
      this.logger.log(`📜 Getting menu for restaurant ID: ${restaurantId}`);

      // Get restaurant basic info
      const restaurant = await this.storeRepository
        .createQueryBuilder("s")
        .where("s.id = :id", { id: restaurantId })
        .andWhere("s.status = :status", { status: true })
        .select(["s.id", "s.name", "s.food_type", "s.tags"])
        .getOne();

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      // Fetch user's favorite items if userId is provided
      let favoriteItemIds: Set<number> = new Set();
      if (userId) {
        try {
          const favoriteItems = await this.favoriteItemRepository.find({
            where: { user: { id: userId } },
            select: ["item"],
            relations: ["item"],
          });
          console.log('favoriteItems: ', favoriteItems.map((item) => item.item.quantities.map((quantity) => quantity.maximum_count)));
          favoriteItemIds = new Set(favoriteItems.map((f) => f.item.id));
          this.logger.log(
            `❤️ User has ${favoriteItemIds.size} favorite items for menu`,
          );
        } catch (error) {
          this.logger.warn(
            `⚠️ Could not fetch favorite items (table may not exist): ${error.message}`,
          );
          // Continue without favorite items
        }
      }

      // Get menu categories with items
      const categories = await this.getMenuCategories(
        restaurantId,
        menuParams,
        favoriteItemIds,
      );

      // Calculate totals
      const totalItems = categories.reduce(
        (total, category) => total + category.items.length,
        0,
      );
      const totalCategories = categories.length;

      // Get app operation status
      const appOperationStatus = await this.appOperationHoursService.checkAppOperationStatus();

      const menuData = {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        food_type: (restaurant.food_type as StoreDietaryPreference) || undefined,
        cuisine_tags: restaurant.tags ? restaurant.tags.join(", ") : "",
        categories,
        total_items: totalItems,
        total_categories: totalCategories,
        applied_filters: {
          category_id: menuParams.category_id,
          search: menuParams.search,
          min_price: menuParams.min_price,
          max_price: menuParams.max_price,
          dietary_preference: menuParams.dietary_preference,
        },
        app_operation_status: {
          is_open: appOperationStatus.isOpen,
          reason: appOperationStatus.reason,
          message: appOperationStatus.message,
          next_open_time: appOperationStatus.nextOpenTime || null,
        },
      };

      this.logger.log(
        `✅ Menu retrieved successfully - ${totalCategories} categories, ${totalItems} items`,
      );

      return {
        success: true,
        message: "Menu retrieved successfully",
        data: menuData,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting restaurant menu: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to retrieve restaurant menu",
      );
    }
  }

  /**
   * Get menu categories with items
   */
  private async getMenuCategories(
    restaurantId: number,
    menuParams: any,
    favoriteItemIds: Set<number> = new Set(),
  ) {
    try {
      let categoryQuery = this.categoryRepository
        .createQueryBuilder("c")
        .leftJoin("c.item_categories", "ic")
        .leftJoin("ic.item", "i")
        .where("i.storeId = :restaurantId", { restaurantId })
        .andWhere("c.status = :status", { status: true })
        .andWhere("(c.type != :variantType OR c.type IS NULL)", {
          variantType: "variant_group",
        })
        .andWhere("i.status = :status", { status: true });

      // Apply category filter
      if (menuParams.category_id) {
        categoryQuery = categoryQuery.andWhere("c.id = :categoryId", {
          categoryId: menuParams.category_id,
        });
      }

      const categories = await categoryQuery
        .select(["c.id", "c.name", "c.description", "c.icon", "c.display_rank"])
        .groupBy("c.id")
        .orderBy("c.display_rank", "ASC")
        .addOrderBy("c.name", "ASC")
        .getMany();

      // Get items for each category
      const categoriesWithItems = await Promise.all(
        categories.map(async (category) => {
          const items = await this.getMenuItems(
            restaurantId,
            category.id,
            menuParams,
            favoriteItemIds,
          );

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            display_rank: category.display_rank,
            item_count: items.length,
            items,
          };
        }),
      );

      // Filter out empty categories if search or filters are applied
      return categoriesWithItems.filter(
        (category) => category.items.length > 0,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error getting menu categories: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get menu items for a category
   */
  private async getMenuItems(
    restaurantId: number,
    categoryId: number,
    params: any,
    favoriteItemIds: Set<number> = new Set(),
  ) {
    try {
      // Get all items in category (including variant items)
      let itemQuery = this.itemRepository
        .createQueryBuilder("i")
        .leftJoin("i.item_categories", "ic")
        .leftJoinAndSelect("i.prices", "p")
        .leftJoinAndSelect("i.quantities", "q")
        .leftJoinAndSelect("i.attributes", "a")
        .leftJoinAndSelect("i.itemVariants", "iv")
        .leftJoinAndSelect("iv.variant_group", "vg")
        .where("i.storeId = :restaurantId", { restaurantId })
        .andWhere("ic.categoryId = :categoryId", { categoryId })
        .andWhere("i.status = :status", { status: true })
        .andWhere("i.type = :type", { type: "item" })
        .andWhere("(i.parentItemId IS NULL OR i.parentItemId = 0)", {});

      // Apply search filter
      if (params.search) {
        itemQuery = itemQuery.andWhere(
          "(LOWER(i.name) LIKE LOWER(:search) OR LOWER(i.short_desc) LIKE LOWER(:search))",
          { search: `%${params.search}%` },
        );
      }

      // Apply dietary preference filter
      if (params.dietary_preference) {
        itemQuery = itemQuery.andWhere("a.attribute_code = :attrCode", {
          attrCode: "veg_nonveg",
        });
        itemQuery = itemQuery.andWhere("a.attribute_value = :dietary", {
          dietary: params.dietary_preference,
        });
      }

      const allItems = await itemQuery
        .orderBy("i.is_recommended", "DESC")
        .addOrderBy("i.name", "ASC")
        .getMany();

      // Group items by variant group
      const variantGroupsMap = new Map<string, any[]>();
      const standaloneItems: any[] = [];

      for (const item of allItems) {
        if (item.itemVariants && item.itemVariants.length > 0) {
          const variantGroupId = item.itemVariants[0].variant_group.reference_id;
          if (!variantGroupsMap.has(variantGroupId)) {
            variantGroupsMap.set(variantGroupId, []);
          }
          variantGroupsMap.get(variantGroupId)!.push(item);
        } else {
          standaloneItems.push(item);
        }
      }

      // Process standalone items
      const processedItems: any[] = [];

      for (const item of standaloneItems) {
        const ratingData = await this.calculateItemRating(item.id);
        const customizations = await this.getCustomizationGroups(item.id);
        const dietaryAttr = item.attributes?.find(
          (attr) => attr.attribute_code === "veg_nonveg",
        );

        const menuItem = {
          id: item.id,
          name: item.name,
          short_desc: item.short_desc,
          long_desc: item.long_desc,
          images: item.images || [],
          price: {
            base_price: parseFloat(item.prices?.[0]?.base_price?.toString() || "0"),
            currency: item.prices?.[0]?.currency || "INR",
            maximum_price: item.prices?.[0]?.maximum_price
              ? parseFloat(item.prices[0].maximum_price.toString())
              : null,
          },
          quantity: {
            unit_type: item.quantities?.[0]?.unit_type || "unit",
            unit_value: parseFloat(item.quantities?.[0]?.unit_value?.toString() || "1"),
            available_count: item.quantities?.[0]?.available_count || 0,
            maximum_count: item.quantities?.[0]?.maximum_count || 99,
          },
          attributes: item.attributes || [],
          customizations,
          has_variants: false,
          variants: [],
          rating: ratingData.rating,
          is_available: (item.quantities?.[0]?.available_count || 0) > 0,
          is_recommended: item.is_recommended || false,
          tax_rate: item.tax_rate !== null && item.tax_rate !== undefined ? parseFloat(item.tax_rate.toString()) : null,
          tax_type: item.tax_type || null,
          hsn_code: item.hsn_code || null,
          is_favorite: favoriteItemIds.has(item.id),
          dietary_preference: dietaryAttr?.attribute_value || null,
        };

        // NEW: Enrich with preorder info
        await this.enrichItemWithPreorderInfo(menuItem, restaurantId);

        processedItems.push(menuItem);
      }

      // Process variant groups
      for (const [variantGroupId, variantItems] of variantGroupsMap) {
        if (variantItems.length === 0) continue;

        const baseItem = variantItems[0];
        const variantGroup = baseItem.itemVariants[0].variant_group;

        // Find variant group category
        const variantGroupCategory = await this.categoryRepository.findOne({
          where: {
            reference_id: variantGroupId,
            store: { id: restaurantId },
            type: "variant_group",
          },
        });

        // Calculate price range
        const prices = variantItems
          .map((v) => parseFloat(v.prices?.[0]?.base_price?.toString() || "0"))
          .filter((p) => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        // Apply price filters
        if (params.min_price && maxPrice < parseFloat(params.min_price)) continue;
        if (params.max_price && minPrice > parseFloat(params.max_price)) continue;

        const currency = baseItem.prices?.[0]?.currency || "INR";
        const dietaryAttr = baseItem.attributes?.find(
          (attr) => attr.attribute_code === "veg_nonveg",
        );

        const customizations = await this.getCustomizationGroups(baseItem.id);
        const ratingData = await this.calculateItemRating(baseItem.id);

        // Extract variant attribute options
        const variantAttributesMap = new Map<string, {
          attribute_code: string;
          attribute_name: string;
          options: Set<string>;
        }>();

        variantItems.forEach((variantItem) => {
          const variantAttrs = variantItem.attributes?.filter(
            (attr) => attr.attribute_group === "variant"
          ) || [];

          variantAttrs.forEach((attr) => {
            if (!variantAttributesMap.has(attr.attribute_code)) {
              variantAttributesMap.set(attr.attribute_code, {
                attribute_code: attr.attribute_code,
                attribute_name: attr.attribute_name,
                options: new Set(),
              });
            }
            variantAttributesMap.get(attr.attribute_code)!.options.add(attr.attribute_value);
          });
        });

        const variantAttributeOptions = Array.from(variantAttributesMap.values()).map((attr) => ({
          attribute_code: attr.attribute_code,
          attribute_name: attr.attribute_name,
          options: Array.from(attr.options),
        }));

        // Build variants array
        const variants = variantItems.map((variantItem) => {
          const price = variantItem.prices?.[0];
          const quantity = variantItem.quantities?.[0];
          const itemDietaryAttr = variantItem.attributes?.find(
            (attr) => attr.attribute_code === "veg_nonveg",
          );

          const itemVariantAttrs = variantItem.attributes?.filter(
            (attr) => attr.attribute_group === "variant"
          ) || [];

          const variantAttributes: Record<string, string> = {};
          itemVariantAttrs.forEach((attr) => {
            variantAttributes[attr.attribute_code] = attr.attribute_value;
          });

          return {
            id: variantItem.id,
            reference_id: variantItem.reference_id,
            name: variantItem.name,
            description: variantItem.short_desc || "",
            images: variantItem.images || [],
            price: price?.base_price ? parseFloat(price.base_price.toString()) : 0,
            currency: price?.currency || "INR",
            is_available: quantity ? quantity.available_count > 0 : variantItem.status,
            available_count: quantity?.available_count || 0,
            dietary_preference: itemDietaryAttr?.attribute_value || null,
            is_default: variantItem.itemVariants[0]?.is_default || false,
            variant_attributes: variantAttributes,
          };
        });

        const variantMenuItem = {
          id: baseItem.id,
          name: variantGroupCategory?.name || variantGroup.name,
          short_desc: variantGroupCategory?.description || baseItem.short_desc || "",
          long_desc: baseItem.long_desc || undefined,
          images: baseItem.images || [],
          price: {
            base_price: minPrice,
            currency: currency,
            maximum_price: maxPrice !== minPrice ? maxPrice : null,
          },
          quantity: {
            unit_type: baseItem.quantities?.[0]?.unit_type || "unit",
            unit_value: parseFloat(baseItem.quantities?.[0]?.unit_value?.toString() || "1"),
            available_count: Math.max(...variantItems.map(v => v.quantities?.[0]?.available_count || 0)),
            maximum_count: baseItem.quantities?.[0]?.maximum_count || 99,
          },
          attributes: baseItem.attributes || [],
          customizations,
          has_variants: true,
          attribute_options: variantAttributeOptions,
          variants: variants,
          rating: ratingData.rating,
          is_available: variants.some((v) => v.is_available),
          is_recommended: baseItem.is_recommended || false,
          tax_rate: baseItem.tax_rate !== null && baseItem.tax_rate !== undefined ? parseFloat(baseItem.tax_rate.toString()) : null,
          tax_type: baseItem.tax_type || null,
          hsn_code: baseItem.hsn_code || null,
          is_favorite: favoriteItemIds.has(baseItem.id),
          dietary_preference: dietaryAttr?.attribute_value || null,
        };

        // NEW: Enrich with preorder info
        await this.enrichItemWithPreorderInfo(variantMenuItem, restaurantId);

        processedItems.push(variantMenuItem);
      }

      return processedItems;
    } catch (error) {
      this.logger.error(
        `❌ Error getting menu items: ${error.message}`,
        error.stack,
      );
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
        .createQueryBuilder("i")
        .leftJoinAndSelect("i.prices", "p")
        .where('i."parentItemId" = :itemId', { itemId })
        .andWhere("i.type = :type", { type: "customization" })
        .andWhere("i.status = :status", { status: true })
        .orderBy("i.id", "ASC")
        .getMany();

      this.logger.log(
        `📋 Found ${customizationItems.length} customization items for item ${itemId}`,
      );

      // For now, return a simple structure with all customization items as one group
      if (customizationItems.length === 0) {
        return [];
      }

      const options = customizationItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.prices?.[0]?.base_price || 0,
        is_default: false,
      }));

      // Get the actual customization group details for this item
      const customizationGroup = await this.itemCustomizationGroupsRepository
        .createQueryBuilder("icg")
        .leftJoin("icg.item", "i")
        .leftJoin("icg.customization_group", "cg")
        .where("i.id = :itemId", { itemId })
        .andWhere("cg.type = :type", { type: "custom_group" })
        .select([
          "icg.id",
          "icg.min_selections",
          "icg.max_selections",
          "icg.is_mandatory",
          "cg.id",
          "cg.name",
          "cg.description",
        ])
        .getOne();

      const groupId = customizationGroup?.customization_group?.id || 1;
      const groupName =
        customizationGroup?.customization_group?.name || "Customizations";
      const groupDescription =
        customizationGroup?.customization_group?.description ||
        "Available customization options";
      const minSelections = customizationGroup?.min_selections || 0;
      const maxSelections = customizationGroup?.max_selections || 1;
      const inputType = "select"; // Default input type
      const isMandatory = customizationGroup?.is_mandatory || false;

      return [
        {
          id: groupId,
          name: groupName,
          description: groupDescription,
          min_selections: minSelections,
          max_selections: maxSelections,
          input_type: inputType,
          is_mandatory: isMandatory,
          options: options,
        },
      ];
    } catch (error) {
      this.logger.error(
        `❌ Error getting item customizations: ${error.message}`,
        error.stack,
      );
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
        .createQueryBuilder("i")
        .where('i."parentItemId" = :itemId', { itemId })
        .andWhere("i.type = :type", { type: "customization" })
        .andWhere("i.status = :status", { status: true })
        .getCount();

      this.logger.log(
        `📊 Found ${count} customization items for item ${itemId}`,
      );
      return count > 0;
    } catch (error) {
      this.logger.warn(
        `Failed to check customizations for item ${itemId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get item variants
   */
  /**
   * Get variant group as a menu item (for categories of type variant_group)
   */
  private async getVariantGroupAsMenuItem(
    restaurantId: number,
    categoryId: number,
    category: Category,
    params: any,
    favoriteItemIds: Set<number>,
  ) {
    try {
      // Find the variant group entity by category reference_id
      const variantGroup = await this.variantGroupsRepository.findOne({
        where: {
          reference_id: category.reference_id,
          store: { id: restaurantId },
        },
      });

      if (!variantGroup) {
        this.logger.warn(
          `Variant group not found for category ${category.reference_id}`,
        );
        return [];
      }

      // Get all variant items in this group
      const variantItems = await this.itemVariantsRepository
        .createQueryBuilder("iv")
        .leftJoinAndSelect("iv.item", "i")
        .leftJoinAndSelect("i.prices", "p")
        .leftJoinAndSelect("i.quantities", "q")
        .leftJoinAndSelect("i.attributes", "a")
        .where("iv.variantGroupId = :variantGroupId", {
          variantGroupId: variantGroup.id,
        })
        .andWhere("i.status = :status", { status: true })
        .getMany();

      if (variantItems.length === 0) {
        return [];
      }

      // Use the first variant as the base item data
      const firstVariant = variantItems[0].item;
      const firstPrice = firstVariant.prices?.[0];
      const firstQuantity = firstVariant.quantities?.[0];

      // Calculate price range across all variants
      const prices = variantItems
        .map((v) => v.item.prices?.[0]?.base_price)
        .filter((p) => p)
        .map((p) => parseFloat(p.toString()));

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Get dietary preference from first variant
      const dietaryAttr = firstVariant.attributes?.find(
        (attr) => attr.attribute_code === "veg_nonveg",
      );

      // Extract variant attribute options (e.g., all available sizes/colors)
      const variantAttributesMap = new Map<string, {
        attribute_code: string;
        attribute_name: string;
        options: Set<string>;
      }>();

      variantItems.forEach((variantItem) => {
        const variantAttrs = variantItem.item.attributes?.filter(
          (attr) => attr.attribute_group === "variant"
        ) || [];

        variantAttrs.forEach((attr) => {
          if (!variantAttributesMap.has(attr.attribute_code)) {
            variantAttributesMap.set(attr.attribute_code, {
              attribute_code: attr.attribute_code,
              attribute_name: attr.attribute_name,
              options: new Set(),
            });
          }
          variantAttributesMap.get(attr.attribute_code)!.options.add(attr.attribute_value);
        });
      });

      const variantAttributeOptions = Array.from(variantAttributesMap.values()).map((attr) => ({
        attribute_code: attr.attribute_code,
        attribute_name: attr.attribute_name,
        options: Array.from(attr.options),
      }));

      // Build variants array
      const variants = variantItems.map((variantItem) => {
        const price = variantItem.item.prices?.[0];
        const quantity = variantItem.item.quantities?.[0];
        const itemDietaryAttr = variantItem.item.attributes?.find(
          (attr) => attr.attribute_code === "veg_nonveg",
        );

        // Get variant-specific attributes for this item
        const itemVariantAttrs = variantItem.item.attributes?.filter(
          (attr) => attr.attribute_group === "variant"
        ) || [];

        const variantAttributes: Record<string, string> = {};
        itemVariantAttrs.forEach((attr) => {
          variantAttributes[attr.attribute_code] = attr.attribute_value;
        });

        return {
          id: variantItem.item.id,
          reference_id: variantItem.item.reference_id,
          name: variantItem.item.name,
          short_desc: variantItem.item.short_desc,
          images: variantItem.item.images || [],
          price: price?.base_price ? parseFloat(price.base_price.toString()) : 0,
          currency: price?.currency || "INR",
          is_available: quantity ? quantity.available_count > 0 : false,
          available_count: quantity?.available_count || 0,
          dietary_preference: itemDietaryAttr?.attribute_value || null,
          is_default: variantItem.is_default,
          variant_attributes: variantAttributes,
        };
      });

      // Create a single menu item representing all variants
      const menuItem = {
        id: firstVariant.id, // Use first variant's ID as representative
        name: variantGroup.name, // Use variant group name
        short_desc: variantGroup.description || firstVariant.short_desc,
        long_desc: firstVariant.long_desc,
        images: firstVariant.images || [],
        price: {
          base_price: minPrice,
          currency: firstPrice?.currency || "INR",
          maximum_price: maxPrice !== minPrice ? maxPrice : null,
          minimum_price_range: minPrice,
          maximum_price_range: maxPrice,
        },
        quantity: {
          unit_type: firstQuantity?.unit_type || "unit",
          unit_value: firstQuantity?.unit_value || 1,
          available_count: Math.max(
            ...variantItems.map(
              (v) => v.item.quantities?.[0]?.available_count || 0,
            ),
          ),
          maximum_count: firstQuantity?.maximum_count || 99,
        },
        attributes: [
          {
            attribute_code: "veg_nonveg",
            attribute_name: "Dietary Preference",
            attribute_value: dietaryAttr?.attribute_value || "veg",
            attribute_group: "dietary",
          },
        ],
        customizations: [],
        variants: [
          {
            id: variantGroup.id,
            reference_id: variantGroup.reference_id,
            name: variantGroup.name,
            description: variantGroup.description,
            attribute_options: variantAttributeOptions,
            variants: variants,
          },
        ],
        rating: 0,
        is_available: variants.some((v) => v.is_available),
        is_recommended: firstVariant.is_recommended || false,
        tax_rate: firstVariant.tax_rate || null,
        tax_type: firstVariant.tax_type || null,
        hsn_code: firstVariant.hsn_code || null,
        is_favorite: favoriteItemIds.has(firstVariant.id),
      };

      return [menuItem];
    } catch (error) {
      this.logger.error(
        `❌ Error getting variant group as menu item: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  private async getItemVariants(itemId: number) {
    try {
      // Get all variant groups this item belongs to
      const variantRecords = await this.itemVariantsRepository
        .createQueryBuilder("iv")
        .leftJoinAndSelect("iv.variant_group", "vg")
        .where("iv.itemId = :itemId", { itemId })
        .getMany();

      // For each variant group, get all variant items
      const variantGroups = await Promise.all(
        variantRecords.map(async (record) => {
          // Find all items in this variant group
          const allVariantsInGroup = await this.itemVariantsRepository
            .createQueryBuilder("iv")
            .leftJoinAndSelect("iv.item", "i")
            .leftJoinAndSelect("i.prices", "p")
            .leftJoinAndSelect("i.quantities", "q")
            .leftJoinAndSelect("i.attributes", "a")
            .where("iv.variantGroupId = :variantGroupId", {
              variantGroupId: record.variant_group.id,
            })
            .andWhere("i.status = :status", { status: true })
            .getMany();

          // Extract variant attribute options
          const variantAttributesMap = new Map<string, {
            attribute_code: string;
            attribute_name: string;
            options: Set<string>;
          }>();

          allVariantsInGroup.forEach((variantItem) => {
            const variantAttrs = variantItem.item.attributes?.filter(
              (attr) => attr.attribute_group === "variant"
            ) || [];

            variantAttrs.forEach((attr) => {
              if (!variantAttributesMap.has(attr.attribute_code)) {
                variantAttributesMap.set(attr.attribute_code, {
                  attribute_code: attr.attribute_code,
                  attribute_name: attr.attribute_name,
                  options: new Set(),
                });
              }
              variantAttributesMap.get(attr.attribute_code)!.options.add(attr.attribute_value);
            });
          });

          const variantAttributeOptions = Array.from(variantAttributesMap.values()).map((attr) => ({
            attribute_code: attr.attribute_code,
            attribute_name: attr.attribute_name,
            options: Array.from(attr.options),
          }));

          // Map variant items with their details
          const variantOptions = allVariantsInGroup.map((variantItem) => {
            const price = variantItem.item.prices?.[0];
            const quantity = variantItem.item.quantities?.[0];
            const dietaryAttr = variantItem.item.attributes?.find(
              (attr) => attr.attribute_code === "veg_nonveg",
            );

            const itemVariantAttrs = variantItem.item.attributes?.filter(
              (attr) => attr.attribute_group === "variant"
            ) || [];

            const variantAttributes: Record<string, string> = {};
            itemVariantAttrs.forEach((attr) => {
              variantAttributes[attr.attribute_code] = attr.attribute_value;
            });

            return {
              id: variantItem.item.id,
              reference_id: variantItem.item.reference_id,
              name: variantItem.item.name,
              short_desc: variantItem.item.short_desc,
              images: variantItem.item.images || [],
              price: price?.base_price ? parseFloat(price.base_price.toString()) : 0,
              currency: price?.currency || "INR",
              is_available: quantity ? quantity.available_count > 0 : false,
              available_count: quantity?.available_count || 0,
              dietary_preference: dietaryAttr?.attribute_value || null,
              is_default: variantItem.is_default,
              variant_attributes: variantAttributes,
            };
          });

          return {
            id: record.variant_group.id,
            reference_id: record.variant_group.reference_id,
            name: record.variant_group.name,
            description: record.variant_group.description,
            attribute_options: variantAttributeOptions,
            variants: variantOptions,
          };
        }),
      );

      return variantGroups;
    } catch (error) {
      this.logger.error(
        `❌ Error getting item variants: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Calculate restaurant rating from reviews
   */
  private async calculateRestaurantRating(
    storeId: number,
  ): Promise<{ rating: number; reviewCount: number }> {
    try {
      const result = await this.restaurantReviewRepository
        .createQueryBuilder("rr")
        .select("AVG(rr.rating)", "avgRating")
        .addSelect("COUNT(rr.id)", "reviewCount")
        .where("rr.storeId = :storeId", { storeId })
        .getRawOne();

      return {
        rating: parseFloat(result?.avgRating || "0") || 0,
        reviewCount: parseInt(result?.reviewCount || "0") || 0,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to calculate restaurant rating for store ${storeId}: ${error.message}`,
      );
      return { rating: 0, reviewCount: 0 };
    }
  }

  /**
   * Calculate item rating from reviews
   */
  private async calculateItemRating(
    itemId: number,
  ): Promise<{ rating: number; reviewCount: number }> {
    try {
      const result = await this.itemReviewRepository
        .createQueryBuilder("ir")
        .select("AVG(ir.rating)", "avgRating")
        .addSelect("COUNT(ir.id)", "reviewCount")
        .where("ir.itemId = :itemId", { itemId })
        .getRawOne();

      return {
        rating: parseFloat(result.avgRating) || 0,
        reviewCount: parseInt(result.reviewCount) || 0,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to calculate item rating for item ${itemId}: ${error.message}`,
      );
      return { rating: 0, reviewCount: 0 };
    }
  }

  /**
   * Get top 5 highly rated restaurants within specified radius
   */
  private async getTopRatedRestaurants(
    userLat: number,
    userLng: number,
    radius: number = 10,
    favoriteStoreIds: Set<number> = new Set(),
  ) {
    try {
      const distanceQuery = this.locationService.buildDistanceQuery(
        userLat,
        userLng,
        radius,
      );
      const distanceFilter = this.locationService.buildDistanceFilter(
        userLat,
        userLng,
        radius,
      );

      // Get restaurants with their average ratings
      const restaurants = await this.storeRepository
        .createQueryBuilder("s")
        .leftJoin("s.locations", "sl")
        .leftJoin(
          RestaurantReview,
          "rr",
          "rr.storeId = s.id",
        )
        .leftJoin("s.fulfillments", "sf", "sf.type = :deliveryType", {
          deliveryType: "Delivery",
        })
        .select([
          "s.id as s_id",
          "s.name as s_name",
          "s.description as s_description",
          "s.logo_url as s_logo_url",
          "s.fssai_license_no as s_fssai_license_no",
          "s.food_type as s_food_type",
          "s.tags as s_tags",
          "s.preparation_time as s_preparation_time",
          "sl.gps_lat as sl_gps_lat",
          "sl.gps_lng as sl_gps_lng",
          "sl.address_city as sl_address_city",
          "sl.address_locality as sl_address_locality",
          "sf.contact_phone as sf_contact_phone",
          "sf.contact_email as sf_contact_email",
          `${distanceQuery}`,
          "AVG(rr.rating) as avg_rating",
          "COUNT(rr.id) as review_count",
        ])
        .where("s.status = :status", { status: true })
        .andWhere(distanceFilter)
        .groupBy("s.id, sl.id, sf.id")
        .having("AVG(rr.rating) > 0") // Only include restaurants with at least one review
        .orderBy("avg_rating", "DESC")
        .addOrderBy("review_count", "DESC") // Secondary sort by review count
        .limit(5)
        .getRawMany();

      // Batch fetch all active close timings for all restaurants at once (optimization to avoid N+1 queries)
      const restaurantIds = restaurants.map((r) => r.s_id);
      const now = new Date();
      const activeCloseTimings = await this.storeCloseTimingsRepository.find({
        where: {
          store: { id: In(restaurantIds) },
          close_start_datetime: LessThanOrEqual(now),
          close_end_datetime: MoreThanOrEqual(now),
        },
      });
      // Create a Set of restaurant IDs with active close timings for O(1) lookup
      const restaurantsWithActiveCloseTimings = new Set(
        activeCloseTimings.map((ct) => ct.store.id),
      );

      // Process and enrich restaurant data
      const topRatedRestaurants = await Promise.all(
        restaurants.map(async (restaurant) => {
          const distance = parseFloat(restaurant.distance);
          const avgRating = parseFloat(restaurant.avg_rating) || 0;

          // Check if store is open
          const storeOpenData = await this.isStoreOpen(restaurant.s_id);

          // Calculate delivery time with hyperlocal improvements
          const deliveryTime = this.calculateDeliveryTime(
            distance,
            restaurant.s_id,
            avgRating,
            restaurant.s_preparation_time || undefined, // Use store-specific preparation time from ONDC
          );

          // Count items in this restaurant
          const itemsCount = await this.itemRepository
            .createQueryBuilder("i")
            .where("i.storeId = :storeId", { storeId: restaurant.s_id })
            .andWhere("i.status = :status", { status: true })
            .getCount();

          // Fetch timings for the restaurant
          const store_timings = await this.storeTimingsRepository.find({
            where: { store: { id: restaurant.s_id } },
            order: { day_from: "ASC" },
          });

          const hasActiveCloseTiming = restaurantsWithActiveCloseTimings.has(restaurant.s_id);
          const timings = this.expandTimingsToDays(store_timings, hasActiveCloseTiming);

          return {
            id: restaurant.s_id,
            name: restaurant.s_name,
            description: restaurant.s_description,
            logo_url: restaurant.s_logo_url,
            fssai_license: restaurant.s_fssai_license_no,
            food_type: (restaurant.s_food_type as StoreDietaryPreference) || undefined,
            cuisine_tags: restaurant.s_tags ? restaurant.s_tags.join(", ") : "",
            location: {
              lat: restaurant.sl_gps_lat,
              lng: restaurant.sl_gps_lng,
              city: restaurant.sl_address_city,
              locality: restaurant.sl_address_locality,
            },
            distance: Math.round(distance * 100) / 100,
            rating: Math.round(parseFloat(restaurant.avg_rating) * 10) / 10,
            review_count: parseInt(restaurant.review_count) || 0,
            delivery_time: deliveryTime,
            offers_count: 0,
            items_count: itemsCount,
            is_open: storeOpenData.isOpen,
            is_favorite: favoriteStoreIds.has(restaurant.s_id),
            timings,
            phone_number: restaurant.sf_contact_phone || null,
            email: restaurant.sf_contact_email || null,
          };
        }),
      );

      return topRatedRestaurants;
    } catch (error) {
      this.logger.error(
        `❌ Error getting top rated restaurants: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Check if store is currently open
   */
  private async isStoreOpen(
    storeId: number,
  ): Promise<{ isOpen: boolean; nextOpenTime?: string }> {
    try {
      // Use IST timezone for all time calculations
      const currentDay = TimezoneUtil.getCurrentISTDay(); // Monday=1, ..., Saturday=6, Sunday=7
      const currentTime = TimezoneUtil.getCurrentISTTimeHHMM(); // HHMM format

      this.logger.log(
        `🕐 Checking store ${storeId} open status - IST Day: ${currentDay}, Time: ${currentTime} (${TimezoneUtil.formatTimeHHMM(currentTime)})`,
      );

      // Check regular timings
      const todayTiming = await this.storeTimingsRepository
        .createQueryBuilder("st")
        .where("st.storeId = :storeId", { storeId })
        .andWhere("st.day_from <= :day AND st.day_to >= :day", {
          day: currentDay,
        })
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
      const now = TimezoneUtil.getCurrentISTTime();
      const specialClosure = await this.storeRepository
        .createQueryBuilder("s")
        .leftJoin("s.closeTimings", "sct")
        .where("s.id = :storeId", { storeId })
        .andWhere("sct.close_start_datetime <= :now", { now })
        .andWhere("sct.close_end_datetime >= :now", { now })
        .getOne();

      if (specialClosure) {
        return { isOpen: false };
      }

      return { isOpen: true };
    } catch (error) {
      this.logger.warn(
        `Failed to check store timing for store ${storeId}: ${error.message}`,
      );
      return { isOpen: false };
    }
  }

  /**
   * Calculate delivery time for hyperlocal delivery with smart adjustments
   * Includes: time-of-day adjustments, distance-based calculation, store rating, and dynamic buffer
   * @param distance - Distance in kilometers (from Haversine)
   * @param storeId - Store ID (optional, for future store-specific optimizations)
   * @param storeRating - Store rating (optional, for performance-based adjustments)
   * @param storePreparationTime - Store-specific preparation time in ISO8601 format (e.g., PT10M, PT1H30M) from ONDC descriptor.order_preparation_time
   * @returns Formatted delivery time string (e.g., "20-25 mins")
   */
  private calculateDeliveryTime(
    distance: number,
    storeId?: number,
    storeRating?: number,
    storePreparationTime?: string,
  ): string {
    try {
      // Use IST timezone for time calculations
      const now = TimezoneUtil.getCurrentISTTime();

      // ============================================
      // 1. TIME-OF-DAY ADJUSTMENTS (Peak Hours)
      // ============================================
      const peakData = this.getPeakHourData(now);
      const peakMultiplier = peakData.multiplier;

      // ============================================
      // 2. HYPERLOCAL DISTANCE-TO-TIME CALCULATION
      // ============================================
      const travelTime = this.calculateTravelTimeFromDistance(distance);

      // ============================================
      // 3. DYNAMIC PREPARATION TIME
      // ============================================
      // Parse ISO8601 duration string to minutes if provided, otherwise calculate based on rating
      let basePrepTime: number;
      if (storePreparationTime) {
        // Parse ISO8601 duration format (e.g., PT10M, PT1H30M)
        const parsedMinutes = this.parseISO8601Duration(storePreparationTime);
        basePrepTime =
          parsedMinutes > 0
            ? parsedMinutes
            : this.calculatePrepTime(storeRating);
      } else {
        basePrepTime = this.calculatePrepTime(storeRating);
      }
      const adjustedPrepTime = Math.round(basePrepTime * peakMultiplier);

      // ============================================
      // 4. TOTAL TIME CALCULATION
      // ============================================
      const totalTime = adjustedPrepTime + travelTime;

      // ============================================
      // 5. DYNAMIC BUFFER TIME
      // ============================================
      const bufferTime = this.getDynamicBuffer(now, peakData);
      const finalTime = totalTime + bufferTime;

      // ============================================
      // 6. ROUND AND FORMAT
      // ============================================
      // Round to nearest 5 minutes, minimum 15 minutes for hyperlocal
      const roundedTime = Math.max(15, Math.ceil(finalTime / 5) * 5);

      // Format as range (e.g., "20-25 mins")
      const minTime = roundedTime;
      const maxTime = Math.min(60, roundedTime + 5); // Cap at 60 minutes for hyperlocal

      return `${minTime}-${maxTime} mins`;
    } catch (error) {
      this.logger.warn(`Failed to calculate delivery time: ${error.message}`);
      return "25-30 mins"; // Default fallback
    }
  }

  /**
   * Calculate travel time from distance (optimized for hyperlocal delivery)
   * @param distance - Distance in kilometers
   * @returns Travel time in minutes
   */
  private calculateTravelTimeFromDistance(distance: number): number {
    if (distance <= 1) {
      // Very close (< 1km): 3-4 minutes
      return 3 + Math.round(distance);
    } else if (distance <= 2) {
      // Close (1-2km): 4-6 minutes (2 min/km average)
      return 4 + Math.round(distance * 1.5);
    } else if (distance <= 5) {
      // Medium (2-5km): 6-10 minutes (1.5 min/km)
      return 6 + Math.round(distance * 1.3);
    } else if (distance <= 10) {
      // Far (5-10km): 10-15 minutes (1 min/km)
      return 10 + Math.round(distance);
    } else {
      // Very far (>10km): Standard calculation
      return Math.max(12, Math.round(distance * 1.2));
    }
  }

  /**
   * Calculate preparation time based on store rating
   * Higher rated stores tend to be more efficient
   * @param storeRating - Store rating (1-5)
   * @returns Base preparation time in minutes
   */
  private calculatePrepTime(storeRating?: number): number {
    let basePrepTime = 10; // Default base prep time

    if (storeRating !== undefined && storeRating > 0) {
      if (storeRating >= 4.5) {
        basePrepTime = 8; // Highly rated stores are faster
      } else if (storeRating >= 4.0) {
        basePrepTime = 9;
      } else if (storeRating >= 3.5) {
        basePrepTime = 10; // Average
      } else if (storeRating >= 3.0) {
        basePrepTime = 11;
      } else {
        basePrepTime = 12; // Lower rated stores might take longer
      }
    }

    return basePrepTime;
  }

  /**
   * Get peak hour data (multiplier and type)
   * @param now - Current date/time
   * @returns Peak hour information with multiplier
   */
  private getPeakHourData(now: Date): {
    isPeak: boolean;
    peakType?: "lunch" | "dinner";
    multiplier: number;
  } {
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour * 60 + minutes;

    // Lunch peak: 12:00 PM - 2:00 PM (720 - 840 minutes)
    const lunchStart = 12 * 60;
    const lunchEnd = 14 * 60;

    // Dinner peak: 7:00 PM - 9:30 PM (1140 - 1290 minutes)
    const dinnerStart = 19 * 60;
    const dinnerEnd = 21 * 60 + 30;

    if (currentTime >= lunchStart && currentTime <= lunchEnd) {
      return { isPeak: true, peakType: "lunch", multiplier: 1.25 }; // 25% increase
    }

    if (currentTime >= dinnerStart && currentTime <= dinnerEnd) {
      return { isPeak: true, peakType: "dinner", multiplier: 1.35 }; // 35% increase (dinner is busier)
    }

    // Off-peak hours (early morning, late night, mid-afternoon)
    if (
      (hour >= 9 && hour < 11) ||
      (hour >= 15 && hour < 18) ||
      hour >= 22 ||
      hour < 9
    ) {
      return { isPeak: false, multiplier: 0.9 }; // 10% faster off-peak
    }

    // Normal hours
    return { isPeak: false, multiplier: 1.0 };
  }

  /**
   * Get dynamic buffer time based on current conditions
   * @param now - Current date/time
   * @param peakData - Peak hour information
   * @returns Buffer time in minutes
   */
  private getDynamicBuffer(
    now: Date,
    peakData: {
      isPeak: boolean;
      peakType?: "lunch" | "dinner";
      multiplier: number;
    },
  ): number {
    if (peakData.isPeak) {
      if (peakData.peakType === "dinner") {
        return 10; // Dinner peak needs more buffer
      } else {
        return 8; // Lunch peak
      }
    }

    // Off-peak hours (early morning, late night, mid-afternoon)
    const hour = now.getHours();
    if (
      (hour >= 9 && hour < 11) ||
      (hour >= 15 && hour < 18) ||
      hour >= 22 ||
      hour < 9
    ) {
      return 3; // Off-peak needs less buffer
    }

    return 5; // Normal buffer
  }

  /**
   * Parse ISO8601 duration format to minutes
   * Examples: PT10M = 10 minutes, PT1H30M = 90 minutes, PT45S = 0 minutes (rounded), P1DT2H = 1560 minutes
   * Format: P[nD]T[nH][nM][nS] where P=period, T=time separator, D=days, H=hours, M=minutes, S=seconds
   * @param duration - ISO8601 duration string (e.g., PT10M, PT1H30M)
   * @param fallback - Fallback value in minutes if parsing fails
   * @returns Duration in minutes
   */
  private parseISO8601Duration(
    duration: string | undefined,
    fallback: number = 10,
  ): number {
    if (!duration || typeof duration !== "string") {
      return fallback;
    }

    try {
      // ISO8601 duration format: P[nD]T[nH][nM][nS]
      // Examples: PT10M, PT1H30M, PT45S, P1DT2H30M
      const durationRegex =
        /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i;

      const match = duration.trim().toUpperCase().match(durationRegex);

      if (!match) {
        this.logger.warn(
          `Invalid ISO8601 duration format: ${duration}, using fallback ${fallback} minutes`,
        );
        return fallback;
      }

      // Extract components (match[0] is full match, so indices start at 1)
      const days = parseInt(match[1] || "0", 10);
      const hours = parseInt(match[2] || "0", 10);
      const minutes = parseInt(match[3] || "0", 10);
      const seconds = parseFloat(match[4] || "0");

      // Convert everything to minutes
      const totalMinutes =
        days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);

      // Validate: must be positive and reasonable (max 24 hours = 1440 minutes)
      if (totalMinutes <= 0 || totalMinutes > 1440) {
        this.logger.warn(
          `Duration ${duration} results in ${totalMinutes} minutes (out of range), using fallback ${fallback} minutes`,
        );
        return fallback;
      }

      return totalMinutes;
    } catch (error) {
      this.logger.warn(
        `Failed to parse ISO8601 duration: ${duration}, using fallback ${fallback} minutes`,
      );
      return fallback;
    }
  }

  /**
   * Get search suggestions based on dishes and nearby restaurants only
   * Restaurants are sorted by distance (ascending)
   */
  async getSearchSuggestions(
    request: SearchSuggestionsRequestDto,
    userId?: number,
  ) {
    const { query, location, filters, limit = 10 } = request;

    // DEBUG: Log the entire request object
    this.logger.log(
      `🔍 DEBUG - Full request object: ${JSON.stringify(request)}`,
    );
    this.logger.log(`🔍 DEBUG - request.lat: ${(request as any).lat}`);
    this.logger.log(`🔍 DEBUG - request.lng: ${(request as any).lng}`);
    this.logger.log(`🔍 DEBUG - location?.lat: ${location?.lat}`);
    this.logger.log(`🔍 DEBUG - location?.lng: ${location?.lng}`);

    // Handle both nested location object AND root-level lat/lng for backwards compatibility
    const requestLat = location?.lat || (request as any).lat;
    const requestLng = location?.lng || (request as any).lng;

    this.logger.log(`🔍 Getting search suggestions for: "${query}"`);
    this.logger.log(`👤 User ID: ${userId || "guest"}`);
    this.logger.log(
      `📍 Input location - lat: ${requestLat}, lng: ${requestLng}`,
    );

    const suggestions: any[] = [];

    try {
      // Get user location - prioritize location from request
      let userLocation;

      // If location is explicitly provided in request (nested OR root level), use it directly
      if (requestLat && requestLng) {
        this.logger.log(
          `📍 Using location from request: ${requestLat}, ${requestLng}`,
        );
        userLocation = {
          lat: requestLat,
          lng: requestLng,
          source: "device_location" as const,
        };
      } else if (userId) {
        // Only fetch user's saved location if not provided in request
        this.logger.log(
          `🔍 No location in request, fetching saved location for user: ${userId}`,
        );
        userLocation = await this.locationService.getUserLocation(userId);
        this.logger.log(
          `📍 User location from service: ${userLocation.lat}, ${userLocation.lng} (source: ${userLocation.source})`,
        );
      } else {
        // Guest user without location - use default
        this.logger.log(`🔍 Guest user without location, using default`);
        userLocation = {
          lat: 9.93523,
          lng: 78.130404,
          source: "device_location" as const,
        };
      }

      // 1. Search dishes (primary suggestions)
      this.logger.log(`🔍 Searching dishes...`);
      const dishSuggestions = await this.dishRepository
        .createQueryBuilder("d")
        .where("d.status = :status", { status: true })
        .andWhere("LOWER(d.name) LIKE LOWER(:query)", { query: `%${query}%` })
        .select(["d.id", "d.name", "d.description", "d.icon"])
        .orderBy("d.name", "ASC")
        .limit(Math.ceil(limit * 0.6)) // 60% of suggestions are dishes
        .getMany();

      this.logger.log(`🍽️ Found ${dishSuggestions.length} dishes`);

      // Add dish suggestions
      for (const dish of dishSuggestions) {
        suggestions.push({
          id: dish.id,
          name: dish.name,
          type: "dish",
          description: dish.description,
          icon: dish.icon,
          image: dish.icon,
        });
      }

      // 2. Search nearby restaurants (secondary suggestions)
      // Now always searches restaurants since we always have a location
      const remainingLimit = limit - suggestions.length;
      this.logger.log(`🔍 Remaining limit for restaurants: ${remainingLimit}`);

      if (remainingLimit > 0) {
        this.logger.log(
          `🏪 Searching nearby restaurants with location: ${userLocation.lat}, ${userLocation.lng}`,
        );

        // Get nearby restaurants sorted by distance
        // Search restaurants by name OR restaurants that have items matching the query
        const restaurantSuggestions = await this.storeRepository
          .createQueryBuilder("s")
          .leftJoin("s.locations", "sl")
          .leftJoin("s.items", "i") // Join with items to search by item names
          .leftJoin("s.fulfillments", "sf", "sf.type = :deliveryType", {
            deliveryType: "Delivery",
          })
          .where("s.status = :status", { status: true })
          .andWhere("sl.gps_lat IS NOT NULL")
          .andWhere("sl.gps_lng IS NOT NULL")
          .andWhere(
            "(LOWER(s.name) LIKE LOWER(:query) OR LOWER(i.name) LIKE LOWER(:query))",
            { query: `%${query}%` },
          )
          .select([
            "s.id",
            "s.name",
            "s.description",
            "s.logo_url",
            "s.food_type as s_food_type",
            "s.tags as s_tags",
            "sl.gps_lat",
            "sl.gps_lng",
            "sl.address_city",
            "sl.address_locality",
            "sf.contact_phone as sf_contact_phone",
            "sf.contact_email as sf_contact_email",
          ])
          .addSelect(
            `(6371 * acos(cos(radians(:userLat)) * cos(radians(sl.gps_lat)) * cos(radians(sl.gps_lng) - radians(:userLng)) + sin(radians(:userLat)) * sin(radians(sl.gps_lat))))`,
            "distance",
          )
          .setParameters({
            userLat: userLocation.lat,
            userLng: userLocation.lng,
          })
          .groupBy(
            "s.id, sl.gps_lat, sl.gps_lng, sl.address_city, sl.address_locality, sf.id",
          ) // Group to avoid duplicates
          .orderBy("distance", "ASC")
          .limit(remainingLimit)
          .getRawMany();

        this.logger.log(`🏪 Found ${restaurantSuggestions.length} restaurants`);

        // Add restaurant suggestions
        for (const restaurant of restaurantSuggestions) {
          suggestions.push({
            id: restaurant.s_id,
            name: restaurant.s_name,
            type: "restaurant",
            description: restaurant.s_description,
            icon: restaurant.s_logo_url,
            image: restaurant.s_logo_url,
            distance: restaurant.distance,
            food_type: (restaurant.s_food_type as StoreDietaryPreference) || undefined,
            cuisine_tags: restaurant.s_tags ? restaurant.s_tags.join(", ") : "",
            location: {
              lat: restaurant.sl_gps_lat,
              lng: restaurant.sl_gps_lng,
              city: restaurant.sl_address_city,
              locality: restaurant.sl_address_locality,
            },
            phone_number: restaurant.sf_contact_phone || null,
            email: restaurant.sf_contact_email || null,
          });
        }
      }

      // Sort suggestions by type (dishes first, then restaurants by distance)
      suggestions.sort((a, b) => {
        if (a.type === "dish" && b.type === "restaurant") return -1;
        if (a.type === "restaurant" && b.type === "dish") return 1;
        if (a.type === "restaurant" && b.type === "restaurant") {
          return a.distance - b.distance; // Sort restaurants by distance
        }
        return 0;
      });

      this.logger.log(
        `✅ Found ${suggestions.length} total suggestions for "${query}"`,
      );

      return {
        success: true,
        message: "Search suggestions retrieved successfully",
        data: {
          query,
          location: {
            lat: userLocation.lat,
            lng: userLocation.lng,
            source: userLocation.source,
          },
          suggestions: suggestions.slice(0, limit),
          total_suggestions: suggestions.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting search suggestions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to get search suggestions",
      );
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
        .createQueryBuilder("i")
        .leftJoin("i.parent_item", "parent")
        .where("i.id = :itemId", { itemId })
        .andWhere("i.status = :status", { status: true })
        .andWhere("i.type = :type", { type: "item" })
        .andWhere("parent.id IS NULL")
        .select(["i.id", "i.name", "i.type"])
        .getOne();

      if (!item) {
        throw new NotFoundException("Item not found or is not a main item");
      }

      // Check if item has customizations
      const hasCustomizations = await this.checkItemHasCustomizations(itemId);

      if (!hasCustomizations) {
        return {
          success: true,
          message: "Item customizations retrieved successfully",
          data: {
            item_id: item.id,
            item_name: item.name,
            has_customizations: false,
            customizations: [],
          },
        };
      }

      // Get customization groups and options
      const customizations = await this.getCustomizationGroups(itemId);

      return {
        success: true,
        message: "Item customizations retrieved successfully",
        data: {
          item_id: item.id,
          item_name: item.name,
          has_customizations: true,
          customizations: customizations,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting item customizations: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Failed to retrieve item customizations",
      );
    }
  }

  /**
   * Get categorized items for a restaurant with filtering and sorting
   */
  private async getCategorizedItems(
    restaurantId: number,
    search?: string,
    dietaryPreference?: string,
    favoriteItemIds: Set<number> = new Set(),
    store?: any,
  ) {
    try {
      this.logger.log(
        `🍽️ Getting categorized items for restaurant ${restaurantId}`,
      );
      this.logger.log(
        `🔍 Search: ${search || "none"}, Dietary: ${dietaryPreference || "none"}`,
      );

      // Get categories with their items (including variant items)
      const categoriesQuery = this.categoryRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.item_categories", "ic")
        .leftJoinAndSelect("ic.item", "i")
        .leftJoinAndSelect("i.prices", "p")
        .leftJoinAndSelect("i.attributes", "a")
        .leftJoinAndSelect("i.parent_item", "parent")
        .leftJoinAndSelect("i.timings", "t")
        .leftJoinAndSelect("i.itemVariants", "iv") // Load variant relationships
        .leftJoinAndSelect("iv.variant_group", "vg") // Load variant group info
        .where("c.storeId = :storeId", { storeId: restaurantId })
        .andWhere("c.status = :status", { status: true })
        .andWhere("(c.type != :variantType OR c.type IS NULL)", {
          variantType: "variant_group",
        })
        .andWhere("i.status = :status", { status: true });

      // Apply search filter
      if (search && search.trim()) {
        categoriesQuery.andWhere("LOWER(i.name) LIKE LOWER(:search)", {
          search: `%${search.trim()}%`,
        });
      }

      // Apply dietary preference filter
      if (dietaryPreference) {
        categoriesQuery.andWhere("a.attribute_code = :attrCode", {
          attrCode: "veg_nonveg",
        });
        categoriesQuery.andWhere("a.attribute_value = :attrValue", {
          attrValue: dietaryPreference,
        });
      }

      const categories = await categoriesQuery
        .orderBy("c.display_rank", "ASC")
        .addOrderBy("i.name", "ASC")
        .getMany();

      // Collect all item IDs first to batch load timings
      const allItemIds: number[] = [];
      for (const category of categories) {
        if (category.item_categories && category.item_categories.length > 0) {
          for (const itemCategory of category.item_categories) {
            const item = itemCategory.item;
            if (item && item.type === "item" && item.parent_item === null) {
              allItemIds.push(item.id);
            }
          }
        }
      }

      // Batch load all item timings in a single query to ensure all timings are loaded
      const allItemTimingsMap = new Map<number, any[]>();
      if (allItemIds.length > 0) {
        const itemsWithTimings = await this.itemRepository
          .createQueryBuilder("i")
          .leftJoinAndSelect("i.timings", "t")
          .where("i.id IN (:...itemIds)", { itemIds: allItemIds })
          .getMany();

        // Create a map of item ID to timings array (ensures all timings are captured)
        for (const item of itemsWithTimings) {
          // Store all timings for this item - TypeORM should load all via leftJoinAndSelect
          const timings = item.timings || [];
          allItemTimingsMap.set(item.id, timings);

          if (timings.length > 0) {
            this.logger.debug(
              `Loaded ${timings.length} timing(s) for item ${item.id}`,
            );
          }
        }
      }

      // Process categories and items
      const processedCategories: any[] = [];

      for (const category of categories) {
        if (
          !category.item_categories ||
          category.item_categories.length === 0
        ) {
          continue; // Skip categories with no items
        }

        // Group items by variant group
        const variantGroupsMap = new Map<string, any[]>();
        const standaloneItems: any[] = [];

        for (const itemCategory of category.item_categories) {
          const item = itemCategory.item;
          if (!item) continue;

          // Only show main items (type='item' and parent_item=null)
          if (item.type !== "item" || item.parent_item !== null) {
            continue;
          }

          // Check if item is part of a variant group
          if (item.itemVariants && item.itemVariants.length > 0) {
            const variantGroupId = item.itemVariants[0].variant_group.reference_id;
            if (!variantGroupsMap.has(variantGroupId)) {
              variantGroupsMap.set(variantGroupId, []);
            }
            variantGroupsMap.get(variantGroupId)!.push(item);
          } else {
            // Standalone item (not part of variant group)
            standaloneItems.push(item);
          }
        }

        // Process standalone items
        const processedItems: any[] = [];

        for (const item of standaloneItems) {
          const itemRating = await this.calculateItemRating(item.id);
          const dietaryAttr = item.attributes?.find(
            (attr) => attr.attribute_code === "veg_nonveg",
          );
          const dietaryPref =
            (dietaryAttr?.attribute_value as DietaryPreference) ||
            DietaryPreference.NON_VEG;

          const basePrice = item.prices?.[0]?.base_price || 0;
          const currency = item.prices?.[0]?.currency || "INR";

          const quantity = item.quantities?.[0];
          const availableCount = quantity?.available_count || 0;
          const maximumCount = quantity?.maximum_count || 0;
          const isAvailable = availableCount > 0;

          const customizations = await this.getCustomizationGroups(item.id);
          const hasCustomizations = customizations.length > 0;

          const allItemTimings = allItemTimingsMap.get(item.id) || [];
          const itemTimings = allItemTimings.length > 0
            ? this.normalizeItemTimings(allItemTimings)
            : [];

          const restaurantItem = {
            id: item.id,
            name: item.name,
            description: item.short_desc || "",
            long_description: item.long_desc || undefined,
            images: item.images || [],
            price: {
              base_price: basePrice,
              currency: currency,
            },
            rating: itemRating.rating,
            is_available: isAvailable,
            available_count: availableCount,
            maximum_count: maximumCount,
            is_recommended: item.is_recommended,
            dietary_preference: dietaryPref,
            food_type: store?.food_type || undefined,
            cuisine_tags: store?.tags ? store.tags.join(", ") : undefined,
            has_customizations: hasCustomizations,
            has_variants: false,
            customizations: customizations,
            is_favorite: favoriteItemIds.has(item.id),
            timings: itemTimings,
          };

          // NEW: Enrich with preorder info
          await this.enrichItemWithPreorderInfo(restaurantItem, restaurantId);

          processedItems.push(restaurantItem);
        }

        // Process variant groups
        for (const [variantGroupId, variantItems] of variantGroupsMap) {
          if (variantItems.length === 0) continue;

          // Use first variant as base for common properties
          const baseItem = variantItems[0];
          const variantGroup = baseItem.itemVariants[0].variant_group;

          // Find the variant group category to get the correct display name
          const variantGroupCategory = await this.categoryRepository.findOne({
            where: {
              reference_id: variantGroupId,
              store: { id: restaurantId },
              type: "variant_group",
            },
          });

          // Calculate price range
          const prices = variantItems
            .map((v) => parseFloat(v.prices?.[0]?.base_price?.toString() || "0"))
            .filter((p) => p > 0);
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

          const currency = baseItem.prices?.[0]?.currency || "INR";
          const dietaryAttr = baseItem.attributes?.find(
            (attr) => attr.attribute_code === "veg_nonveg",
          );
          const dietaryPref =
            (dietaryAttr?.attribute_value as DietaryPreference) ||
            DietaryPreference.NON_VEG;

          // Get customizations from first variant
          const customizations = await this.getCustomizationGroups(baseItem.id);
          const hasCustomizations = customizations.length > 0;

          // Get rating from first variant
          const itemRating = await this.calculateItemRating(baseItem.id);

          // Extract variant attribute options
          const variantAttributesMap = new Map<string, {
            attribute_code: string;
            attribute_name: string;
            options: Set<string>;
          }>();

          variantItems.forEach((variantItem) => {
            const variantAttrs = variantItem.attributes?.filter(
              (attr) => attr.attribute_group === "variant"
            ) || [];

            variantAttrs.forEach((attr) => {
              if (!variantAttributesMap.has(attr.attribute_code)) {
                variantAttributesMap.set(attr.attribute_code, {
                  attribute_code: attr.attribute_code,
                  attribute_name: attr.attribute_name,
                  options: new Set(),
                });
              }
              variantAttributesMap.get(attr.attribute_code)!.options.add(attr.attribute_value);
            });
          });

          const variantAttributeOptions = Array.from(variantAttributesMap.values()).map((attr) => ({
            attribute_code: attr.attribute_code,
            attribute_name: attr.attribute_name,
            options: Array.from(attr.options),
          }));

          // Build variants array
          const variants = variantItems.map((variantItem) => {
            const price = variantItem.prices?.[0];
            const quantity = variantItem.quantities?.[0];
            const itemDietaryAttr = variantItem.attributes?.find(
              (attr) => attr.attribute_code === "veg_nonveg",
            );

            const itemVariantAttrs = variantItem.attributes?.filter(
              (attr) => attr.attribute_group === "variant"
            ) || [];

            const variantAttributes: Record<string, string> = {};
            itemVariantAttrs.forEach((attr) => {
              variantAttributes[attr.attribute_code] = attr.attribute_value;
            });

            const allItemTimings = allItemTimingsMap.get(variantItem.id) || [];
            const itemTimings = allItemTimings.length > 0
              ? this.normalizeItemTimings(allItemTimings)
              : [];

            return {
              id: variantItem.id,
              reference_id: variantItem.reference_id,
              name: variantItem.name,
              description: variantItem.short_desc || "",
              images: variantItem.images || [],
              price: price?.base_price ? parseFloat(price.base_price.toString()) : 0,
              currency: price?.currency || "INR",
              is_available: quantity ? quantity.available_count > 0 : variantItem.status,
              available_count: quantity?.available_count || 0,
              dietary_preference: itemDietaryAttr?.attribute_value || null,
              is_default: variantItem.itemVariants[0]?.is_default || false,
              variant_attributes: variantAttributes,
              timings: itemTimings,
            };
          });

          const variantRestaurantItem = {
            id: baseItem.id,
            name: variantGroupCategory?.name || variantGroup.name,
            description: variantGroupCategory?.description || baseItem.short_desc || "",
            long_description: baseItem.long_desc || undefined,
            images: baseItem.images || [],
            price: {
              base_price: minPrice,
              currency: currency,
              maximum_price: maxPrice !== minPrice ? maxPrice : null,
            },
            rating: itemRating.rating,
            is_available: variants.some((v) => v.is_available),
            is_recommended: baseItem.is_recommended,
            dietary_preference: dietaryPref,
            food_type: store?.food_type || undefined,
            cuisine_tags: store?.tags ? store.tags.join(", ") : undefined,
            has_customizations: hasCustomizations,
            has_variants: true,
            customizations: customizations,
            attribute_options: variantAttributeOptions,
            variants: variants,
            is_favorite: favoriteItemIds.has(baseItem.id),
          };

          // NEW: Enrich with preorder info
          await this.enrichItemWithPreorderInfo(variantRestaurantItem, restaurantId);

          processedItems.push(variantRestaurantItem);
        }

        // Sort items by rating (highest first)
        processedItems.sort((a, b) => b.rating - a.rating);

        if (processedItems.length > 0) {
          processedCategories.push({
            id: category.id,
            name: category.name,
            description: category.description || "",
            icon: category.icon || "",
            items: processedItems,
            item_count: processedItems.length,
          });
        }
      }

      this.logger.log(
        `✅ Found ${processedCategories.length} categories with items`,
      );
      return processedCategories;
    } catch (error) {
      this.logger.error(
        `❌ Error getting categorized items: ${error.message}`,
        error.stack,
      );
      return []; // Return empty array on error to not break the main response
    }
  }
}
