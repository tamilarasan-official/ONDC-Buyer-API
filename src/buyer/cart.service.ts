import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cart } from "../cart/entities/cart.entity";
import { CartItem } from "../cart/entities/cart-item.entity";
import { Item } from "../item/entities/item.entity";
import { ItemCustomizationGroups } from "../item/entities/item-customization-groups.entity";
import { CustomizationRelationships } from "../item/entities/customization-relationships.entity";
import { Store } from "../store/entities/store.entity";
import { User } from "../user/entities/user.entity";
import { Offers } from "../offer/entities/offers.entity";
import {
  AddToCartDto,
  UpdateCartItemDto,
  RemoveFromCartDto,
  ApplyOfferDto,
} from "./dto/cart-request.dto";
import { BuyerService } from "./buyer.service";
import { LocationService } from "../shared/services/location.service";
import { DeliveryPricingService } from "../shared/services/delivery-pricing.service";
import { DietaryPreference } from "../shared/enums/dietary-preference.enum";
import { CouponService } from "../coupon/services/coupon.service";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { Coupon } from "../coupon/entities/coupon.entity";
import { CouponType, CouponStatus } from "../coupon/entities/coupon.entity";
import { ApplyCouponDto } from "./dto/apply-coupon.dto";
import { ConfigService } from "@nestjs/config";
import { AppOperationHoursService } from "../shared/services/app-operation-hours.service";

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  // Maximum tip amount constant (fixed amount in INR)
  private readonly MAX_TIP_AMOUNT = 450.0;

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(ItemCustomizationGroups)
    private readonly itemCustomizationGroupsRepository: Repository<ItemCustomizationGroups>,
    @InjectRepository(CustomizationRelationships)
    private readonly customizationRelationshipsRepository: Repository<CustomizationRelationships>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Offers)
    private readonly offersRepository: Repository<Offers>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @Inject(forwardRef(() => BuyerService))
    private readonly buyerService: BuyerService,
    private readonly locationService: LocationService,
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly couponService: CouponService,
    private readonly redisCouponService: RedisCouponService,
    private readonly configService: ConfigService,
    private readonly appOperationHoursService: AppOperationHoursService,
  ) { }

  /**
   * Get user's active cart
   */
  async getCart(userId: number) {
    try {
      this.logger.log(`🛒 Getting cart for user ID: ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("s.locations", "sl")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoinAndSelect("i.attributes", "ia")
        .leftJoinAndSelect("i.quantities", "iq")
        .leftJoinAndSelect("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .orderBy("ci.created_at", "ASC")
        .getOne();

      if (!cart) {
        // Get platform fee configuration for empty cart
        const platformFeeConfig = this.getPlatformFee();

        return {
          success: true,
          message: "Cart is empty",
          data: {
            id: null,
            restaurant_id: null,
            restaurant_name: null,
            restaurant_logo: null,
            items: [],
            summary: {
              subtotal: 0,
              delivery_fee: 0,
              tax_amount: 0,
              discount_amount: 0,
              tip_amount: 0,
              max_tip_amount: this.MAX_TIP_AMOUNT,
              platform_fee: platformFeeConfig.amount,
              include_platform_fee: platformFeeConfig.isEnabled,
              final_amount: 0,
              estimated_delivery_time: null,
            },
            total_items: 0,
            is_active: false,
            created_at: null,
            updated_at: null,
          },
        };
      }

      const cartData = await this.formatCartData(cart);
      return {
        success: true,
        message: "Cart retrieved successfully",
        data: cartData,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting cart: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add item to cart
   */
  async addToCart(userId: number, addToCartDto: AddToCartDto) {
    try {
      this.logger.log(
        `➕ Adding item ${addToCartDto.item_id} to cart for user ${userId}`,
      );

      // Get item details
      const item = await this.itemRepository
        .createQueryBuilder("i")
        .leftJoinAndSelect("i.store", "s")
        .leftJoinAndSelect("i.prices", "p")
        .leftJoinAndSelect("i.quantities", "q")
        .where("i.id = :itemId", { itemId: addToCartDto.item_id })
        .andWhere("i.storeId = :restaurantId", {
          restaurantId: addToCartDto.restaurant_id,
        })
        .andWhere("i.status = :status", { status: true })
        .getOne();

      if (!item) {
        throw new NotFoundException(
          "Item not found in the specified restaurant",
        );
      }

      // NEW: Validate app operation hours before allowing cart operations
      // This is separate from restaurant timings - it's a global app-level control
      this.appOperationHoursService.validateAppIsOpen();

      // if (
      //   !item.quantities?.[0] ||
      //   item.quantities[0].available_count < addToCartDto.quantity
      // ) {
      //   throw new BadRequestException("Insufficient quantity available");
      // }

      const stock = item.quantities?.[0];

      if (!stock) {
        throw new BadRequestException("Item has no stock configuration");
      }

      // Check available stock limit
      if (stock.available_count < addToCartDto.quantity) {
        throw new BadRequestException(
          `Only ${stock.available_count} units available`
        );
      }

      // Check maximum_count (per-customer limit)
      if (stock.maximum_count < addToCartDto.quantity) {
        throw new BadRequestException(
          `You can only purchase up to ${stock.maximum_count} units of this item`
        );
      }

      // Validate customizations if provided
      if (
        addToCartDto.customizations &&
        addToCartDto.customizations.length > 0
      ) {
        await this.validateCustomizations(
          addToCartDto.item_id,
          addToCartDto.customizations,
        );
      }

      // Get or create active cart
      let cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      // Check if adding item from different restaurant
      if (cart && cart.store.id !== addToCartDto.restaurant_id) {
        throw new BadRequestException(
          "Cannot add items from different restaurants. Please clear your cart first.",
        );
      }

      // NEW: Validate cart restrictions (preorder vs regular items)
      if (cart && cart.cart_items && cart.cart_items.length > 0) {
        const hasPreorderItems = cart.cart_items.some(ci => ci.is_preorder);
        const isAddingPreorder = addToCartDto.is_preorder === true;

        // Prevent mixing preorder and regular items
        if (hasPreorderItems && !isAddingPreorder) {
          throw new BadRequestException(
            "Cannot add regular items to cart with preorder items. Please clear your cart first."
          );
        }

        if (!hasPreorderItems && isAddingPreorder) {
          throw new BadRequestException(
            "Cannot add preorder items to cart with regular items. Please clear your cart first."
          );
        }

        // Prevent multiple preorder items (only one preorder item allowed per cart)
        if (hasPreorderItems && isAddingPreorder) {
          throw new BadRequestException(
            "Only one preorder item is allowed per cart. Please remove existing preorder item first."
          );
        }
      }

      if (!cart) {
        cart = await this.createCart(userId, addToCartDto.restaurant_id);
      }

      // Check if item already exists in cart
      const existingCartItem = await this.cartItemRepository
        .createQueryBuilder("ci")
        .where("ci.cart = :cartId", { cartId: cart.id })
        .andWhere("ci.item = :itemId", { itemId: addToCartDto.item_id })
        .andWhere("ci.customizations::text = :customizations", {
          customizations: JSON.stringify(addToCartDto.customizations || []),
        })
        .andWhere("ci.variants::text = :variants", {
          variants: JSON.stringify(addToCartDto.variants || []),
        })
        .getOne();

      let cartItem: CartItem;
      const unitPrice = Number(item.prices?.[0]?.base_price || 0);

      // Calculate customization prices (added only once, not per quantity)
      let customizationPrice = 0;
      if (
        addToCartDto.customizations &&
        addToCartDto.customizations.length > 0
      ) {
        for (const customization of addToCartDto.customizations) {
          if (
            customization.selected_options &&
            customization.selected_options.length > 0
          ) {
            // Get customization item prices
            const customizationItems = await this.itemRepository
              .createQueryBuilder("item")
              .leftJoin("item.prices", "price")
              .where("item.id IN (:...optionIds)", {
                optionIds: customization.selected_options,
              })
              .andWhere("item.type = :type", { type: "customization" })
              .select(["item.id", "price.base_price"])
              .getMany();

            for (const customItem of customizationItems) {
              customizationPrice += Number(
                customItem.prices?.[0]?.base_price || 0,
              );
            }
          }
        }
      }

      // CORRECT CALCULATION: (Item Price × Quantity) + Customization Price
      const itemTotalPrice = Number(
        (unitPrice * addToCartDto.quantity).toFixed(2),
      );
      const totalPrice = Number(
        (itemTotalPrice + customizationPrice).toFixed(2),
      );

      // NEW: Preorder validation and auto-apply coupon
      // Calculate this AFTER we know the item price, so we can pass correct cart_total
      let preorderCoupon: Coupon | null = null;
      if (addToCartDto.is_preorder) {
        this.logger.log(
          `🛒 Preorder item detected: item_id=${addToCartDto.item_id}, validating and auto-applying coupon...`,
        );
        
        // Validate preorder requirements
        preorderCoupon = await this.validatePreorderItem(
          addToCartDto.item_id,
          addToCartDto.campaign_id,
          userId,
          addToCartDto.quantity,
          addToCartDto.restaurant_id,
        );

        this.logger.log(
          `✅ Preorder validation passed: coupon_id=${preorderCoupon.id}, code=${preorderCoupon.code}`,
        );

        // Auto-apply preorder coupon to cart
        // IMPORTANT: Calculate cart total including the new item price for validation
        if (preorderCoupon && cart) {
          // Get existing cart items subtotal
          const existingCartItems = await this.cartItemRepository.find({
            where: { cart: { id: cart.id } },
          });
          const existingSubtotal = existingCartItems.reduce(
            (sum, item) => sum + Number(item.total_price || 0),
            0,
          );
          
          // Proposed cart total = existing items + new item
          const proposedCartTotal = existingSubtotal + totalPrice;

          this.logger.log(
            `💰 Auto-applying preorder coupon: code=${preorderCoupon.code}, proposed_cart_total=₹${proposedCartTotal}`,
          );

          // Check if cart already has a coupon
          if (cart.coupon_id && cart.coupon_id !== preorderCoupon.id) {
            // If cart has different coupon, remove it (preorder takes priority)
            this.logger.log(
              `🔄 Removing existing coupon (id=${cart.coupon_id}) to apply preorder coupon`,
            );
            await this.removeCoupon(userId);
          }

          // Apply preorder coupon with correct cart total
          await this.applyCouponWithCartTotal(
            userId,
            { coupon_code: preorderCoupon.code },
            proposedCartTotal,
          );

          this.logger.log(
            `✅ Preorder coupon auto-applied successfully: code=${preorderCoupon.code}`,
          );
        } else if (!preorderCoupon) {
          this.logger.warn(
            `⚠️ Preorder item added but no valid coupon found for item_id=${addToCartDto.item_id}`,
          );
        } else if (!cart) {
          this.logger.warn(
            `⚠️ Preorder item added but cart not found for user_id=${userId}`,
          );
        }
      }

      // if (existingCartItem) {
      //   // Update existing item quantity
      //   existingCartItem.quantity += addToCartDto.quantity;
      //   // Recalculate total price with new quantity
      //   const newItemTotalPrice = Number(
      //     (unitPrice * existingCartItem.quantity).toFixed(2),
      //   );
      //   existingCartItem.total_price = Number(
      //     (newItemTotalPrice + customizationPrice).toFixed(2),
      //   );
      //   cartItem = await this.cartItemRepository.save(existingCartItem);
      // } 
      if (existingCartItem) {
        // NEW: Validate preorder status matches
        if (existingCartItem.is_preorder !== (addToCartDto.is_preorder === true)) {
          throw new BadRequestException(
            "Cannot change item type. If this is a preorder item, it must remain a preorder item, and vice versa."
          );
        }

        // NEW: Prevent quantity changes for preorder items
        if (existingCartItem.is_preorder) {
          throw new BadRequestException(
            "Preorder items cannot have quantity increased. Only one preorder item is allowed per cart."
          );
        }

        const newTotalQty = existingCartItem.quantity + addToCartDto.quantity;

        // Validate stock limits again after adding
        if (newTotalQty > stock.available_count) {
          throw new BadRequestException(
            `Only ${stock.available_count} units available`
          );
        }

        if (newTotalQty > stock.maximum_count) {
          throw new BadRequestException(
            `You can only purchase up to ${stock.maximum_count} units of this item`
          );
        }

        existingCartItem.quantity = newTotalQty;

        const newItemTotalPrice = Number(
          (unitPrice * newTotalQty).toFixed(2)
        );

        existingCartItem.total_price = Number(
          (newItemTotalPrice + customizationPrice).toFixed(2)
        );

        cartItem = await this.cartItemRepository.save(existingCartItem);
      } else {
        // Create new cart item
        cartItem = this.cartItemRepository.create({
          cart,
          item,
          quantity: addToCartDto.quantity,
          unit_price: unitPrice, // Store base unit price only
          total_price: totalPrice,
          customizations: addToCartDto.customizations || [],
          variants: addToCartDto.variants || [],
          special_instructions: addToCartDto.special_instructions,
          is_preorder: addToCartDto.is_preorder || false, // NEW
          preorder_campaign_id: preorderCoupon?.id, // NEW
        });
        cartItem = await this.cartItemRepository.save(cartItem);
      }

      // Update cart totals
      await this.updateCartTotals(cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cart.id },
        relations: ["store", "cart_items", "cart_items.item"],
      });

      const cartSummary = updatedCart
        ? await this.calculateCartSummary(updatedCart)
        : {
          subtotal: 0,
          delivery_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          tip_amount: 0,
          max_tip_amount: null,
          final_amount: 0,
          estimated_delivery_time: null,
        };

      return {
        success: true,
        message: "Item added to cart successfully",
        cart_item_id: cartItem.id,
        cart_summary: cartSummary,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error adding to cart: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate preorder item before adding to cart
   * Returns the coupon if valid
   */
  private async validatePreorderItem(
    itemId: number,
    campaignId: number | undefined,
    userId: number,
    quantity: number,
    storeId: number,
  ): Promise<Coupon> {
    // Quantity must be 1 for preorders
    if (quantity !== 1) {
      throw new BadRequestException(
        "Preorder items can only be added with quantity 1",
      );
    }

    // Ensure campaignId is a number if provided
    const numericCampaignId = campaignId ? Number(campaignId) : undefined;
    if (campaignId && (isNaN(numericCampaignId!) || numericCampaignId! <= 0)) {
      throw new BadRequestException("Invalid campaign_id provided");
    }

    this.logger.log(
      `🔍 Validating preorder item: item_id=${itemId}, campaign_id=${numericCampaignId}, store_id=${storeId}, user_id=${userId}`,
    );

    // Find active PREORDER coupon for this item
    const queryBuilder = this.couponRepository
      .createQueryBuilder("coupon")
      .leftJoinAndSelect("coupon.campaign", "campaign")
      .where("coupon.type = :type", { type: CouponType.PREORDER })
      .andWhere("coupon.status = :status", { status: CouponStatus.ACTIVE })
      .andWhere("coupon.type_meta->>'item_id' = :itemId", { itemId: itemId.toString() })
      .andWhere(
        "(coupon.applicable_store_ids IS NULL OR array_length(coupon.applicable_store_ids, 1) IS NULL OR :storeId = ANY(coupon.applicable_store_ids))",
        { storeId }
      );

    if (numericCampaignId) {
      queryBuilder.andWhere("coupon.campaign_id = :campaignId", { campaignId: numericCampaignId });
    }

    const coupon = await queryBuilder.getOne();

    if (!coupon) {
      this.logger.error(
        `❌ No preorder coupon found: item_id=${itemId}, campaign_id=${numericCampaignId}, store_id=${storeId}`,
      );
      throw new BadRequestException(
        "No active preorder campaign found for this item. Please ensure a preorder coupon exists with matching item_id and store_id, and the campaign is currently active.",
      );
    }

    this.logger.log(
      `✅ Found preorder coupon: coupon_id=${coupon.id}, code=${coupon.code}, campaign_id=${coupon.campaign_id}, global_usage_limit=${coupon.global_usage_limit}`,
    );

    // Check campaign is active (time-based)
    const now = new Date();
    if (coupon.start_at && now < coupon.start_at) {
      throw new BadRequestException("Preorder campaign has not started yet");
    }
    if (coupon.end_at && now > coupon.end_at) {
      throw new BadRequestException("Preorder campaign has ended");
    }

    // Check quota available
    const quota = await this.redisCouponService.getQuota(coupon.id);
    
    // Log quota details for debugging
    this.logger.log(
      `🔍 Preorder quota check: coupon_id=${coupon.id}, global_usage_limit=${coupon.global_usage_limit}, current_quota=${quota}`,
    );
    
    // Validate quota
    if (quota === null && coupon.global_usage_limit) {
      // Quota not initialized - this should have been done during code generation
      this.logger.error(
        `❌ Quota not initialized for coupon ${coupon.id} with global_usage_limit=${coupon.global_usage_limit}. Please initialize quota using the admin API.`,
      );
      throw new BadRequestException(
        "Preorder quota not initialized. Please contact support or use the admin API to initialize quota.",
      );
    } else if (quota !== null && quota <= 0) {
      throw new BadRequestException("All preorder slots are taken");
    } else if (quota === null && !coupon.global_usage_limit) {
      // No quota limit set - allow unlimited (for testing/development)
      this.logger.warn(
        `⚠️ Preorder coupon ${coupon.id} has no global_usage_limit set - allowing unlimited usage`,
      );
    }

    // Check user hasn't already reserved (via coupon user_usage_limit validation)
    // This will be checked again during checkout

    return coupon; // Return coupon for auto-apply
  }

  /**
   * Update cart item
   */
  async updateCartItem(userId: number, updateCartItemDto: UpdateCartItemDto) {
    try {
      this.logger.log(
        `✏️ Updating cart item ${updateCartItemDto.cart_item_id} for user ${userId}`,
      );

      const cartItem = await this.cartItemRepository
        .createQueryBuilder("ci")
        .leftJoinAndSelect("ci.cart", "c")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoinAndSelect("i.prices", "p")
        .leftJoinAndSelect("c.store", "s")
        .leftJoin("c.user", "u")
        .where("ci.id = :cartItemId", {
          cartItemId: updateCartItemDto.cart_item_id,
        })
        .andWhere("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cartItem) {
        throw new NotFoundException("Cart item not found");
      }

      // NEW: Prevent quantity changes for preorder items
      if (cartItem.is_preorder && updateCartItemDto.quantity !== 1) {
        throw new BadRequestException(
          "Preorder items cannot have quantity changed. Quantity must be 1."
        );
      }

      // If preorder item, force quantity to 1
      if (cartItem.is_preorder) {
        updateCartItemDto.quantity = 1;
      }

      // Validate restaurant if provided
      if (
        updateCartItemDto.restaurant_id &&
        cartItem.cart.store.id !== updateCartItemDto.restaurant_id
      ) {
        throw new BadRequestException(
          "Cart item does not belong to the specified restaurant",
        );
      }

      // Check item availability
      // console.log(`cartItem.item.quantities: ${cartItem.item.quantities}`);
      // if (!cartItem.item.quantities?.[0] || cartItem.item.quantities[0].available_count < updateCartItemDto.quantity) {
      //   throw new BadRequestException('Insufficient quantity available');
      // }

      // Validate customizations if provided
      if (
        updateCartItemDto.customizations &&
        updateCartItemDto.customizations.length > 0
      ) {
        await this.validateCustomizations(
          cartItem.item.id,
          updateCartItemDto.customizations,
        );
      }

      // Recalculate prices if customizations changed (including when removed)
      const basePrice = Number(cartItem.item.prices?.[0]?.base_price || 0);
      let customizationPrice = 0;

      // Use provided customizations or existing ones from cart item
      const customizationsToUse =
        updateCartItemDto.customizations !== undefined
          ? updateCartItemDto.customizations
          : cartItem.customizations;

      // Calculate customization price if customizations exist
      if (customizationsToUse && customizationsToUse.length > 0) {
        for (const customization of customizationsToUse) {
          if (
            customization.selected_options &&
            customization.selected_options.length > 0
          ) {
            const customizationItems = await this.itemRepository
              .createQueryBuilder("item")
              .leftJoin("item.prices", "price")
              .where("item.id IN (:...optionIds)", {
                optionIds: customization.selected_options,
              })
              .andWhere("item.type = :type", { type: "customization" })
              .select(["item.id", "price.base_price"])
              .getMany();

            for (const customItem of customizationItems) {
              customizationPrice += Number(
                customItem.prices?.[0]?.base_price || 0,
              );
            }
          }
        }
      }

      // CORRECT CALCULATION: (Item Price × Quantity) + Customization Price
      const itemTotalPrice = Number(
        (basePrice * updateCartItemDto.quantity).toFixed(2),
      );
      const totalPrice = Number(
        (itemTotalPrice + customizationPrice).toFixed(2),
      );

      // Update cart item
      cartItem.quantity = updateCartItemDto.quantity;
      cartItem.unit_price = basePrice; // Store base unit price only
      cartItem.total_price = totalPrice;
      cartItem.customizations = customizationsToUse;
      cartItem.variants =
        updateCartItemDto.variants !== undefined
          ? updateCartItemDto.variants
          : cartItem.variants;
      cartItem.special_instructions =
        updateCartItemDto.special_instructions !== undefined
          ? updateCartItemDto.special_instructions
          : cartItem.special_instructions;

      await this.cartItemRepository.save(cartItem);

      // Update cart totals
      await this.updateCartTotals(cartItem.cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cartItem.cart.id },
        relations: ["store", "cart_items", "cart_items.item"],
      });

      const cartSummary = updatedCart
        ? await this.calculateCartSummary(updatedCart)
        : {
          subtotal: 0,
          delivery_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          tip_amount: 0,
          max_tip_amount: null,
          final_amount: 0,
          estimated_delivery_time: null,
        };

      return {
        success: true,
        message: "Cart item updated successfully",
        cart_summary: cartSummary,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error updating cart item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: number, removeFromCartDto: RemoveFromCartDto) {
    try {
      this.logger.log(
        `➖ Removing cart item ${removeFromCartDto.cart_item_id} for user ${userId}`,
      );

      const cartItem = await this.cartItemRepository
        .createQueryBuilder("ci")
        .leftJoinAndSelect("ci.cart", "c")
        .leftJoin("c.user", "u")
        .where("ci.id = :cartItemId", {
          cartItemId: removeFromCartDto.cart_item_id,
        })
        .andWhere("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cartItem) {
        throw new NotFoundException("Cart item not found");
      }

      const cartId = cartItem.cart.id;
      const cart = cartItem.cart;
      
      // NEW: Release reservation if preorder item has reservation token
      if (cartItem.is_preorder && cartItem.preorder_campaign_id) {
        if (cartItem.preorder_reservation_token) {
          // Release reservation and restore quota
          // releaseReservation() always restores quota, even if reservation expired
          await this.redisCouponService.releaseReservation(
            cartItem.preorder_campaign_id,
            cartItem.preorder_reservation_token
          );
          this.logger.log(
            `✅ Released reservation and restored quota for preorder coupon ${cartItem.preorder_campaign_id}`
          );
        } else {
          // No reservation token - quota was never consumed (item added but checkout never happened)
          this.logger.log(
            `ℹ️ Preorder item removed but no reservation token found. Quota was not consumed (item was not checked out).`
          );
        }
      }

      await this.cartItemRepository.remove(cartItem);

      // Check if cart is empty
      const remainingItems = await this.cartItemRepository.count({
        where: { cart: { id: cartId } },
      });

      if (remainingItems === 0) {
        // FIX: Clear coupon fields BEFORE deactivating cart
        // If we deactivate first, removeCoupon() won't find the active cart
        if (cart.coupon_id || cart.coupon_code || cart.coupon_reservation_token) {
          // Rollback reservation if exists
          if (cart.coupon_reservation_token) {
            try {
              await this.couponService.rollbackCoupon({
                reservation_token: cart.coupon_reservation_token as string,
                reason: "Cart emptied",
              });
            } catch (error) {
              this.logger.warn(
                `Failed to rollback coupon reservation: ${error.message}`,
              );
            }
          }
          
          // Clear coupon fields directly (don't call removeCoupon since cart will be deactivated)
          await this.cartRepository.update(cartId, {
            coupon_code: undefined,
            coupon_reservation_token: undefined,
            coupon_id: undefined,
            discount_amount: 0,
          });
        }
        
        // Deactivate empty cart
        await this.cartRepository.update(cartId, { is_active: false });
      } else {
        // NEW: Check if any preorder items remain
        const remainingPreorderItems = await this.cartItemRepository.count({
          where: { 
            cart: { id: cartId },
            is_preorder: true 
          },
        });

        // If no preorder items remain, remove coupon
        if (remainingPreorderItems === 0 && cart.coupon_id) {
          const coupon = await this.couponRepository.findOne({
            where: { id: cart.coupon_id },
          });
          
          if (coupon && coupon.type === CouponType.PREORDER) {
            await this.removeCoupon(userId);
          }
        }

        // Update cart totals
        await this.updateCartTotals(cartId);
      }

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cartId },
        relations: ["store", "cart_items", "cart_items.item"],
      });

      const cartSummary = updatedCart
        ? await this.calculateCartSummary(updatedCart)
        : {
          subtotal: 0,
          delivery_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          tip_amount: 0,
          max_tip_amount: null,
          final_amount: 0,
          estimated_delivery_time: null,
        };

      return {
        success: true,
        message: "Item removed from cart successfully",
        cart_summary: cartSummary,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error removing from cart: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: number) {
    try {
      this.logger.log(`🗑️ Clearing cart for user ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (cart) {
        // Load cart items with relations
        const cartWithItems = await this.cartRepository.findOne({
          where: { id: cart.id },
          relations: ["cart_items"],
        });

        // NEW: Release reservations for preorder items
        if (cartWithItems && cartWithItems.cart_items) {
          const preorderItems = cartWithItems.cart_items.filter(ci => 
            ci.is_preorder && ci.preorder_campaign_id
          );

          for (const cartItem of preorderItems) {
            // Release reservation and restore quota
            if (cartItem.preorder_campaign_id) {
              if (cartItem.preorder_reservation_token) {
                // Release reservation and restore quota
                // releaseReservation() always restores quota, even if reservation expired
                await this.redisCouponService.releaseReservation(
                  cartItem.preorder_campaign_id,
                  cartItem.preorder_reservation_token
                );
                this.logger.log(
                  `✅ Released reservation and restored quota for preorder coupon ${cartItem.preorder_campaign_id}`
                );
              } else {
                // No reservation token - quota was never consumed (item added but checkout never happened)
                this.logger.log(
                  `ℹ️ Preorder item cleared but no reservation token found. Quota was not consumed (item was not checked out).`
                );
              }
            }
          }
        }

        // Remove all cart items
        await this.cartItemRepository.delete({ cart: { id: cart.id } });

        // NEW: Remove coupon if exists
        if (cart.coupon_id) {
          await this.removeCoupon(userId);
        }

        // Deactivate cart
        await this.cartRepository.update(cart.id, { is_active: false });
      }

      return {
        success: true,
        message: "Cart cleared successfully",
      };
    } catch (error) {
      this.logger.error(
        `❌ Error clearing cart: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Apply offer to cart
   */
  async applyOffer(userId: number, applyOfferDto: ApplyOfferDto) {
    try {
      this.logger.log(`🎁 Applying offer to cart for user ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart) {
        throw new BadRequestException("Cart is empty");
      }

      let offer: Offers | null = null;

      if (applyOfferDto.offer_code) {
        offer = await this.offersRepository.findOne({
          where: {
            offer_code: applyOfferDto.offer_code,
            store: { id: cart.store.id },
            status: true,
          },
        });
      } else if (applyOfferDto.offer_id) {
        offer = await this.offersRepository.findOne({
          where: {
            id: applyOfferDto.offer_id,
            store: { id: cart.store.id },
            status: true,
          },
        });
      }

      if (!offer) {
        throw new NotFoundException("Offer not found or not applicable");
      }

      // Check offer validity
      const now = new Date();
      if (offer.valid_from > now || offer.valid_to < now) {
        throw new BadRequestException("Offer has expired");
      }

      // Calculate discount (simplified - in real app, this would be more complex)
      const subtotal = cart.cart_items.reduce(
        (sum, item) => sum + item.total_price,
        0,
      );
      const discountAmount = Math.min(subtotal * 0.1, 100); // 10% discount, max 100

      // Update cart with discount (preserve tip)
      // Ensure all values are numbers with defaults to prevent NaN
      const cartSubtotal = Number(cart.total_amount || subtotal);
      const deliveryFee = Number(cart.delivery_fee || 0);
      const taxAmount = Number(cart.tax_amount || 0);
      const tipAmount = Number(cart.tip_amount || 0);

      const platformFeeConfig = this.getPlatformFee();
      // Only include platform fee in calculation if enabled
      const platformFeeForCalculation = platformFeeConfig.isEnabled
        ? platformFeeConfig.amount
        : 0;

      cart.discount_amount = discountAmount;
      cart.final_amount =
        cartSubtotal +
        deliveryFee +
        taxAmount +
        tipAmount +
        platformFeeForCalculation -
        discountAmount;
      await this.cartRepository.save(cart);

      const cartSummary = await this.calculateCartSummary(cart);

      return {
        success: true,
        message: "Offer applied successfully",
        applied_offer: {
          id: offer.id,
          name: offer.name,
          offer_code: offer.offer_code,
          discount_amount: discountAmount,
        },
        cart_summary: cartSummary,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error applying offer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update tip amount in cart with max tip validation
   */
  async updateTip(userId: number, tipAmount: number) {
    try {
      this.logger.log(
        `💰 Updating tip amount for user ${userId}: ${tipAmount}`,
      );

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("s.configs", "sc")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart) {
        throw new BadRequestException("Cart is empty");
      }

      // Validate tip amount (must be >= 0)
      if (tipAmount < 0) {
        throw new BadRequestException("Tip amount cannot be negative");
      }

      // Validate against max tip amount (constant: fixed amount)
      if (tipAmount > this.MAX_TIP_AMOUNT) {
        throw new BadRequestException(
          `Tip amount cannot exceed maximum allowed tip of ₹${this.MAX_TIP_AMOUNT.toFixed(2)}`,
        );
      }

      // Update tip amount
      cart.tip_amount = Number(tipAmount.toFixed(2));

      // Recalculate final amount including tip
      // Ensure all values are numbers with defaults to prevent NaN
      const subtotal = Number(cart.total_amount || 0);
      const deliveryFee = Number(cart.delivery_fee || 0);
      const taxAmount = Number(cart.tax_amount || 0);
      const discountAmount = Number(cart.discount_amount || 0);
      const tipAmountValue = Number(cart.tip_amount || 0);

      const platformFeeConfig = this.getPlatformFee();
      // Only include platform fee in calculation if enabled
      const platformFeeForCalculation = platformFeeConfig.isEnabled
        ? platformFeeConfig.amount
        : 0;

      const finalAmount =
        subtotal +
        deliveryFee +
        taxAmount +
        tipAmountValue +
        platformFeeForCalculation -
        discountAmount;

      cart.final_amount = Number(finalAmount.toFixed(2));
      await this.cartRepository.save(cart);

      const cartSummary = await this.calculateCartSummary(cart);

      this.logger.log(
        `✅ Tip updated successfully. New final amount: ₹${cart.final_amount}`,
      );

      return {
        success: true,
        message: "Tip amount updated successfully",
        data: {
          tip_amount: Number(tipAmount.toFixed(2)),
          max_tip_amount: this.MAX_TIP_AMOUNT,
          cart_summary: cartSummary,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error updating tip: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create new cart
   */
  private async createCart(userId: number, storeId: number): Promise<Cart> {
    const cart = this.cartRepository.create({
      user: { id: userId },
      store: { id: storeId },
      total_amount: 0,
      delivery_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      tip_amount: 0,
      final_amount: 0,
      is_active: true,
    });

    return await this.cartRepository.save(cart);
  }

  /**
   * Recalculate cart totals for a user (public method for external use)
   * Used when user's default address changes
   * 
   * This method:
   * 1. Recalculates delivery fee based on new user location
   * 2. Updates cart totals (subtotal, tax, final_amount)
   * 
   * Note: estimated_delivery_time is not stored in the database but is calculated
   * dynamically in calculateCartSummary() based on current user location. When the cart
   * is fetched after address change, it will automatically reflect the new estimated
   * delivery time since getUserLocation() returns the updated default address.
   */
  async recalculateCartForUser(userId: number): Promise<void> {
    try {
      this.logger.log(
        `🔄 Recalculating cart for user ${userId} due to address change`,
      );

      // Find user's active cart
      const cart = await this.cartRepository.findOne({
        where: {
          user: { id: userId },
          is_active: true,
        },
      });

      if (!cart) {
        this.logger.log(
          `ℹ️ No active cart found for user ${userId}, skipping cart update`,
        );
        return;
      }

      // Recalculate cart totals (delivery fee will be recalculated based on new address)
      // estimated_delivery_time will be updated dynamically when cart summary is requested
      await this.updateCartTotals(cart.id);

      this.logger.log(
        `✅ Cart ${cart.id} updated successfully after address change`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update cart for user ${userId} after address change: ${error.message}`,
        error.stack,
      );
      // Don't throw error - address update should succeed even if cart update fails
      // Cart will be updated on next cart operation (add item, get cart, etc.)
    }
  }

  /**
   * Public method to recalculate cart totals
   * Used before order creation to ensure latest pricing
   */
  async recalculateCartTotals(cartId: number): Promise<void> {
    this.logger.log(`🔄 Recalculating totals for cart ${cartId}`);
    await this.updateCartTotals(cartId);
  }

  /**
   * Update cart totals
   */
  private async updateCartTotals(cartId: number): Promise<void> {
    const cartItems = await this.cartItemRepository.find({
      where: { cart: { id: cartId } },
      relations: ["item"],
    });

    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.total_price),
      0,
    );

    // Get cart with store and user relations for delivery fee calculation
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ["store", "store.locations", "user"],
    });

    let deliveryFee = 0;

    // Calculate delivery fee from API if cart has items and locations are available
    if (cart && cartItems.length > 0) {
      if (
        cart.store?.locations &&
        cart.store.locations.length > 0 &&
        cart.user
      ) {
        const storeLocation = cart.store.locations[0];
        const pickupLat = Number(storeLocation.gps_lat);
        const pickupLng = Number(storeLocation.gps_lng);

        try {
          // Get user location (dropoff)
          const userLocation = await this.locationService.getUserLocation(
            cart.user.id,
          );

          // Call delivery pricing API
          const deliveryInfo = await this.deliveryPricingService.getDeliveryCharge(
            pickupLat,
            pickupLng,
            Number(userLocation.lat),
            Number(userLocation.lng),
          );

          deliveryFee = deliveryInfo.charge;

          this.logger.log(
            `📦 Delivery fee calculated: ₹${deliveryFee} for cart ${cartId}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Failed to fetch delivery fee for cart ${cartId}: ${error.message}`,
          );
          deliveryFee = 0; // Fallback to 0 on error
        }
      } else {
        this.logger.warn(
          `⚠️ Cannot calculate delivery fee: missing store location or user for cart ${cartId}`,
        );
        deliveryFee = 0;
      }
    } else {
      // Cart is empty or doesn't exist, delivery fee is 0
      deliveryFee = 0;
    }

    // NEW: Check for preorder free delivery BEFORE saving
    // This ensures free delivery is applied during recalculation
    const hasPreorderItems = cartItems.some((item) => item.is_preorder === true);
    
    if (hasPreorderItems) {
      this.logger.log(`🛒 Cart has preorder items, checking for free_delivery...`);
      
      // Check cart for preorder coupon
      const currentCart = await this.cartRepository.findOne({
        where: { id: cartId },
      });
      
      if (currentCart?.coupon_id) {
        const coupon = await this.couponRepository.findOne({
          where: { id: currentCart.coupon_id },
        });

        if (coupon && coupon.type === CouponType.PREORDER && coupon.type_meta?.free_delivery === true) {
          this.logger.log(
            `✅ Preorder has free_delivery enabled, setting delivery_fee to 0 (was ₹${deliveryFee})`,
          );
          deliveryFee = 0;
        }
      } else {
        // FALLBACK: Check preorder item's campaign directly
        const preorderCartItem = cartItems.find((item) => item.is_preorder === true && item.preorder_campaign_id);
        if (preorderCartItem?.preorder_campaign_id) {
          const preorderCoupon = await this.couponRepository.findOne({
            where: { id: preorderCartItem.preorder_campaign_id },
          });
          
          if (preorderCoupon && preorderCoupon.type_meta?.free_delivery === true) {
            this.logger.log(
              `✅ Preorder campaign has free_delivery enabled, setting delivery_fee to 0 (was ₹${deliveryFee})`,
            );
            deliveryFee = 0;
          }
        }
      }
    }

    // Get current tip amount and discount (preserve existing tip)
    const currentCart = await this.cartRepository.findOne({
      where: { id: cartId },
    });
    const tipAmount = Number(currentCart?.tip_amount || 0);
    const discountAmount = Number(currentCart?.discount_amount || 0);

    // Calculate tax based on item's tax rate and type
    // IMPORTANT: For GST Exclusive pricing (food items), tax is calculated on SUBTOTAL (before discount)
    // As per GST guidelines for promotional discounts/coupons, the taxable value is the original price
    // The discount is applied AFTER tax calculation
    let taxAmount = 0;
    
    // Calculate tax on the original subtotal (before any discount)
    // This is the correct approach for GST exclusive items with promotional discounts
    for (const cartItem of cartItems) {
      if (cartItem.item.tax_rate && cartItem.item.tax_rate > 0) {
        const itemPrice = Number(cartItem.total_price);
        const itemTax = (itemPrice * cartItem.item.tax_rate) / 100;
        taxAmount += itemTax;
      }
    }
    taxAmount = Number(taxAmount.toFixed(2));

    // Get platform fee configuration
    const platformFeeConfig = this.getPlatformFee();
    // Only include platform fee in calculation if enabled
    const platformFeeForCalculation = platformFeeConfig.isEnabled
      ? platformFeeConfig.amount
      : 0;

    const finalAmount = Number(
      (
        subtotal +
        deliveryFee +
        taxAmount +
        tipAmount +
        platformFeeForCalculation -
        discountAmount
      ).toFixed(2),
    );

    this.logger.log(`💰 Cart Calculation Breakdown:`);
    this.logger.log(`  subtotal: ${Number(subtotal)}`);
    this.logger.log(`  deliveryFee: ${Number(deliveryFee)}`);
    this.logger.log(`  taxAmount: ${Number(taxAmount)}`);
    this.logger.log(`  tipAmount: ${Number(tipAmount)}`);
    this.logger.log(`  platformFee (display): ${platformFeeConfig.amount}`);
    this.logger.log(`  platformFee (included in total): ${platformFeeForCalculation}`);
    this.logger.log(`  discountAmount: ${Number(discountAmount)}`);
    this.logger.log(`  📊 Calculation: ${subtotal} + ${deliveryFee} + ${taxAmount} + ${tipAmount} + ${platformFeeForCalculation} - ${discountAmount} = ${finalAmount}`);
    this.logger.log(`  finalAmount: ${Number(finalAmount)}`);

    await this.cartRepository.update(cartId, {
      total_amount: subtotal,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      final_amount: finalAmount,
    });

    this.logger.log(`cart updated`);
  }

  /**
   * Get platform fee configuration
   * Always returns the platform fee amount for display purposes
   * isEnabled indicates whether to include it in final_amount calculation
   */
  public getPlatformFeeConfig(): {
    amount: number;
    isEnabled: boolean;
  } {
    const includeFee =
      this.configService.get<string>("INCLUDE_PLATFORM_FEE") === "true";
    const platformFeeStr = this.configService.get<string>("PLATFORM_FEE") || "0";
    // Always return the platform fee amount (for display), regardless of includeFee
    const platformFeeAmount = Math.max(0, parseFloat(platformFeeStr) || 0);

    return {
      amount: Number(platformFeeAmount.toFixed(2)),
      isEnabled: includeFee, // This determines if it's included in final_amount
    };
  }

  /**
   * DEPRECATED: Use getPlatformFeeConfig() instead
   * Kept for backward compatibility
   */
  private getPlatformFee(): {
    amount: number;
    isEnabled: boolean;
  } {
    return this.getPlatformFeeConfig();
  }

  /**
   * Calculate cart summary
   */
  private async calculateCartSummary(cart: Cart) {
    const subtotal =
      cart.cart_items?.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      ) || 0;
    let deliveryFee = Number(cart.delivery_fee || 0);
    const taxAmount = Number(cart.tax_amount || 0);
    let discountAmount = Number(cart.discount_amount || 0);
    const tipAmount = Number(cart.tip_amount || 0);

    // NEW: Handle preorder discount and free delivery
    // Check if cart has preorder items (either via coupon_id or cart items)
    const hasPreorderItems = cart.cart_items?.some((item) => item.is_preorder === true);
    
    if (cart.coupon_id) {
      const coupon = await this.couponRepository.findOne({
        where: { id: cart.coupon_id },
      });

      if (coupon && coupon.type === CouponType.PREORDER) {
        // If free delivery is included, set delivery fee to 0
        if (coupon.type_meta?.free_delivery === true) {
          deliveryFee = 0;
          // Update cart delivery fee if needed
          if (cart.delivery_fee !== 0) {
            await this.cartRepository.update(cart.id, { delivery_fee: 0 });
          }
        }
      }
    } else if (hasPreorderItems) {
      // FALLBACK: Check if any preorder item has free_delivery even if coupon not applied
      // This handles cases where item was added before preorder campaign
      try {
        const preorderCartItem = cart.cart_items?.find((item) => item.is_preorder === true && item.preorder_campaign_id);
        if (preorderCartItem?.preorder_campaign_id) {
          const preorderCoupon = await this.couponRepository.findOne({
            where: { id: preorderCartItem.preorder_campaign_id },
          });
          
          if (preorderCoupon && preorderCoupon.type_meta?.free_delivery === true) {
            deliveryFee = 0;
            // Update cart delivery fee if needed
            if (cart.delivery_fee !== 0) {
              await this.cartRepository.update(cart.id, { delivery_fee: 0 });
            }
            this.logger.log(
              `✅ Applied free_delivery for preorder item ${preorderCartItem.item.id} (coupon not applied to cart)`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not check free_delivery for preorder items: ${error.message}`,
        );
      }
    }

    // Get platform fee configuration
    const platformFeeConfig = this.getPlatformFee();

    // Recalculate final_amount based on current values and platform fee setting
    // Only include platform fee in calculation if enabled
    const platformFeeForCalculation = platformFeeConfig.isEnabled
      ? platformFeeConfig.amount
      : 0;

    const finalAmount =
      subtotal +
      deliveryFee +
      taxAmount +
      tipAmount +
      platformFeeForCalculation -
      discountAmount;

    // Fetch estimated delivery time if cart has items
    // NOTE: For preorder items, use delivery_date from coupon instead of delivery pricing service
    let estimatedDeliveryTime: string | null = null;
    if (cart.cart_items && cart.cart_items.length > 0 && cart.store && cart.user) {
      // NEW: Check if cart has preorder items
      const hasPreorderItems = cart.cart_items.some((item) => item.is_preorder === true);
      
      if (hasPreorderItems) {
        // FIX: Get preorder coupon from cart item's preorder_campaign_id, not from cart.coupon_id
        // This is because cart.coupon_id might point to a regular coupon (like "OFFER") if user applied it
        // after adding the preorder item
        try {
          // Find the first preorder item and get its campaign coupon
          const preorderCartItem = cart.cart_items.find((item) => item.is_preorder === true && item.preorder_campaign_id);
          
          if (preorderCartItem?.preorder_campaign_id) {
            const preorderCoupon = await this.couponRepository.findOne({
              where: { id: preorderCartItem.preorder_campaign_id },
            });

            if (preorderCoupon?.type_meta?.delivery_date) {
              // Parse delivery_date (supports ISO datetime or date-only)
              const deliveryDateStr = preorderCoupon.type_meta.delivery_date;
              const deliveryDate = new Date(deliveryDateStr);
              
              if (!isNaN(deliveryDate.getTime())) {
                // Format as ISO string for response
                estimatedDeliveryTime = deliveryDate.toISOString();
                this.logger.log(
                  `📅 Preorder cart: Using delivery_date ${deliveryDateStr} for estimated_delivery_time (from preorder_campaign_id=${preorderCartItem.preorder_campaign_id})`,
                );
              } else {
                this.logger.warn(
                  `⚠️ Invalid delivery_date format in preorder coupon: ${deliveryDateStr}`,
                );
              }
            } else {
              this.logger.warn(
                `⚠️ Preorder coupon ${preorderCartItem.preorder_campaign_id} found but no delivery_date in type_meta`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ Cart has preorder items but no preorder_campaign_id found on cart items`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch preorder delivery_date: ${error.message}`,
          );
        }
      }

      // For regular orders (or if preorder delivery_date not found), use delivery pricing service
      if (!estimatedDeliveryTime) {
        try {
          // Use already loaded relations if available, otherwise fetch them
          const storeLocations = cart.store.locations || [];
          let storeLocation = storeLocations.length > 0 ? storeLocations[0] : null;

          // If store locations not loaded, fetch them
          if (!storeLocation) {
            const cartWithRelations = await this.cartRepository.findOne({
              where: { id: cart.id },
              relations: ["store", "store.locations", "user"],
            });

            if (
              cartWithRelations?.store?.locations &&
              cartWithRelations.store.locations.length > 0 &&
              cartWithRelations.user
            ) {
              storeLocation = cartWithRelations.store.locations[0];
              cart.user = cartWithRelations.user; // Update cart.user if needed
            }
          }

          if (storeLocation && cart.user) {
            const pickupLat = Number(storeLocation.gps_lat);
            const pickupLng = Number(storeLocation.gps_lng);

            // Get current user location (will return updated default address if address was changed)
            const userLocation = await this.locationService.getUserLocation(
              cart.user.id,
            );

            const deliveryInfo = await this.deliveryPricingService.getDeliveryCharge(
              pickupLat,
              pickupLng,
              Number(userLocation.lat),
              Number(userLocation.lng),
            );

            estimatedDeliveryTime = deliveryInfo.estimated_delivery_time;

            this.logger.log(
              `⏱️ Estimated delivery time fetched for cart ${cart.id}: ${estimatedDeliveryTime || "N/A"}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch estimated delivery time for cart summary: ${error.message}`,
          );
          // Continue without estimated delivery time
        }
      }
    }

    return {
      subtotal: Number(subtotal.toFixed(2)),
      delivery_fee: Number(deliveryFee.toFixed(2)),
      tax_amount: Number(taxAmount.toFixed(2)),
      discount_amount: Number(discountAmount.toFixed(2)),
      tip_amount: Number(tipAmount.toFixed(2)),
      max_tip_amount: this.MAX_TIP_AMOUNT,
      platform_fee: platformFeeConfig.amount,
      include_platform_fee: platformFeeConfig.isEnabled,
      final_amount: Number(finalAmount.toFixed(2)),
      estimated_delivery_time: estimatedDeliveryTime,
      applied_offer:
        discountAmount > 0
          ? {
            id: 1,
            name: "Applied Offer",
            offer_code: "OFFER",
            discount_amount: Number(discountAmount.toFixed(2)),
          }
          : undefined,
    };
  }

  /**
   * Format cart data for response
   */
  private async formatCartData(cart: Cart) {
    const cartItems = await Promise.all(
      (cart.cart_items || []).map(async (item) => {
        // Format customizations with names and prices
        const formattedCustomizations = await this.formatCustomizations(
          item.customizations || [],
        );

        // Get dietary preference from item attributes
        const dietaryAttr = item.item.attributes?.find(
          (attr) => attr.attribute_code === "veg_nonveg",
        );
        const dietaryPref =
          (dietaryAttr?.attribute_value as DietaryPreference) ||
          DietaryPreference.NON_VEG;

        // Check if item has customizations available (using BuyerService method to avoid duplication)
        const hasCustomizations =
          await this.buyerService.checkItemHasCustomizations(item.item.id);

        // Debug log
        this.logger.debug(
          `Item ${item.item.id} (${item.item.name}): dietary_preference = ${dietaryPref}, has_customizations = ${hasCustomizations}`,
        );

        const itemPayload: any = {
          id: item.id,
          item_id: item.item.id,
          item_name: item.item.name,
          item_description: item.item.short_desc,
          item_images: item.item.images || [],
          dietary_preference: dietaryPref,
          has_customizations: hasCustomizations,
          quantity: item.quantity,
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.total_price || 0),
          customizations: formattedCustomizations,
          variants: item.variants || [],
          special_instructions: item.special_instructions,
          is_available: item.item.quantities?.[0]?.available_count > 0,
        };

        // NEW: Add preorder details if this is a preorder item
        // First check if item has preorder flag set
        if (item.is_preorder && item.preorder_campaign_id) {
          try {
            const preorderCoupon = await this.couponRepository.findOne({
              where: { id: item.preorder_campaign_id },
            });

            if (preorderCoupon && preorderCoupon.type_meta) {
              // Get available slots from Redis
              let availableSlots = 0;
              try {
                const quota = await this.redisCouponService.getQuota(
                  preorderCoupon.id,
                );
                availableSlots = quota || 0;
              } catch (error) {
                this.logger.warn(
                  `Could not fetch quota for coupon ${preorderCoupon.id}: ${error.message}`,
                );
              }

              itemPayload.is_preorder = true;
              itemPayload.preorder_campaign = {
                id: preorderCoupon.campaign_id,
                title: preorderCoupon.type_meta.title || "Preorder",
                delivery_date: preorderCoupon.type_meta.delivery_date,
                available_slots: availableSlots,
                free_delivery: preorderCoupon.type_meta?.free_delivery === true,
              };
            }
          } catch (error) {
            this.logger.warn(
              `Could not fetch preorder coupon ${item.preorder_campaign_id}: ${error.message}`,
            );
          }
        } else if (cart.coupon_id) {
          // FALLBACK 1: Check if cart has a PREORDER coupon that matches this item
          // This handles cases where item was added before preorder campaign or without is_preorder flag
          try {
            const cartCoupon = await this.couponRepository.findOne({
              where: { id: cart.coupon_id },
            });

            if (
              cartCoupon &&
              cartCoupon.type === CouponType.PREORDER &&
              cartCoupon.type_meta &&
              cartCoupon.type_meta.item_id &&
              Number(cartCoupon.type_meta.item_id) === item.item.id
            ) {
              // This item matches the preorder coupon - add preorder info
              let availableSlots = 0;
              try {
                const quota = await this.redisCouponService.getQuota(
                  cartCoupon.id,
                );
                availableSlots = quota || 0;
              } catch (error) {
                this.logger.warn(
                  `Could not fetch quota for coupon ${cartCoupon.id}: ${error.message}`,
                );
              }

              itemPayload.is_preorder = true;
              itemPayload.preorder_campaign = {
                id: cartCoupon.campaign_id,
                title: cartCoupon.type_meta.title || "Preorder",
                delivery_date: cartCoupon.type_meta.delivery_date,
                available_slots: availableSlots,
                free_delivery: cartCoupon.type_meta?.free_delivery === true,
              };

              this.logger.log(
                `✅ Added preorder info to item ${item.item.id} via cart coupon fallback`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Could not check cart coupon for preorder info: ${error.message}`,
            );
          }
        } else {
          // FALLBACK 2: Check if item has an active preorder campaign (even if not applied to cart)
          // This handles cases where item was added before preorder campaign was created
          try {
            this.logger.debug(
              `🔍 FALLBACK 2: Checking for preorder campaign for item ${item.item.id}, store ${cart.store.id}`,
            );
            
            const preorderCoupon = await this.couponRepository
              .createQueryBuilder("coupon")
              .where("coupon.type = :type", { type: CouponType.PREORDER })
              .andWhere("coupon.status = :status", { status: CouponStatus.ACTIVE })
              .andWhere("coupon.type_meta->>'item_id' = :itemId", { itemId: item.item.id.toString() })
              .andWhere(
                "(coupon.applicable_store_ids IS NULL OR array_length(coupon.applicable_store_ids, 1) IS NULL OR :storeId = ANY(coupon.applicable_store_ids))",
                { storeId: cart.store.id }
              )
              .getOne();

            if (preorderCoupon) {
              this.logger.debug(
                `✅ Found preorder coupon ${preorderCoupon.id} for item ${item.item.id}`,
              );
              
              // Check if campaign is active (time-based)
              const now = new Date();
              const isActive = 
                (!preorderCoupon.start_at || now >= preorderCoupon.start_at) &&
                (!preorderCoupon.end_at || now <= preorderCoupon.end_at);

              this.logger.debug(
                `⏰ Campaign time check: start_at=${preorderCoupon.start_at}, end_at=${preorderCoupon.end_at}, now=${now}, isActive=${isActive}`,
              );

              if (isActive) {
                // Get available slots
                let availableSlots = 0;
                try {
                  const quota = await this.redisCouponService.getQuota(preorderCoupon.id);
                  availableSlots = quota !== null ? quota : (preorderCoupon.global_usage_limit ? Number(preorderCoupon.global_usage_limit) : 0);
                  this.logger.debug(
                    `📊 Available slots for coupon ${preorderCoupon.id}: ${availableSlots}`,
                  );
                } catch (error) {
                  this.logger.warn(
                    `Could not fetch quota for coupon ${preorderCoupon.id}: ${error.message}`,
                  );
                  // Fallback to global_usage_limit if quota fetch fails
                  availableSlots = preorderCoupon.global_usage_limit ? Number(preorderCoupon.global_usage_limit) : 0;
                }

                // Show preorder info regardless of available slots (even if 0, user should know it's a preorder)
                itemPayload.is_preorder = true;
                itemPayload.preorder_campaign = {
                  id: preorderCoupon.campaign_id || preorderCoupon.id,
                  title: preorderCoupon.type_meta?.title || "Preorder",
                  delivery_date: preorderCoupon.type_meta?.delivery_date,
                  available_slots: availableSlots,
                  free_delivery: preorderCoupon.type_meta?.free_delivery === true,
                };

                this.logger.log(
                  `✅ Added preorder info to item ${item.item.id} via active campaign fallback (coupon not applied to cart, slots: ${availableSlots})`,
                );
              } else {
                this.logger.debug(
                  `⏰ Preorder campaign ${preorderCoupon.id} is not active (time-based check failed)`,
                );
              }
            } else {
              this.logger.debug(
                `❌ No preorder coupon found for item ${item.item.id}, store ${cart.store.id}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Could not check for active preorder campaign for item ${item.item.id}: ${error.message}`,
              error.stack,
            );
          }
        }

        return itemPayload;
      }),
    );

    const summary = await this.calculateCartSummary(cart);

    return {
      id: cart.id,
      restaurant_id: cart.store.id,
      restaurant_name: cart.store.name,
      restaurant_logo: cart.store.logo_url,
      items: cartItems,
      summary,
      total_items: cartItems.length,
      is_active: cart.is_active,
      created_at: cart.created_at.toISOString(),
      updated_at: cart.updated_at.toISOString(),
    };
  }

  /**
   * Format customizations with names and prices for display
   */
  private async formatCustomizations(customizations: any[]) {
    if (!customizations || customizations.length === 0) {
      return [];
    }

    const formattedCustomizations = await Promise.all(
      customizations.map(async (customization) => {
        const { customization_group_id, selected_options } = customization;

        // Get customization group name first
        const customizationGroup = await this.itemCustomizationGroupsRepository
          .createQueryBuilder("icg")
          .leftJoin("icg.customization_group", "cg")
          .where("cg.id = :groupId", { groupId: customization_group_id })
          .select(["cg.name"])
          .getOne();

        if (!selected_options || selected_options.length === 0) {
          return {
            customization_group_id,
            customization_group_name:
              customizationGroup?.customization_group?.name || "Customizations",
            selected_options: [],
          };
        }

        // Get selected options with names and prices
        const selectedOptions = await this.itemRepository
          .createQueryBuilder("item")
          .leftJoin("item.prices", "price")
          .where("item.id IN (:...optionIds)", { optionIds: selected_options })
          .andWhere("item.type = :type", { type: "customization" })
          .select(["item.id", "item.name", "price.base_price"])
          .getMany();

        const formattedOptions = selectedOptions.map((option) => ({
          id: option.id,
          name: option.name,
          price: Number(option.prices?.[0]?.base_price || 0),
        }));

        return {
          customization_group_id,
          customization_group_name:
            customizationGroup?.customization_group?.name || "Customizations",
          selected_options: formattedOptions,
        };
      }),
    );

    return formattedCustomizations;
  }

  /**
   * Validate customization options belong to the correct parent item
   */
  private async validateCustomizations(itemId: number, customizations: any[]) {
    try {
      this.logger.log(`🔍 Validating customizations for item ${itemId}`);

      for (const customization of customizations) {
        const { customization_group_id, selected_options } = customization;

        if (!selected_options || selected_options.length === 0) {
          continue; // Skip empty customizations
        }

        // Simple check: Just verify the customization options belong to the main item
        this.logger.log(
          `🔍 Validating customization options: ${selected_options.join(", ")} for item ${itemId}`,
        );

        console.log(`selected_options: ${selected_options}`);
        console.log(`itemId: ${itemId}`);
        const validOptions = await this.itemRepository
          .createQueryBuilder("option")
          .where("option.id IN (:...optionIds)", {
            optionIds: selected_options,
          })
          .andWhere("option.parentItemId = :itemId", { itemId })
          .andWhere("option.type = :type", { type: "customization" })
          .andWhere("option.status = :status", { status: true })
          .select(["option.id", "option.name"])
          .getMany();

        this.logger.log(
          `🔍 Valid options found:`,
          validOptions.map((opt) => ({ id: opt.id, name: opt.name })),
        );

        if (validOptions.length !== selected_options.length) {
          throw new BadRequestException(
            `Invalid customization options. Some options do not belong to the selected item.`,
          );
        }

        this.logger.log(
          `✅ Validated ${validOptions.length} customization options for group ${customization_group_id}`,
        );
      }

      this.logger.log(
        `✅ All customizations validated successfully for item ${itemId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error validating customizations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId: number, applyCouponDto: ApplyCouponDto) {
    try {
      this.logger.log(
        `🎟️ Applying coupon ${applyCouponDto.coupon_code} to cart for user ${userId}`,
      );

      // Get user's active cart
      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart) {
        throw new NotFoundException("Active cart not found");
      }

      // Get user location for pincode
      const userLocation = await this.locationService.getUserLocation(userId);
      const pincode = userLocation?.address?.pincode;
      if (!pincode) {
        throw new BadRequestException(
          "User location (pincode) is required to apply coupon",
        );
      }

      // Calculate current cart total
      const cartItems = await this.cartItemRepository.find({
        where: { cart: { id: cart.id } },
        relations: ["item"],
      });

      const subtotal = cartItems.reduce(
        (sum, item) => sum + Number(item.total_price),
        0,
      );

      // Validate and reserve coupon
      const validation = await this.couponService.validateCoupon({
        code: applyCouponDto.coupon_code,
        user_id: userId,
        cart_total: subtotal,
        pincode: pincode,
        store_id: cart.store.id,
        reserve: true, // Reserve immediately
      });

      if (!validation.valid) {
        throw new BadRequestException(
          validation.message || "Invalid coupon code",
        );
      }

      // Get coupon to set coupon_id
      const coupon = await this.couponRepository.findOne({
        where: { code: applyCouponDto.coupon_code },
      });

      // Update cart with coupon details
      cart.coupon_code = applyCouponDto.coupon_code;
      cart.coupon_reservation_token = validation.reservation_token;
      cart.coupon_id = coupon?.id;
      cart.discount_amount = validation.discount_amount || 0;

      // If delivery is waived, set delivery fee to 0
      if (validation.delivery_waived) {
        cart.delivery_fee = 0;
      }

      await this.cartRepository.save(cart);

      // Recalculate cart totals
      await this.updateCartTotals(cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cart.id },
        relations: ["store", "cart_items", "cart_items.item"],
      });

      const cartSummary = await this.calculateCartSummary(updatedCart!);

      this.logger.log(
        `✅ Coupon applied successfully. Discount: ₹${validation.discount_amount}`,
      );

      return {
        success: true,
        message: "Coupon applied successfully",
        data: {
          coupon_code: applyCouponDto.coupon_code,
          discount_amount: validation.discount_amount || 0,
          delivery_waived: validation.delivery_waived || false,
          reservation_token: validation.reservation_token,
          cart_summary: cartSummary,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error applying coupon: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Apply coupon to cart with a proposed cart total
   * Used when adding items to cart, so we can validate with the new item included
   */
  private async applyCouponWithCartTotal(
    userId: number,
    applyCouponDto: ApplyCouponDto,
    proposedCartTotal: number,
  ) {
    try {
      this.logger.log(
        `🎟️ Applying coupon ${applyCouponDto.coupon_code} to cart for user ${userId} with proposed cart total: ₹${proposedCartTotal}`,
      );

      // Get user's active cart
      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart) {
        throw new NotFoundException("Active cart not found");
      }

      // Get user location for pincode
      const userLocation = await this.locationService.getUserLocation(userId);
      const pincode = userLocation?.address?.pincode;
      if (!pincode) {
        throw new BadRequestException(
          "User location (pincode) is required to apply coupon",
        );
      }

      // Validate and reserve coupon with proposed cart total
      const validation = await this.couponService.validateCoupon({
        code: applyCouponDto.coupon_code,
        user_id: userId,
        cart_total: proposedCartTotal, // Use proposed total instead of current cart total
        pincode: pincode,
        store_id: cart.store.id,
        reserve: true, // Reserve immediately
      });

      if (!validation.valid) {
        throw new BadRequestException(
          validation.message || "Invalid coupon code",
        );
      }

      // Get coupon to set coupon_id
      const coupon = await this.couponRepository.findOne({
        where: { code: applyCouponDto.coupon_code },
      });

      // Update cart with coupon details
      cart.coupon_code = applyCouponDto.coupon_code;
      cart.coupon_reservation_token = validation.reservation_token;
      cart.coupon_id = coupon?.id;
      cart.discount_amount = validation.discount_amount || 0;

      // If delivery is waived, set delivery fee to 0
      if (validation.delivery_waived) {
        cart.delivery_fee = 0;
      }

      await this.cartRepository.save(cart);

      this.logger.log(
        `✅ Preorder coupon applied successfully. Discount: ₹${validation.discount_amount}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error applying preorder coupon: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId: number) {
    try {
      this.logger.log(`🗑️ Removing coupon from cart for user ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart) {
        throw new NotFoundException("Active cart not found");
      }

      if (!cart.coupon_code) {
        throw new BadRequestException("No coupon applied to cart");
      }

      // Rollback reservation if exists
      if (cart.coupon_reservation_token) {
        try {
          await this.couponService.rollbackCoupon({
            reservation_token: cart.coupon_reservation_token as string,
            reason: "Removed by user",
          });
        } catch (error) {
          this.logger.warn(
            `Failed to rollback coupon reservation: ${error.message}`,
          );
          // Continue with removal even if rollback fails
        }
      }

      // Remove coupon from cart
      cart.coupon_code = undefined;
      cart.coupon_reservation_token = undefined;
      cart.coupon_id = undefined;
      cart.discount_amount = 0;

      await this.cartRepository.save(cart);

      // Recalculate cart totals (delivery fee will be recalculated)
      await this.updateCartTotals(cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cart.id },
        relations: ["store", "cart_items", "cart_items.item"],
      });

      const cartSummary = await this.calculateCartSummary(updatedCart!);

      this.logger.log(`✅ Coupon removed successfully`);

      return {
        success: true,
        message: "Coupon removed successfully",
        data: {
          cart_summary: cartSummary,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error removing coupon: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
