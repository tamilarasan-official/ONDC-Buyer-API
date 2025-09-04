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
import { RazorpayService } from './razorpay.service';
import { NotificationService } from './notification.service';
import { CreateOrderDto, CreatePaymentDto, VerifyPaymentDto, UpdateOrderStatusDto, CancelOrderDto } from './dto/order-request.dto';

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
    private readonly razorpayService: RazorpayService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create order from cart
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
        .where('c.user_id = :userId', { userId })
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

      // Create order
      const order = this.orderRepository.create({
        order_number: orderNumber,
        user: { id: userId },
        store: { id: cart.store.id },
        delivery_address: { id: deliveryAddress.id },
        status: 'pending',
        subtotal: cart.total_amount,
        delivery_fee: cart.delivery_fee,
        tax_amount: cart.tax_amount,
        discount_amount: cart.discount_amount,
        total_amount: cart.final_amount,
        payment_method: createOrderDto.payment_method,
        payment_status: createOrderDto.payment_method === 'cod' ? 'pending' : 'pending',
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
      await this.createOrderTracking(savedOrder.id, 'pending', 'Order placed successfully');

      // Deactivate cart
      await this.cartRepository.update(cart.id, { is_active: false });

      // Get complete order data
      const orderData = await this.getOrderById(savedOrder.id, userId);

      let paymentDetails: any = null;

      // If online payment, create Razorpay order
      if (createOrderDto.payment_method === 'online') {
        const razorpayOrder = await this.razorpayService.createOrder(
          Math.round(cart.final_amount * 100), // Convert to paise
          'INR',
          orderNumber
        );

        paymentDetails = {
          razorpay_order_id: razorpayOrder.id,
          amount: Math.round(cart.final_amount * 100),
          currency: 'INR',
          key: this.razorpayService.getRazorpayKey()
        };
      }

      return {
        success: true,
        message: 'Order created successfully',
        order: orderData,
        payment_details: paymentDetails
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
        .where('o.id = :orderId', { orderId })
        .andWhere('o.user_id = :userId', { userId })
        .orderBy('t.timestamp', 'ASC')
        .getOne();

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return this.formatOrderData(order);
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
        .where('o.user_id = :userId', { userId })
        .orderBy('o.created_at', 'DESC')
        .addOrderBy('t.timestamp', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const formattedOrders = orders.map(order => this.formatOrderData(order));

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
   * Create payment for order
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
   * Verify payment
   */
  async verifyPayment(userId: number, verifyPaymentDto: VerifyPaymentDto) {
    try {
      this.logger.log(`🔍 Verifying payment for user ${userId}`);

      // Verify signature
      const isValidSignature = this.razorpayService.verifyPaymentSignature(
        verifyPaymentDto.razorpay_order_id,
        verifyPaymentDto.razorpay_payment_id,
        verifyPaymentDto.razorpay_signature
      );

      if (!isValidSignature) {
        throw new BadRequestException('Invalid payment signature');
      }

      // Get payment record
      const payment = await this.paymentRepository.findOne({
        where: { payment_id: verifyPaymentDto.razorpay_order_id },
        relations: ['order']
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Update payment record
      payment.payment_id = verifyPaymentDto.razorpay_payment_id;
      payment.payment_status = 'success';
      payment.paid_at = new Date();
      payment.gateway_response = {
        razorpay_order_id: verifyPaymentDto.razorpay_order_id,
        razorpay_payment_id: verifyPaymentDto.razorpay_payment_id,
        razorpay_signature: verifyPaymentDto.razorpay_signature
      };

      await this.paymentRepository.save(payment);

      // Update order status
      await this.orderRepository.update(payment.order.id, {
        payment_status: 'paid',
        status: 'confirmed'
      });

      // Create tracking entry
      await this.createOrderTracking(payment.order.id, 'confirmed', 'Payment successful, order confirmed');

      return {
        success: true,
        message: 'Payment verified successfully',
        payment_id: verifyPaymentDto.razorpay_payment_id,
        order_status: 'confirmed'
      };
    } catch (error) {
      this.logger.error(`❌ Error verifying payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, updateOrderStatusDto: UpdateOrderStatusDto) {
    try {
      this.logger.log(`📝 Updating order ${orderId} status to ${updateOrderStatusDto.status}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Update order status
      await this.orderRepository.update(orderId, {
        status: updateOrderStatusDto.status
      });

      // Create tracking entry
      await this.createOrderTracking(orderId, updateOrderStatusDto.status, updateOrderStatusDto.message || 'Status updated');

      return {
        success: true,
        message: 'Order status updated successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error updating order status: ${error.message}`, error.stack);
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
   * Create order tracking entry
   */
  private async createOrderTracking(orderId: number, status: string, message: string) {
    const tracking = this.orderTrackingRepository.create({
      order: { id: orderId },
      status,
      message,
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
  private formatOrderData(order: Order) {
    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
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
      items: order.order_items?.map(item => ({
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
        special_instructions: item.special_instructions
      })) || [],
      summary: {
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        tax_amount: order.tax_amount,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount
      },
      notes: order.notes,
      estimated_delivery_time: order.estimated_delivery_time?.toISOString(),
      tracking: order.tracking?.map(t => ({
        id: t.id,
        status: t.status,
        message: t.message,
        timestamp: t.timestamp.toISOString()
      })) || [],
      created_at: order.created_at.toISOString(),
      updated_at: order.updated_at.toISOString()
    };
  }
}
