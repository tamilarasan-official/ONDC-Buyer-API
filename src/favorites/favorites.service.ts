import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavoriteItem } from './entities/user-favorite-item.entity';
import { UserFavoriteRestaurant } from './entities/user-favorite-restaurant.entity';
import { Item } from '../item/entities/item.entity';
import { Store } from '../store/entities/store.entity';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(UserFavoriteItem)
    private readonly favoriteItemRepository: Repository<UserFavoriteItem>,

    @InjectRepository(UserFavoriteRestaurant)
    private readonly favoriteRestaurantRepository: Repository<UserFavoriteRestaurant>,

    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,

    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  // ==================== ITEMS ====================

  /**
   * Toggle item favorite (add if not exists, remove if exists)
   */
  async toggleFavoriteItem(userId: number, itemId: number) {
    try {
      // Check if item exists
      const item = await this.itemRepository.findOne({ where: { id: itemId } });
      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // Check if already favorited
      const existingFavorite = await this.favoriteItemRepository.findOne({
        where: { user: { id: userId }, item: { id: itemId } },
      });

      if (existingFavorite) {
        // Remove from favorites
        await this.favoriteItemRepository.remove(existingFavorite);

        return {
          success: true,
          action: 'removed',
          message: 'Item removed from favorites',
          data: {
            is_favorite: false,
            favorited_at: null,
          },
        };
      } else {
        // Add to favorites
        const favorite = this.favoriteItemRepository.create({
          user: { id: userId },
          item: { id: itemId },
        });
        await this.favoriteItemRepository.save(favorite);

        return {
          success: true,
          action: 'added',
          message: 'Item added to favorites',
          data: {
            is_favorite: true,
            favorited_at: favorite.created_at,
          },
        };
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error toggling favorite item: ${error.message}`);
      throw new BadRequestException('Failed to toggle favorite item');
    }
  }

  /**
   * Get all favorite items for a user
   */
  async getFavoriteItems(userId: number, userLat?: number, userLng?: number) {
    try {
      const favorites = await this.favoriteItemRepository.find({
        where: { user: { id: userId } },
        relations: ['item', 'item.store', 'item.prices', 'item.quantities', 'item.item_categories'],
        order: { created_at: 'DESC' },
      });

      const items = await Promise.all(
        favorites.map(async (favorite) => {
          const item = favorite.item;

          // Get item price
          const price = item.prices?.[0]?.value || 0;

          // Get item images
          const images = item.images ? JSON.parse(item.images as any) : [];

          // Get item rating (you may need to join with item_review table)
          const rating = 0; // TODO: Calculate from reviews

          // Get availability
          const is_available = item.status && (item.quantities?.[0]?.available?.count || 0) > 0;

          return {
            id: item.id,
            name: item.name,
            description: item.description,
            images,
            price,
            restaurant: {
              id: item.store.id,
              name: item.store.name,
              logo_url: item.store.logo_url,
            },
            rating,
            is_available,
            favorited_at: favorite.created_at,
            is_favorite: true,
          };
        })
      );

      return {
        success: true,
        message: 'Favorite items retrieved successfully',
        data: items,
      };
    } catch (error) {
      this.logger.error(`Error getting favorite items: ${error.message}`);
      throw new BadRequestException('Failed to get favorite items');
    }
  }

  /**
   * Check if item is favorited by user
   */
  async checkItemFavorite(userId: number, itemId: number) {
    try {
      const favorite = await this.favoriteItemRepository.findOne({
        where: { user: { id: userId }, item: { id: itemId } },
      });

      return {
        success: true,
        data: {
          is_favorite: !!favorite,
          favorited_at: favorite?.created_at || null,
        },
      };
    } catch (error) {
      this.logger.error(`Error checking item favorite: ${error.message}`);
      throw new BadRequestException('Failed to check item favorite status');
    }
  }

  // ==================== RESTAURANTS ====================

  /**
   * Toggle restaurant favorite (add if not exists, remove if exists)
   */
  async toggleFavoriteRestaurant(userId: number, storeId: number) {
    try {
      // Check if restaurant exists
      const store = await this.storeRepository.findOne({ where: { id: storeId } });
      if (!store) {
        throw new NotFoundException('Restaurant not found');
      }

      // Check if already favorited
      const existingFavorite = await this.favoriteRestaurantRepository.findOne({
        where: { user: { id: userId }, store: { id: storeId } },
      });

      if (existingFavorite) {
        // Remove from favorites
        await this.favoriteRestaurantRepository.remove(existingFavorite);

        return {
          success: true,
          action: 'removed',
          message: 'Restaurant removed from favorites',
          data: {
            is_favorite: false,
            favorited_at: null,
          },
        };
      } else {
        // Add to favorites
        const favorite = this.favoriteRestaurantRepository.create({
          user: { id: userId },
          store: { id: storeId },
        });
        await this.favoriteRestaurantRepository.save(favorite);

        return {
          success: true,
          action: 'added',
          message: 'Restaurant added to favorites',
          data: {
            is_favorite: true,
            favorited_at: favorite.created_at,
          },
        };
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error toggling favorite restaurant: ${error.message}`);
      throw new BadRequestException('Failed to toggle favorite restaurant');
    }
  }

  /**
   * Get all favorite restaurants for a user
   */
  async getFavoriteRestaurants(userId: number, userLat?: number, userLng?: number) {
    try {
      const favorites = await this.favoriteRestaurantRepository.find({
        where: { user: { id: userId } },
        relations: ['store', 'store.locations', 'store.timings'],
        order: { created_at: 'DESC' },
      });

      const restaurants = favorites.map((favorite) => {
        const store = favorite.store;
        const location = store.locations?.[0];

        // Calculate distance if user location provided
        let distance = 0;
        if (userLat && userLng && location) {
          distance = this.calculateDistance(userLat, userLng, location.gps_lat, location.gps_lng);
        }

        // Check if store is open (simplified - you may have more complex logic)
        const is_open = true; // TODO: Implement actual open/close logic based on timings

        // Calculate delivery time based on distance
        const delivery_time = this.calculateDeliveryTime(distance);

        return {
          id: store.id,
          name: store.name,
          description: store.description,
          logo_url: store.logo_url,
          fssai_license: store.fssai_license_no,
          location: location ? {
            lat: location.gps_lat,
            lng: location.gps_lng,
            city: location.address_city,
            locality: location.address_locality,
          } : null,
          distance: Math.round(distance * 100) / 100,
          rating: 0, // TODO: Calculate from reviews
          delivery_time,
          is_open,
          offers_count: 0, // TODO: Count from offers table
          items_count: 0, // TODO: Count from items table
          favorited_at: favorite.created_at,
          is_favorite: true,
        };
      });

      return {
        success: true,
        message: 'Favorite restaurants retrieved successfully',
        data: restaurants,
      };
    } catch (error) {
      this.logger.error(`Error getting favorite restaurants: ${error.message}`);
      throw new BadRequestException('Failed to get favorite restaurants');
    }
  }

  /**
   * Check if restaurant is favorited by user
   */
  async checkRestaurantFavorite(userId: number, storeId: number) {
    try {
      const favorite = await this.favoriteRestaurantRepository.findOne({
        where: { user: { id: userId }, store: { id: storeId } },
      });

      return {
        success: true,
        data: {
          is_favorite: !!favorite,
          favorited_at: favorite?.created_at || null,
        },
      };
    } catch (error) {
      this.logger.error(`Error checking restaurant favorite: ${error.message}`);
      throw new BadRequestException('Failed to check restaurant favorite status');
    }
  }

  // ==================== COMBINED ====================

  /**
   * Get all favorites (items + restaurants)
   */
  async getAllFavorites(userId: number, userLat?: number, userLng?: number) {
    try {
      const [itemsResponse, restaurantsResponse] = await Promise.all([
        this.getFavoriteItems(userId, userLat, userLng),
        this.getFavoriteRestaurants(userId, userLat, userLng),
      ]);

      return {
        success: true,
        message: 'All favorites retrieved successfully',
        data: {
          restaurants: restaurantsResponse.data,
          items: itemsResponse.data,
          summary: {
            total_favorites: restaurantsResponse.data.length + itemsResponse.data.length,
            favorite_restaurants: restaurantsResponse.data.length,
            favorite_items: itemsResponse.data.length,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Error getting all favorites: ${error.message}`);
      throw new BadRequestException('Failed to get all favorites');
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate delivery time based on distance
   */
  private calculateDeliveryTime(distance: number): string {
    if (distance < 2) return '15-20 mins';
    if (distance < 5) return '25-30 mins';
    if (distance < 10) return '35-40 mins';
    return '45-60 mins';
  }
}
