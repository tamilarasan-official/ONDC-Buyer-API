import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { OrderTracking } from '../order/entities/order-tracking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { UserAddress } from '../user/entities/user-address.entity';
import { User } from '../user/entities/user.entity';
import { Store } from '../store/entities/store.entity';
import { Item } from '../item/entities/item.entity';
import { ItemCustomizationGroups } from '../item/entities/item-customization-groups.entity';
import { RazorpayService } from './razorpay.service';
import { NotificationService } from './notification.service';
import { SellerPushService } from './seller-push.service';
import { SellerStatusService } from '../shared/services/seller-status.service';
import { CreateOrderDto, CreatePaymentDto, VerifyPaymentDto, UpdateOrderStatusDto, CancelOrderDto } from './dto/order-request.dto';
import { SellerStatusUpdateDto } from './dto/seller-status-update.dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderTracking)
    private readonly orderTrackingRepository: Repository<OrderTracking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(ItemCustomizationGroups)
    private readonly itemCustomizationGroupsRepository: Repository<ItemCustomizationGroups>,
    private readonly razorpayService: RazorpayService,
    private readonly notificationService: NotificationService,
    private readonly sellerPushService: SellerPushService,
    private readonly sellerStatusService: SellerStatusService,
  ) {}

  /**
   * Create order from cart (without payment processing)
   */
  async createOrder(userId: number, createOrderDto: CreateOrderDto) {
    try {
      this.logger.log(`🛒 Creating order for user ${userId}`);

      // Get user's active cart
      const cart = await this.cartRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.store', 's')
        .leftJoinAndSelect('c.cart_items', 'ci')
        .leftJoinAndSelect('ci.item', 'i')
        .leftJoin('c.user', 'u')
        .where('u.id = :userId', { userId })
        .andWhere('c.is_active = :isActive', { isActive: true })
        .getOne();

      if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Get delivery address
      const deliveryAddress = await this.userAddressRepository.findOne({
        where: { id: createOrderDto.delivery_address_id, user: { id: userId } }
      });

      if (!deliveryAddress) {
        throw new NotFoundException('Delivery address not found');
      }

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order with appropriate status based on payment method
      const orderStatus = createOrderDto.payment_method === 'cod' ? 'confirmed' : 'pending_payment';
      const paymentStatus = createOrderDto.payment_method === 'cod' ? 'pending' : 'pending';

      const order = this.orderRepository.create({
        order_number: orderNumber,
        user: { id: userId },
        store: { id: cart.store.id },
        delivery_address: { id: deliveryAddress.id },
        status: orderStatus,
        subtotal: cart.total_amount,
        delivery_fee: cart.delivery_fee,
        tax_amount: cart.tax_amount,
        discount_amount: cart.discount_amount,
        total_amount: cart.final_amount,
        payment_method: createOrderDto.payment_method,
        payment_status: paymentStatus,
        notes: createOrderDto.notes,
        estimated_delivery_time: this.calculateEstimatedDeliveryTime()
      });

      const savedOrder = await this.orderRepository.save(order);

      // Create order items from cart items
      const orderItems = cart.cart_items.map(cartItem => 
        this.orderItemRepository.create({
          order: { id: savedOrder.id },
          item: { id: cartItem.item.id },
          quantity: cartItem.quantity,
          unit_price: cartItem.unit_price,
          total_price: cartItem.total_price,
          customizations: cartItem.customizations,
          variants: cartItem.variants
        })
      );

      await this.orderItemRepository.save(orderItems);

      // Create initial tracking entry
      const trackingMessage = createOrderDto.payment_method === 'cod' 
        ? 'Order placed successfully - Cash on Delivery' 
        : 'Order placed successfully - Payment pending';
      await this.createOrderTracking(savedOrder.id, orderStatus, trackingMessage);

      // Deactivate cart
      await this.cartRepository.update(cart.id, { is_active: false });

      // 🚀 PUSH ORDER TO SELLER IMMEDIATELY
      try {
        // Get complete order data with relations for seller push
        const orderWithRelations = await this.orderRepository
          .createQueryBuilder('o')
          .leftJoinAndSelect('o.user', 'u')
          .leftJoinAndSelect('o.store', 's')
          .leftJoinAndSelect('o.delivery_address', 'da')
          .leftJoinAndSelect('o.order_items', 'oi')
          .leftJoinAndSelect('oi.item', 'i')
          .where('o.id = :orderId', { orderId: savedOrder.id })
          .getOne();

        if (orderWithRelations) {
          await this.sellerPushService.pushOrderToSeller(orderWithRelations);
          this.logger.log(`✅ Order ${savedOrder.order_number} pushed to seller successfully`);
        }
      } catch (sellerPushError) {
        this.logger.error(`❌ Failed to push order to seller: ${sellerPushError.message}`);
        // Don't fail order creation if seller push fails
      }

      // Get complete order data
      const orderData = await this.getOrderById(savedOrder.id, userId);

      // For COD orders, return immediately
      if (createOrderDto.payment_method === 'cod') {
        return {
          success: true,
          message: 'Order created successfully - Cash on Delivery',
          order: orderData,
          payment_required: false
        };
      }

      // For online payment, return order with payment_required flag
      return {
        success: true,
        message: 'Order created successfully - Payment required',
        order: orderData,
        payment_required: true,
        payment_amount: Math.round(cart.final_amount * 100), // in paise
        currency: 'INR'
      };
    } catch (error) {
      this.logger.error(`❌ Error creating order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: number, userId: number) {
    try {
      this.logger.log(`📋 Getting order ${orderId} for user ${userId}`);

      const order = await this.orderRepository
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.store', 's')
        .leftJoinAndSelect('o.delivery_address', 'da')
        .leftJoinAndSelect('o.order_items', 'oi')
        .leftJoinAndSelect('oi.item', 'i')
        .leftJoinAndSelect('o.tracking', 't')
        .leftJoin('o.user', 'u')
        .where('o.id = :orderId', { orderId })
        .andWhere('u.id = :userId', { userId })
        .orderBy('t.timestamp', 'ASC')
        .getOne();

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return await this.formatOrderData(order);
    } catch (error) {
      this.logger.error(`❌ Error getting order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: number, page: number = 1, limit: number = 10) {
    try {
      this.logger.log(`📋 Getting orders for user ${userId}, page ${page}`);

      const [orders, total] = await this.orderRepository
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.store', 's')
        .leftJoinAndSelect('o.delivery_address', 'da')
        .leftJoinAndSelect('o.order_items', 'oi')
        .leftJoinAndSelect('oi.item', 'i')
        .leftJoinAndSelect('o.tracking', 't')
        .leftJoin('o.user', 'u')
        .where('u.id = :userId', { userId })
        .orderBy('o.created_at', 'DESC')
        .addOrderBy('t.timestamp', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const formattedOrders = await Promise.all(orders.map(order => this.formatOrderData(order)));

      return {
        success: true,
        message: 'Orders retrieved successfully',
        data: formattedOrders,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        }
      };
    } catch (error) {
      this.logger.error(`❌ Error getting user orders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Initiate payment for an order
   */
  async initiatePayment(userId: number, orderId: number, customerDetails: any) {
    try {
      this.logger.log(`💳 Initiating payment for order ${orderId}`);

      // Get order
      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } },
        relations: ['store', 'user']
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.payment_status === 'paid') {
        throw new BadRequestException('Order is already paid');
      }

      if (order.status !== 'pending_payment') {
        throw new BadRequestException('Order is not in pending payment status');
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        Math.round(order.total_amount * 100), // Convert to paise
        'INR',
        order.order_number
      );

      // Create payment record
      const payment = this.paymentRepository.create({
        order: { id: order.id },
        user: { id: userId },
        payment_id: razorpayOrder.id, // Store Razorpay order ID temporarily
        payment_method: 'online',
        payment_status: 'pending',
        amount: order.total_amount,
        gateway: 'razorpay'
      });

      await this.paymentRepository.save(payment);

      const paymentDetails = {
        razorpay_order_id: razorpayOrder.id,
        amount: Math.round(order.total_amount * 100),
        currency: 'INR',
        key: this.razorpayService.getRazorpayKey(),
        name: order.store.name,
        description: `Order #${order.order_number}`,
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone
        }
      };

      return {
        success: true,
        message: 'Payment initiated successfully',
        payment_details: paymentDetails
      };
    } catch (error) {
      this.logger.error(`❌ Error initiating payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create payment for order (legacy method - kept for backward compatibility)
   */
  async createPayment(userId: number, createPaymentDto: CreatePaymentDto) {
    try {
      this.logger.log(`💳 Creating payment for order ${createPaymentDto.order_id}`);

      // Get order
      const order = await this.orderRepository.findOne({
        where: { id: createPaymentDto.order_id, user: { id: userId } },
        relations: ['store', 'user']
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.payment_status === 'paid') {
        throw new BadRequestException('Order is already paid');
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        createPaymentDto.amount,
        createPaymentDto.currency,
        order.order_number
      );

      // Create payment record
      const payment = this.paymentRepository.create({
        order: { id: order.id },
        user: { id: userId },
        payment_id: razorpayOrder.id, // Store Razorpay order ID temporarily
        payment_method: createPaymentDto.payment_method,
        payment_status: 'pending',
        amount: createPaymentDto.amount / 100, // Convert from paise to rupees
        gateway: 'razorpay'
      });

      await this.paymentRepository.save(payment);

      const paymentDetails = {
        razorpay_order_id: razorpayOrder.id,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency,
        key: this.razorpayService.getRazorpayKey(),
        name: order.store.name,
        description: `Order #${order.order_number}`,
        prefill: {
          name: createPaymentDto.customer_name,
          email: createPaymentDto.customer_email,
          contact: createPaymentDto.customer_phone
        }
      };

      return {
        success: true,
        message: 'Payment initiated successfully',
        payment_details: paymentDetails
      };
    } catch (error) {
      this.logger.error(`❌ Error creating payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(userId: number, orderId: number, cancelOrderDto: CancelOrderDto) {
    try {
      this.logger.log(`❌ Cancelling order ${orderId} for user ${userId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (['delivered', 'cancelled'].includes(order.status)) {
        throw new BadRequestException('Order cannot be cancelled');
      }

      // Update order status
      await this.orderRepository.update(orderId, {
        status: 'cancelled'
      });

      // Create tracking entry
      await this.createOrderTracking(orderId, 'cancelled', `Order cancelled: ${cancelOrderDto.reason || 'Customer request'}`);

      // If payment was made, initiate refund
      if (order.payment_status === 'paid' && order.payment_method === 'online') {
        // In a real app, you would initiate refund here
        this.logger.log(`💰 Refund initiated for order ${orderId}`);
      }

      return {
        success: true,
        message: 'Order cancelled successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error cancelling order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify payment manually (for mobile app)
   */
  async verifyPayment(userId: number, verifyPaymentDto: VerifyPaymentDto) {
    try {
      this.logger.log(`🔍 Verifying payment for user ${userId}`);
      this.logger.log(`🔍 Payment details: razorpay_order_id=${verifyPaymentDto.razorpay_order_id}, razorpay_payment_id=${verifyPaymentDto.razorpay_payment_id}`);

      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = verifyPaymentDto;

      // Verify payment signature
      const isValid = this.razorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        this.logger.error(`❌ Invalid payment signature`);
        throw new BadRequestException('Invalid payment signature');
      }

      this.logger.log(`✅ Payment signature verified`);

      // Find payment record by Razorpay order ID (payment_id temporarily stores razorpay_order_id)
      const payment = await this.paymentRepository
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.order', 'o')
        .leftJoin('o.user', 'u')
        .where('p.payment_id = :razorpayOrderId', { razorpayOrderId: razorpay_order_id })
        .andWhere('u.id = :userId', { userId })
        .getOne();

      if (!payment || !payment.order) {
        this.logger.error(`❌ Order not found for razorpay_order_id: ${razorpay_order_id}`);
        throw new NotFoundException('Order not found');
      }

      const order = payment.order;
      this.logger.log(`✅ Found order ${order.order_number} (ID: ${order.id})`);

      // Update payment record with actual payment ID
      await this.paymentRepository.update(payment.id, {
        payment_id: razorpay_payment_id,
        payment_status: 'paid'
      });

      // Update payment status
      await this.updatePaymentStatus(order.id, 'paid', razorpay_payment_id);

      // Update order status
      await this.updateOrderStatus(order.id, 'confirmed');

      this.logger.log(`✅ Payment verified successfully for order ${order.order_number}`);

      // Get updated order data
      const orderData = await this.getOrderById(order.id, userId);

      return {
        success: true,
        message: 'Payment verified successfully',
        payment_id: razorpay_payment_id,
        order: orderData
      };
    } catch (error) {
      this.logger.error(`❌ Error verifying payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(userId: number, orderId: number, failureReason?: string) {
    try {
      this.logger.log(`❌ Handling payment failure for order ${orderId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Update payment status to failed
      await this.updatePaymentStatus(order.id, 'failed');

      // Keep order in pending_payment status so user can retry
      await this.createOrderTracking(
        order.id, 
        'pending_payment', 
        `Payment failed: ${failureReason || 'Unknown error'}. You can retry payment.`
      );

      return {
        success: true,
        message: 'Payment failure recorded. You can retry payment.',
        order_id: orderId,
        can_retry: true
      };
    } catch (error) {
      this.logger.error(`❌ Error handling payment failure: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get orders pending payment
   */
  async getPendingPaymentOrders(userId: number) {
    try {
      this.logger.log(`📋 Getting pending payment orders for user ${userId}`);

      const orders = await this.orderRepository
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.store', 's')
        .leftJoinAndSelect('o.delivery_address', 'da')
        .leftJoinAndSelect('o.order_items', 'oi')
        .leftJoinAndSelect('oi.item', 'i')
        .leftJoin('o.user', 'u')
        .where('u.id = :userId', { userId })
        .andWhere('o.status = :status', { status: 'pending_payment' })
        .andWhere('o.payment_status = :paymentStatus', { paymentStatus: 'pending' })
        .orderBy('o.created_at', 'DESC')
        .getMany();

      const formattedOrders = await Promise.all(orders.map(order => this.formatOrderData(order)));

      return {
        success: true,
        message: 'Pending payment orders retrieved successfully',
        data: formattedOrders,
        count: formattedOrders.length
      };
    } catch (error) {
      this.logger.error(`❌ Error getting pending payment orders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(orderId: number, paymentStatus: string, paymentId?: string) {
    try {
      this.logger.log(`💳 Updating payment status for order ${orderId}: ${paymentStatus}`);

      const updateData: any = { payment_status: paymentStatus };
      if (paymentId) {
        updateData.payment_id = paymentId;
      }

      await this.orderRepository.update(orderId, updateData);

      // Create tracking entry
      await this.createOrderTracking(orderId, paymentStatus, `Payment ${paymentStatus}`);

      this.logger.log(`✅ Payment status updated for order ${orderId}`);
    } catch (error) {
      this.logger.error(`❌ Error updating payment status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string) {
    try {
      this.logger.log(`📋 Updating order status for order ${orderId}: ${status}`);

      await this.orderRepository.update(orderId, { status });

      // Create tracking entry
      await this.createOrderTracking(orderId, status, `Order ${status}`);

      this.logger.log(`✅ Order status updated for order ${orderId}`);
    } catch (error) {
      this.logger.error(`❌ Error updating order status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create order tracking entry
   */
  private async createOrderTracking(
    orderId: number, 
    status: string, 
    message: string, 
    agentDetails?: {
      name?: string;
      phone?: string;
      vehicle_number?: string;
      eta?: string;
      photo_url?: string;
    }
  ) {
    const tracking = this.orderTrackingRepository.create({
      order: { id: orderId },
      status,
      message,
      agent_name: agentDetails?.name,
      agent_phone: agentDetails?.phone,
      agent_vehicle_number: agentDetails?.vehicle_number,
      agent_eta: agentDetails?.eta,
      agent_photo_url: agentDetails?.photo_url,
      timestamp: new Date()
    });

    const savedTracking = await this.orderTrackingRepository.save(tracking);

    // Create notification for order status update
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['user', 'store'],
      });

      if (order && order.user) {
        await this.notificationService.createOrderNotification(
          order.user.id,
          orderId,
          status,
          message,
          {
            order_number: order.order_number,
            restaurant_name: order.store?.name,
            estimated_time: this.calculateEstimatedDeliveryTime(),
          }
        );
      }
    } catch (notificationError) {
      this.logger.error(`Failed to create notification for order tracking: ${notificationError.message}`, notificationError.stack);
      // Don't throw error - notification failure shouldn't break order tracking
    }

    return savedTracking;
  }

  /**
   * Generate order number
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `ORD-${year}${month}${day}-${random}`;
  }

  /**
   * Calculate estimated delivery time
   */
  private calculateEstimatedDeliveryTime(): Date {
    const now = new Date();
    const deliveryTime = new Date(now.getTime() + (45 * 60 * 1000)); // 45 minutes from now
    return deliveryTime;
  }

  /**
   * Format order data for response
   */
  private async formatOrderData(order: Order) {
    // Format order items with customizations
    const formattedItems = await Promise.all(
      (order.order_items || []).map(async (item) => {
        const formattedCustomizations = await this.formatCustomizations(item.customizations || []);
        
        return {
          id: item.id,
          item_id: item.item.id,
          item_name: item.item.name,
          item_description: item.item.short_desc,
          item_images: item.item.images || [],
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
          customizations: formattedCustomizations,
          variants: item.variants || [],
          special_instructions: item.special_instructions
        };
      })
    );

    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      overall_rating: order.overall_rating ? Number(order.overall_rating) : null,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      restaurant: {
        id: order.store.id,
        name: order.store.name,
        description: order.store.description,
        logo_url: order.store.logo_url,
        fssai_license: order.store.fssai_license_no,
        gst_number: order.store.gst_number
      },
      delivery_address: {
        id: order.delivery_address.id,
        address1: order.delivery_address.address1,
        address2: order.delivery_address.address2,
        address3: order.delivery_address.address3,
        city: order.delivery_address.city,
        state: order.delivery_address.state,
        pincode: order.delivery_address.pincode,
        latitude: order.delivery_address.latitude,
        longitude: order.delivery_address.longitude,
        type: order.delivery_address.type,
        alternate_phone_number: order.delivery_address.alternate_phone_number
      },
      items: formattedItems,
      summary: {
        subtotal: Number(order.subtotal),
        delivery_fee: Number(order.delivery_fee),
        tax_amount: Number(order.tax_amount),
        discount_amount: Number(order.discount_amount),
        total_amount: Number(order.total_amount)
      },
      notes: order.notes,
      estimated_delivery_time: order.estimated_delivery_time?.toISOString(),
      tracking: order.tracking?.map(t => ({
        id: t.id,
        status: t.status,
        message: t.message,
        timestamp: t.timestamp.toISOString(),
        agent_name: t.agent_name,
        agent_phone: t.agent_phone,
        agent_vehicle_number: t.agent_vehicle_number,
        agent_eta: t.agent_eta,
        agent_photo_url: t.agent_photo_url
      })) || [],
      created_at: order.created_at.toISOString(),
      updated_at: order.updated_at.toISOString(),
      // Invoice information
      invoice: {
        available: order.status === 'delivered' && order.delivered_at ? true : false,
        download_url: order.status === 'delivered' && order.delivered_at ? `/api/buyer/invoice/download/${order.id}` : null,
        data_url: order.status === 'delivered' && order.delivered_at ? `/api/buyer/invoice/data/${order.id}` : null
      }
    };
  }

  /**
   * Format customizations with names and prices
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
          .createQueryBuilder('icg')
          .leftJoin('icg.customization_group', 'cg')
          .where('cg.id = :groupId', { groupId: customization_group_id })
          .select(['cg.name'])
          .getOne();

        if (!selected_options || selected_options.length === 0) {
          return {
            customization_group_id,
            customization_group_name: customizationGroup?.customization_group?.name || 'Customizations',
            selected_options: []
          };
        }

        // Get selected options with names and prices
        const selectedOptions = await this.itemRepository
          .createQueryBuilder('item')
          .leftJoin('item.prices', 'price')
          .where('item.id IN (:...optionIds)', { optionIds: selected_options })
          .andWhere('item.type = :type', { type: 'customization' })
          .select(['item.id', 'item.name', 'price.base_price'])
          .getMany();

        const formattedOptions = selectedOptions.map(option => ({
          id: option.id,
          name: option.name,
          price: Number(option.prices?.[0]?.base_price || 0)
        }));

        return {
          customization_group_id,
          customization_group_name: customizationGroup?.customization_group?.name || 'Customizations',
          selected_options: formattedOptions
        };
      })
    );

    return formattedCustomizations;
  }

  /**
   * Update order status from seller webhook
   */
  async updateOrderStatusFromSeller(sellerStatusUpdateDto: SellerStatusUpdateDto) {
    try {
      this.logger.log(`🔄 Received seller status update for order ${sellerStatusUpdateDto.order_number}: ${sellerStatusUpdateDto.status}`);

      // Find order by order_number
      const order = await this.orderRepository
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.user', 'u')
        .leftJoinAndSelect('o.store', 's')
        .where('o.order_number = :orderNumber', { orderNumber: sellerStatusUpdateDto.order_number })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Order with number ${sellerStatusUpdateDto.order_number} not found`);
      }

      // Validate status transition
      this.sellerStatusService.validateSellerStatusUpdate(
        sellerStatusUpdateDto.order_number,
        order.status,
        sellerStatusUpdateDto.status
      );

      // Update order status
      const previousStatus = order.status;
      order.status = sellerStatusUpdateDto.status;

      // Set delivered_at timestamp if status is delivered
      if (sellerStatusUpdateDto.status === 'delivered') {
        order.delivered_at = new Date();
      }

      // Update estimated delivery time if provided
      if (sellerStatusUpdateDto.estimated_delivery_time) {
        order.estimated_delivery_time = new Date(sellerStatusUpdateDto.estimated_delivery_time);
      }

      await this.orderRepository.save(order);

      // Create tracking entry
      const statusMessage = this.sellerStatusService.getStatusMessage(sellerStatusUpdateDto.status);
      const fullMessage = sellerStatusUpdateDto.message 
        ? `${statusMessage}. ${sellerStatusUpdateDto.message}`
        : statusMessage;

      // Prepare agent details for storage
      const agentDetails = sellerStatusUpdateDto.agent_details ? {
        name: sellerStatusUpdateDto.agent_details.name,
        phone: sellerStatusUpdateDto.agent_details.phone,
        vehicle_number: sellerStatusUpdateDto.agent_details.vehicle_number,
        eta: sellerStatusUpdateDto.agent_details.eta,
        photo_url: sellerStatusUpdateDto.agent_details.photo_url
      } : undefined;

      await this.createOrderTracking(
        order.id, 
        sellerStatusUpdateDto.status, 
        fullMessage,
        agentDetails
      );

      // Send notification to user
      await this.notificationService.createNotification({
        user_id: order.user.id,
        title: `Order ${sellerStatusUpdateDto.status}`,
        message: fullMessage,
        type: 'order',
        data: {
          order_number: order.order_number,
          previous_status: previousStatus,
          new_status: sellerStatusUpdateDto.status
        }
      });

      this.logger.log(`✅ Order ${sellerStatusUpdateDto.order_number} status updated: ${previousStatus} → ${sellerStatusUpdateDto.status}`);

      return {
        success: true,
        message: 'Order status updated successfully',
        order_number: sellerStatusUpdateDto.order_number,
        previous_status: previousStatus,
        new_status: sellerStatusUpdateDto.status
      };

    } catch (error) {
      this.logger.error(`❌ Error updating order status from seller: ${error.message}`, error.stack);
      throw error;
    }
  }
}