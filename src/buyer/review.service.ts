import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantReview } from '../review/entities/restaurant-review.entity';
import { ItemReview } from '../review/entities/item-review.entity';
import { User } from '../user/entities/user.entity';
import { Store } from '../store/entities/store.entity';
import { Item } from '../item/entities/item.entity';
import { Order } from '../order/entities/order.entity';


export interface UpdateReviewDto {
  rating?: number;
  title?: string;
  comment?: string;
  food_quality?: number;
  delivery_time?: number;
  packaging?: number;
  value_for_money?: number;
  taste?: number;
  portion_size?: number;
}

export interface CreateUnifiedReviewDto {
  order_id: number;
  overall_rating: number;
  restaurant_rating?: number;
  restaurant_comment?: string;
  delivery_partner_rating?: number;
  food_ratings?: Array<{
    item_id: number;
    rating: number;
    comment?: string;
  }>;
  photos?: Array<{
    url: string;
    type: 'photo' | 'video';
  }>;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(RestaurantReview)
    private readonly restaurantReviewRepository: Repository<RestaurantReview>,
    @InjectRepository(ItemReview)
    private readonly itemReviewRepository: Repository<ItemReview>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}



  /**
   * Create unified review for complete order rating
   */
  async createUnifiedReview(
    userId: number,
    createReviewDto: CreateUnifiedReviewDto
  ) {
    try {
      this.logger.log(`Creating unified review for order ${createReviewDto.order_id}`);

      // Validate order belongs to user and is delivered
      const order = await this.orderRepository.findOne({
        where: { id: createReviewDto.order_id, user: { id: userId } },
        relations: ['store', 'order_items', 'order_items.item'],
      });

      if (!order) {
        throw new Error('Order not found or does not belong to user');
      }

      if (order.status !== 'delivered') {
        throw new Error('Can only review delivered orders');
      }

      // Check if any review already exists for this order
      const existingRestaurantReview = await this.restaurantReviewRepository.findOne({
        where: { user: { id: userId }, order: { id: createReviewDto.order_id } },
      });

      if (existingRestaurantReview) {
        throw new Error('Review already exists for this order');
      }

      const result = {
        review_id: null as number | null,
        order_id: createReviewDto.order_id,
        overall_rating: createReviewDto.overall_rating,
        restaurant_review_id: null as number | null,
        item_review_ids: [] as number[],
        delivery_rating: createReviewDto.delivery_partner_rating || null,
      };

      // Create restaurant review if rating provided
      if (createReviewDto.restaurant_rating) {
        const restaurantReview = this.restaurantReviewRepository.create({
          user: { id: userId },
          store: { id: order.store.id },
          order: { id: createReviewDto.order_id },
          rating: createReviewDto.restaurant_rating,
          title: createReviewDto.restaurant_comment ? createReviewDto.restaurant_comment.substring(0, 100) : undefined,
          comment: createReviewDto.restaurant_comment,
          food_quality: createReviewDto.restaurant_rating, // Use same rating as default
          delivery_time: createReviewDto.delivery_partner_rating || createReviewDto.restaurant_rating,
          packaging: createReviewDto.restaurant_rating,
          value_for_money: createReviewDto.restaurant_rating,
          is_verified: true,
        });

        const savedRestaurantReview = await this.restaurantReviewRepository.save(restaurantReview);
        result.restaurant_review_id = savedRestaurantReview.id;
        this.logger.log(`Created restaurant review: ${savedRestaurantReview.id}`);
      }

      // Create item reviews if provided
      if (createReviewDto.food_ratings && createReviewDto.food_ratings.length > 0) {
        for (const foodRating of createReviewDto.food_ratings) {
          // Validate item exists in the order
          const orderItem = order.order_items.find(oi => oi.item.id === foodRating.item_id);
          if (!orderItem) {
            this.logger.warn(`Item ${foodRating.item_id} not found in order ${createReviewDto.order_id}`);
            continue;
          }

          // Check if review already exists for this item
          const existingItemReview = await this.itemReviewRepository.findOne({
            where: { user: { id: userId }, order: { id: createReviewDto.order_id }, item: { id: foodRating.item_id } },
          });

          if (existingItemReview) {
            this.logger.warn(`Review already exists for item ${foodRating.item_id} in order ${createReviewDto.order_id}`);
            continue;
          }

          const itemReview = this.itemReviewRepository.create({
            user: { id: userId },
            item: { id: foodRating.item_id },
            order: { id: createReviewDto.order_id },
            rating: foodRating.rating,
            title: foodRating.comment ? foodRating.comment.substring(0, 100) : undefined,
            comment: foodRating.comment,
            taste: foodRating.rating, // Use same rating as default
            portion_size: foodRating.rating,
            value_for_money: foodRating.rating,
            is_verified: true,
          });

          const savedItemReview = await this.itemReviewRepository.save(itemReview);
          result.item_review_ids.push(savedItemReview.id);
          this.logger.log(`Created item review: ${savedItemReview.id} for item ${foodRating.item_id}`);
        }
      }

      // Store photos if provided (you might want to create a separate table for this)
      if (createReviewDto.photos && createReviewDto.photos.length > 0) {
        this.logger.log(`Received ${createReviewDto.photos.length} photos for review`);
        // TODO: Implement photo storage logic
        // You might want to create a ReviewPhotos table to store these
      }

      this.logger.log(`Unified review created successfully for order ${createReviewDto.order_id}`);
      return {
        success: true,
        message: 'Review submitted successfully',
        data: result
      };

    } catch (error) {
      this.logger.error(`Failed to create unified review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get restaurant reviews
   */
  async getRestaurantReviews(
    restaurantId: number,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) {
    try {
      const queryBuilder = this.restaurantReviewRepository
        .createQueryBuilder('review')
        .leftJoinAndSelect('review.user', 'user')
        .leftJoinAndSelect('review.store', 'store')
        .where('review.store.id = :restaurantId', { restaurantId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .orderBy(`review.${sortBy}`, sortOrder);

      const [reviews, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      // Calculate average rating
      const avgRating = await this.restaurantReviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avgRating')
        .where('review.store.id = :restaurantId', { restaurantId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .getRawOne();

      return {
        reviews: reviews.map(review => this.formatRestaurantReview(review)),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        average_rating: parseFloat(avgRating.avgRating) || 0,
        total_reviews: total,
      };
    } catch (error) {
      this.logger.error(`Failed to get restaurant reviews: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get item reviews
   */
  async getItemReviews(
    itemId: number,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) {
    try {
      const queryBuilder = this.itemReviewRepository
        .createQueryBuilder('review')
        .leftJoinAndSelect('review.user', 'user')
        .where('review.item.id = :itemId', { itemId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .orderBy(`review.${sortBy}`, sortOrder);

      const [reviews, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      // Calculate average rating
      const avgRating = await this.itemReviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avgRating')
        .where('review.item.id = :itemId', { itemId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .getRawOne();

      return {
        reviews: reviews.map(review => this.formatItemReview(review)),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        average_rating: parseFloat(avgRating.avgRating) || 0,
        total_reviews: total,
      };
    } catch (error) {
      this.logger.error(`Failed to get item reviews: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user reviews
   */
  async getUserReviews(
    userId: number,
    page: number = 1,
    limit: number = 20,
    type?: 'restaurant' | 'item'
  ) {
    try {
      let reviews: any[] = [];
      let total = 0;

      if (!type || type === 'restaurant') {
        const restaurantQueryBuilder = this.restaurantReviewRepository
          .createQueryBuilder('review')
          .leftJoinAndSelect('review.store', 'store')
          .where('review.user.id = :userId', { userId })
          .orderBy('review.created_at', 'DESC');

        const [restaurantReviews, restaurantTotal] = await restaurantQueryBuilder
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount();

        reviews = [...reviews, ...restaurantReviews.map(review => ({
          ...this.formatRestaurantReview(review),
          review_type: 'restaurant'
        }))];
        total += restaurantTotal;
      }

      if (!type || type === 'item') {
        const itemQueryBuilder = this.itemReviewRepository
          .createQueryBuilder('review')
          .leftJoinAndSelect('review.item', 'item')
          .where('review.user.id = :userId', { userId })
          .orderBy('review.created_at', 'DESC');

        const [itemReviews, itemTotal] = await itemQueryBuilder
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount();

        reviews = [...reviews, ...itemReviews.map(review => ({
          ...this.formatItemReview(review),
          review_type: 'item'
        }))];
        total += itemTotal;
      }

      // Sort combined reviews by created_at
      reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const totalPages = Math.ceil(total / limit);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user reviews: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update restaurant review
   */
  async updateRestaurantReview(
    reviewId: number,
    userId: number,
    updateReviewDto: UpdateReviewDto
  ): Promise<RestaurantReview> {
    try {
      const review = await this.restaurantReviewRepository.findOne({
        where: { id: reviewId, user: { id: userId } },
      });

      if (!review) {
        throw new Error('Review not found or does not belong to user');
      }

      // Update fields
      if (updateReviewDto.rating !== undefined) {
        if (updateReviewDto.rating < 1 || updateReviewDto.rating > 5) {
          throw new Error('Rating must be between 1 and 5');
        }
        review.rating = updateReviewDto.rating;
      }

      if (updateReviewDto.title !== undefined) {
        review.title = updateReviewDto.title;
      }

      if (updateReviewDto.comment !== undefined) {
        review.comment = updateReviewDto.comment;
      }

      if (updateReviewDto.food_quality !== undefined) {
        review.food_quality = updateReviewDto.food_quality;
      }

      if (updateReviewDto.delivery_time !== undefined) {
        review.delivery_time = updateReviewDto.delivery_time;
      }

      if (updateReviewDto.packaging !== undefined) {
        review.packaging = updateReviewDto.packaging;
      }

      if (updateReviewDto.value_for_money !== undefined) {
        review.value_for_money = updateReviewDto.value_for_money;
      }

      const updatedReview = await this.restaurantReviewRepository.save(review);
      
      this.logger.log(`Restaurant review ${reviewId} updated by user ${userId}`);
      
      // Update restaurant average rating
      await this.updateRestaurantRating(review.store.id);
      
      return updatedReview;
    } catch (error) {
      this.logger.error(`Failed to update restaurant review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update item review
   */
  async updateItemReview(
    reviewId: number,
    userId: number,
    updateReviewDto: UpdateReviewDto
  ): Promise<ItemReview> {
    try {
      const review = await this.itemReviewRepository.findOne({
        where: { id: reviewId, user: { id: userId } },
      });

      if (!review) {
        throw new Error('Review not found or does not belong to user');
      }

      // Update fields
      if (updateReviewDto.rating !== undefined) {
        if (updateReviewDto.rating < 1 || updateReviewDto.rating > 5) {
          throw new Error('Rating must be between 1 and 5');
        }
        review.rating = updateReviewDto.rating;
      }

      if (updateReviewDto.title !== undefined) {
        review.title = updateReviewDto.title;
      }

      if (updateReviewDto.comment !== undefined) {
        review.comment = updateReviewDto.comment;
      }

      if (updateReviewDto.taste !== undefined) {
        review.taste = updateReviewDto.taste;
      }

      if (updateReviewDto.portion_size !== undefined) {
        review.portion_size = updateReviewDto.portion_size;
      }

      if (updateReviewDto.value_for_money !== undefined) {
        review.value_for_money = updateReviewDto.value_for_money;
      }

      const updatedReview = await this.itemReviewRepository.save(review);
      
      this.logger.log(`Item review ${reviewId} updated by user ${userId}`);
      
      // Update item average rating
      await this.updateItemRating(review.item.id);
      
      return updatedReview;
    } catch (error) {
      this.logger.error(`Failed to update item review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete restaurant review
   */
  async deleteRestaurantReview(reviewId: number, userId: number): Promise<void> {
    try {
      const review = await this.restaurantReviewRepository.findOne({
        where: { id: reviewId, user: { id: userId } },
      });

      if (!review) {
        throw new Error('Review not found or does not belong to user');
      }

      await this.restaurantReviewRepository.remove(review);
      
      this.logger.log(`Restaurant review ${reviewId} deleted by user ${userId}`);
      
      // Update restaurant average rating
      await this.updateRestaurantRating(review.store.id);
    } catch (error) {
      this.logger.error(`Failed to delete restaurant review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete item review
   */
  async deleteItemReview(reviewId: number, userId: number): Promise<void> {
    try {
      const review = await this.itemReviewRepository.findOne({
        where: { id: reviewId, user: { id: userId } },
      });

      if (!review) {
        throw new Error('Review not found or does not belong to user');
      }

      await this.itemReviewRepository.remove(review);
      
      this.logger.log(`Item review ${reviewId} deleted by user ${userId}`);
      
      // Update item average rating
      await this.updateItemRating(review.item.id);
    } catch (error) {
      this.logger.error(`Failed to delete item review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update restaurant average rating
   */
  private async updateRestaurantRating(restaurantId: number): Promise<void> {
    try {
      const avgRating = await this.restaurantReviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avgRating')
        .where('review.store.id = :restaurantId', { restaurantId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .getRawOne();

      // TODO: Update restaurant entity with average rating
      this.logger.log(`Restaurant ${restaurantId} average rating updated: ${avgRating.avgRating}`);
    } catch (error) {
      this.logger.error(`Failed to update restaurant rating: ${error.message}`, error.stack);
    }
  }

  /**
   * Update item average rating
   */
  private async updateItemRating(itemId: number): Promise<void> {
    try {
      const avgRating = await this.itemReviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avgRating')
        .where('review.item.id = :itemId', { itemId })
        .andWhere('review.is_verified = :isVerified', { isVerified: true })
        .getRawOne();

      // TODO: Update item entity with average rating
      this.logger.log(`Item ${itemId} average rating updated: ${avgRating.avgRating}`);
    } catch (error) {
      this.logger.error(`Failed to update item rating: ${error.message}`, error.stack);
    }
  }

  /**
   * Format restaurant review for API response
   */
  private formatRestaurantReview(review: RestaurantReview) {
    return {
      id: review.id,
      user: {
        id: review.user?.id,
        name: review.user?.name || 'Anonymous',
        avatar: null, // Avatar field not available in User entity
      },
      restaurant_id: review.store.id,
      order_id: review.order.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      food_quality: review.food_quality,
      delivery_time: review.delivery_time,
      packaging: review.packaging,
      value_for_money: review.value_for_money,
      is_verified: review.is_verified,
      created_at: review.created_at.toISOString(),
      updated_at: review.updated_at.toISOString(),
    };
  }

  /**
   * Format item review for API response
   */
  private formatItemReview(review: ItemReview) {
    return {
      id: review.id,
      user: {
        id: review.user?.id,
        name: review.user?.name || 'Anonymous',
        avatar: null, // Avatar field not available in User entity
      },
      item_id: review.item.id,
      order_id: review.order.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      taste: review.taste,
      portion_size: review.portion_size,
      value_for_money: review.value_for_money,
      is_verified: review.is_verified,
      created_at: review.created_at.toISOString(),
      updated_at: review.updated_at.toISOString(),
    };
  }
}
