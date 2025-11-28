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
import { ApplyCouponDto } from "./dto/apply-coupon.dto";
import { ConfigService } from "@nestjs/config";

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
    @Inject(forwardRef(() => BuyerService))
    private readonly buyerService: BuyerService,
    private readonly locationService: LocationService,
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly couponService: CouponService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get user's active cart
   */
  async getCart(userId: number) {
    try {
      this.logger.log(`🛒 Getting cart for user ID: ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoinAndSelect("i.attributes", "ia")
        .leftJoinAndSelect("i.quantities", "iq")
        .leftJoin("c.user", "u")
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

      if (
        !item.quantities?.[0] ||
        item.quantities[0].available_count < addToCartDto.quantity
      ) {
        throw new BadRequestException("Insufficient quantity available");
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

      if (existingCartItem) {
        // Update existing item quantity
        existingCartItem.quantity += addToCartDto.quantity;
        // Recalculate total price with new quantity
        const newItemTotalPrice = Number(
          (unitPrice * existingCartItem.quantity).toFixed(2),
        );
        existingCartItem.total_price = Number(
          (newItemTotalPrice + customizationPrice).toFixed(2),
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
      await this.cartItemRepository.remove(cartItem);

      // Check if cart is empty
      const remainingItems = await this.cartItemRepository.count({
        where: { cart: { id: cartId } },
      });

      if (remainingItems === 0) {
        // Deactivate empty cart
        await this.cartRepository.update(cartId, { is_active: false });
      } else {
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
        // Remove all cart items
        await this.cartItemRepository.delete({ cart: { id: cart.id } });

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
          deliveryFee = await this.deliveryPricingService.getDeliveryCharge(
            pickupLat,
            pickupLng,
            Number(userLocation.lat),
            Number(userLocation.lng),
          );

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

    // Calculate tax based on item's tax rate and type
    let taxAmount = 0;
    for (const cartItem of cartItems) {
      if (cartItem.item.tax_rate && cartItem.item.tax_rate > 0) {
        const itemTax =
          (Number(cartItem.total_price) * cartItem.item.tax_rate) / 100;
        taxAmount += itemTax;
      }
    }
    taxAmount = Number(taxAmount.toFixed(2));

    // Get current tip amount (preserve existing tip)
    const currentCart = await this.cartRepository.findOne({
      where: { id: cartId },
    });
    const tipAmount = Number(currentCart?.tip_amount || 0);
    const discountAmount = Number(currentCart?.discount_amount || 0);

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

    this.logger.log(`subtotal: ${Number(subtotal)}`);
    this.logger.log(`deliveryFee: ${Number(deliveryFee)}`);
    this.logger.log(`taxAmount: ${Number(taxAmount)}`);
    this.logger.log(`tipAmount: ${Number(tipAmount)}`);
    this.logger.log(`platformFee (display): ${platformFeeConfig.amount}`);
    this.logger.log(`platformFee (included in total): ${platformFeeForCalculation}`);
    this.logger.log(`discountAmount: ${Number(discountAmount)}`);
    this.logger.log(`finalAmount: ${Number(finalAmount)}`);

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
  private getPlatformFee(): {
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
   * Calculate cart summary
   */
  private async calculateCartSummary(cart: Cart) {
    const subtotal =
      cart.cart_items?.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      ) || 0;
    const deliveryFee = Number(cart.delivery_fee || 0);
    const taxAmount = Number(cart.tax_amount || 0);
    const discountAmount = Number(cart.discount_amount || 0);
    const tipAmount = Number(cart.tip_amount || 0);

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

        return {
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

      // Update cart with coupon details
      cart.coupon_code = applyCouponDto.coupon_code;
      cart.coupon_reservation_token = validation.reservation_token;
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
            reservation_token: cart.coupon_reservation_token,
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
