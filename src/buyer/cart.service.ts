import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Item } from '../item/entities/item.entity';
import { Store } from '../store/entities/store.entity';
import { User } from '../user/entities/user.entity';
import { Offers } from '../offer/entities/offers.entity';
import { AddToCartDto, UpdateCartItemDto, RemoveFromCartDto, ApplyOfferDto } from './dto/cart-request.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Offers)
    private readonly offersRepository: Repository<Offers>,
  ) {}

  /**
   * Get user's active cart
   */
  async getCart(userId: number) {
    try {
      this.logger.log(`🛒 Getting cart for user ID: ${userId}`);

      const cart = await this.cartRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.store', 's')
        .leftJoinAndSelect('c.cart_items', 'ci')
        .leftJoinAndSelect('ci.item', 'i')
        .where('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .orderBy('ci.created_at', 'ASC')
        .getOne();

      if (!cart) {
        return {
          success: true,
          message: 'Cart is empty',
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
              final_amount: 0
            },
            total_items: 0,
            is_active: false,
            created_at: null,
            updated_at: null
          }
        };
      }

      const cartData = await this.formatCartData(cart);
      return {
        success: true,
        message: 'Cart retrieved successfully',
        data: cartData
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
      this.logger.log(`➕ Adding item ${addToCartDto.item_id} to cart for user ${userId}`);

      // Get item details
      const item = await this.itemRepository
        .createQueryBuilder('i')
        .leftJoinAndSelect('i.store', 's')
        .leftJoinAndSelect('i.prices', 'p')
        .leftJoinAndSelect('i.quantities', 'q')
        .where('i.id = :itemId', { itemId: addToCartDto.item_id })
        .andWhere('i.status = :status', { status: true })
        .getOne();

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      if (!item.quantities?.[0] || item.quantities[0].available_count < addToCartDto.quantity) {
        throw new BadRequestException('Insufficient quantity available');
      }

      // Validate customizations if provided
      if (addToCartDto.customizations && addToCartDto.customizations.length > 0) {
        await this.validateCustomizations(addToCartDto.item_id, addToCartDto.customizations);
      }

      // Get or create active cart
      let cart = await this.cartRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.store', 's')
        .where('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      // Check if adding item from different restaurant
      if (cart && cart.store.id !== item.store.id) {
        throw new BadRequestException('Cannot add items from different restaurants. Please clear your cart first.');
      }

      if (!cart) {
        cart = await this.createCart(userId, item.store.id);
      }

      // Check if item already exists in cart
      const existingCartItem = await this.cartItemRepository
        .createQueryBuilder('ci')
        .where('ci.cart_id = :cartId', { cartId: cart.id })
        .andWhere('ci.item_id = :itemId', { itemId: addToCartDto.item_id })
        .andWhere('ci.customizations = :customizations', { customizations: JSON.stringify(addToCartDto.customizations || []) })
        .andWhere('ci.variants = :variants', { variants: JSON.stringify(addToCartDto.variants || []) })
        .getOne();

      let cartItem: CartItem;
      const unitPrice = item.prices?.[0]?.base_price || 0;

      if (existingCartItem) {
        // Update existing item quantity
        existingCartItem.quantity += addToCartDto.quantity;
        existingCartItem.total_price = existingCartItem.quantity * existingCartItem.unit_price;
        cartItem = await this.cartItemRepository.save(existingCartItem);
      } else {
        // Create new cart item
        cartItem = this.cartItemRepository.create({
          cart,
          item,
          quantity: addToCartDto.quantity,
          unit_price: unitPrice,
          total_price: addToCartDto.quantity * unitPrice,
          customizations: addToCartDto.customizations || [],
          variants: addToCartDto.variants || [],
          special_instructions: addToCartDto.special_instructions
        });
        cartItem = await this.cartItemRepository.save(cartItem);
      }

      // Update cart totals
      await this.updateCartTotals(cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cart.id },
        relations: ['store', 'cart_items', 'cart_items.item']
      });

      const cartSummary = updatedCart ? await this.calculateCartSummary(updatedCart) : {
        subtotal: 0,
        delivery_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        final_amount: 0
      };

      return {
        success: true,
        message: 'Item added to cart successfully',
        cart_item_id: cartItem.id,
        cart_summary: cartSummary
      };
    } catch (error) {
      this.logger.error(`❌ Error adding to cart: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(userId: number, updateCartItemDto: UpdateCartItemDto) {
    try {
      this.logger.log(`✏️ Updating cart item ${updateCartItemDto.cart_item_id} for user ${userId}`);

      const cartItem = await this.cartItemRepository
        .createQueryBuilder('ci')
        .leftJoinAndSelect('ci.cart', 'c')
        .leftJoinAndSelect('ci.item', 'i')
        .where('ci.id = :cartItemId', { cartItemId: updateCartItemDto.cart_item_id })
        .andWhere('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      // Check item availability
      if (!cartItem.item.quantities?.[0] || cartItem.item.quantities[0].available_count < updateCartItemDto.quantity) {
        throw new BadRequestException('Insufficient quantity available');
      }

      // Validate customizations if provided
      if (updateCartItemDto.customizations && updateCartItemDto.customizations.length > 0) {
        await this.validateCustomizations(cartItem.item.id, updateCartItemDto.customizations);
      }

      // Update cart item
      cartItem.quantity = updateCartItemDto.quantity;
      cartItem.total_price = cartItem.quantity * cartItem.unit_price;
      cartItem.customizations = updateCartItemDto.customizations || cartItem.customizations;
      cartItem.variants = updateCartItemDto.variants || cartItem.variants;
      cartItem.special_instructions = updateCartItemDto.special_instructions || cartItem.special_instructions;

      await this.cartItemRepository.save(cartItem);

      // Update cart totals
      await this.updateCartTotals(cartItem.cart.id);

      // Get updated cart summary
      const updatedCart = await this.cartRepository.findOne({
        where: { id: cartItem.cart.id },
        relations: ['store', 'cart_items', 'cart_items.item']
      });

      const cartSummary = updatedCart ? await this.calculateCartSummary(updatedCart) : {
        subtotal: 0,
        delivery_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        final_amount: 0
      };

      return {
        success: true,
        message: 'Cart item updated successfully',
        cart_summary: cartSummary
      };
    } catch (error) {
      this.logger.error(`❌ Error updating cart item: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: number, removeFromCartDto: RemoveFromCartDto) {
    try {
      this.logger.log(`➖ Removing cart item ${removeFromCartDto.cart_item_id} for user ${userId}`);

      const cartItem = await this.cartItemRepository
        .createQueryBuilder('ci')
        .leftJoinAndSelect('ci.cart', 'c')
        .where('ci.id = :cartItemId', { cartItemId: removeFromCartDto.cart_item_id })
        .andWhere('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      const cartId = cartItem.cart.id;
      await this.cartItemRepository.remove(cartItem);

      // Check if cart is empty
      const remainingItems = await this.cartItemRepository.count({
        where: { cart: { id: cartId } }
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
        relations: ['store', 'cart_items', 'cart_items.item']
      });

      const cartSummary = updatedCart ? await this.calculateCartSummary(updatedCart) : {
        subtotal: 0,
        delivery_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        final_amount: 0
      };

      return {
        success: true,
        message: 'Item removed from cart successfully',
        cart_summary: cartSummary
      };
    } catch (error) {
      this.logger.error(`❌ Error removing from cart: ${error.message}`, error.stack);
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
        .createQueryBuilder('c')
        .where('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      if (cart) {
        // Remove all cart items
        await this.cartItemRepository.delete({ cart: { id: cart.id } });
        
        // Deactivate cart
        await this.cartRepository.update(cart.id, { is_active: false });
      }

      return {
        success: true,
        message: 'Cart cleared successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error clearing cart: ${error.message}`, error.stack);
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
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.store', 's')
        .leftJoinAndSelect('c.cart_items', 'ci')
        .leftJoinAndSelect('ci.item', 'i')
        .where('c.user_id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      if (!cart) {
        throw new BadRequestException('Cart is empty');
      }

      let offer: Offers | null = null;

      if (applyOfferDto.offer_code) {
        offer = await this.offersRepository.findOne({
          where: {
            offer_code: applyOfferDto.offer_code,
            store: { id: cart.store.id },
            status: true
          }
        });
      } else if (applyOfferDto.offer_id) {
        offer = await this.offersRepository.findOne({
          where: {
            id: applyOfferDto.offer_id,
            store: { id: cart.store.id },
            status: true
          }
        });
      }

      if (!offer) {
        throw new NotFoundException('Offer not found or not applicable');
      }

      // Check offer validity
      const now = new Date();
      if (offer.valid_from > now || offer.valid_to < now) {
        throw new BadRequestException('Offer has expired');
      }

      // Calculate discount (simplified - in real app, this would be more complex)
      const subtotal = cart.cart_items.reduce((sum, item) => sum + item.total_price, 0);
      const discountAmount = Math.min(subtotal * 0.1, 100); // 10% discount, max 100

      // Update cart with discount
      cart.discount_amount = discountAmount;
      cart.final_amount = cart.total_amount - discountAmount;
      await this.cartRepository.save(cart);

      const cartSummary = await this.calculateCartSummary(cart);

      return {
        success: true,
        message: 'Offer applied successfully',
        applied_offer: {
          id: offer.id,
          name: offer.name,
          offer_code: offer.offer_code,
          discount_amount: discountAmount
        },
        cart_summary: cartSummary
      };
    } catch (error) {
      this.logger.error(`❌ Error applying offer: ${error.message}`, error.stack);
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
      final_amount: 0,
      is_active: true
    });

    return await this.cartRepository.save(cart);
  }

  /**
   * Update cart totals
   */
  private async updateCartTotals(cartId: number): Promise<void> {
    const cartItems = await this.cartItemRepository.find({
      where: { cart: { id: cartId } }
    });

    const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
    const deliveryFee = subtotal > 200 ? 0 : 30; // Free delivery above 200
    const taxAmount = subtotal * 0.18; // 18% GST
    const finalAmount = subtotal + deliveryFee + taxAmount;

    await this.cartRepository.update(cartId, {
      total_amount: subtotal,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      final_amount: finalAmount
    });
  }

  /**
   * Calculate cart summary
   */
  private async calculateCartSummary(cart: Cart) {
    const subtotal = cart.cart_items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
    const deliveryFee = cart.delivery_fee || 0;
    const taxAmount = cart.tax_amount || 0;
    const discountAmount = cart.discount_amount || 0;
    const finalAmount = cart.final_amount || 0;

    return {
      subtotal,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      applied_offer: discountAmount > 0 ? {
        id: 1,
        name: 'Applied Offer',
        offer_code: 'OFFER',
        discount_amount: discountAmount
      } : undefined
    };
  }

  /**
   * Format cart data for response
   */
  private async formatCartData(cart: Cart) {
    const cartItems = cart.cart_items?.map(item => ({
      id: item.id,
      item_id: item.item.id,
      item_name: item.item.name,
      item_description: item.item.short_desc,
      item_images: item.item.images || [],
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      customizations: item.customizations || [],
      variants: item.variants || [],
      special_instructions: item.special_instructions,
      is_available: item.item.quantities?.[0]?.available_count > 0
    })) || [];

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
      updated_at: cart.updated_at.toISOString()
    };
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

        // Validate that all selected options belong to this parent item and group
        const validOptions = await this.itemRepository
          .createQueryBuilder('option')
          .leftJoin('option.item_categories', 'ic')
          .where('option.id IN (:...optionIds)', { optionIds: selected_options })
          .andWhere('option.parent_item_id = :itemId', { itemId })
          .andWhere('ic.categoryId = :groupId', { groupId: customization_group_id })
          .andWhere('option.type = :type', { type: 'customization' })
          .andWhere('option.status = :status', { status: true })
          .getMany();

        if (validOptions.length !== selected_options.length) {
          const invalidOptions = selected_options.filter(
            id => !validOptions.some(option => option.id === id)
          );
          throw new BadRequestException(
            `Invalid customization options: ${invalidOptions.join(', ')}. These options do not belong to the selected item or group.`
          );
        }

        this.logger.log(`✅ Validated ${validOptions.length} customization options for group ${customization_group_id}`);
      }

      this.logger.log(`✅ All customizations validated successfully for item ${itemId}`);
    } catch (error) {
      this.logger.error(`❌ Error validating customizations: ${error.message}`, error.stack);
      throw error;
    }
  }
}
