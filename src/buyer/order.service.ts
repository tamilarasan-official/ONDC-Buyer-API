import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { OrderItem } from "../order/entities/order-item.entity";
import { OrderTracking } from "../order/entities/order-tracking.entity";
import { Payment } from "../payment/entities/payment.entity";
import { Cart } from "../cart/entities/cart.entity";
import { CartItem } from "../cart/entities/cart-item.entity";
import { UserAddress } from "../user/entities/user-address.entity";
import { User } from "../user/entities/user.entity";
import { Store } from "../store/entities/store.entity";
import { Item } from "../item/entities/item.entity";
import { ItemCustomizationGroups } from "../item/entities/item-customization-groups.entity";
import { RazorpayService } from "./razorpay.service";
import { NotificationService } from "./notification.service";
import { SellerPushService } from "./seller-push.service";
import { SellerStatusService } from "../shared/services/seller-status.service";
import {
  CreateOrderDto,
  CreatePaymentDto,
  VerifyPaymentDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from "./dto/order-request.dto";
import {
  SellerStatusUpdateDto,
  CancelReasonDto,
} from "./dto/seller-status-update.dto";
import { Coupon } from "../coupon/entities/coupon.entity";
import { CouponRedemption } from "../coupon/entities/coupon-redemption.entity";
import { CouponService } from "../coupon/services/coupon.service";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { CouponType } from "../coupon/entities/coupon.entity";
import { PaymentStatus } from "../coupon/dto/redeem-coupon.dto";

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
    @InjectRepository(CouponRedemption)
    private readonly couponRedemptionRepository: Repository<CouponRedemption>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly couponService: CouponService,
    private readonly redisCouponService: RedisCouponService,
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
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoin("c.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("c.is_active = :isActive", { isActive: true })
        .getOne();

      if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      // Get delivery address
      const deliveryAddress = await this.userAddressRepository.findOne({
        where: { id: createOrderDto.delivery_address_id, user: { id: userId } },
      });

      if (!deliveryAddress) {
        throw new NotFoundException("Delivery address not found");
      }

      // NEW: Re-validate preorder campaigns before checkout
      const preorderCartItems = cart.cart_items.filter(ci => ci.is_preorder);
      
      if (preorderCartItems.length > 0) {
        if (preorderCartItems.length > 1) {
          throw new BadRequestException(
            "Multiple preorder items found in cart. Only one preorder item is allowed."
          );
        }

        // Re-validate campaign status and quota
        const cartItem = preorderCartItems[0];
        const coupon = await this.couponRepository.findOne({
          where: {
            type: CouponType.PREORDER,
            id: cartItem.preorder_campaign_id || undefined,
          },
        });

        if (!coupon) {
          throw new BadRequestException(
            `Preorder campaign not found for item ${cartItem.item.id}`
          );
        }

        // Re-validate campaign is active (time-based)
        const now = new Date();
        if (coupon.start_at && now < coupon.start_at) {
          throw new BadRequestException("Preorder campaign has not started yet");
        }
        if (coupon.end_at && now > coupon.end_at) {
          throw new BadRequestException("Preorder campaign has ended");
        }

        // Re-validate quota
        const quota = await this.redisCouponService.getQuota(coupon.id);
        if (quota !== null && quota <= 0) {
          throw new BadRequestException("All preorder slots are taken");
        }

        // Reserve the single preorder item before creating order
        const reservationToken = await this.reservePreorderFromCart(
          userId,
          cartItem,
          deliveryAddress.pincode,
        );
        
        // Update cart item with reservation token
        cartItem.preorder_reservation_token = reservationToken;
        await this.cartItemRepository.save(cartItem);
      }

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order with appropriate status based on payment method
      const orderStatus =
        createOrderDto.payment_method === "cod"
          ? "confirmed"
          : "pending_payment";
      const paymentStatus =
        createOrderDto.payment_method === "cod" ? "pending" : "pending";

      // NEW: Calculate estimated delivery time - use preorder delivery date if order has preorder items
      let estimatedDeliveryTime: Date;
      if (preorderCartItems.length > 0) {
        // Get preorder delivery date from coupon
        const preorderCartItem = preorderCartItems[0];
        const preorderCoupon = await this.couponRepository.findOne({
          where: {
            type: CouponType.PREORDER,
            id: preorderCartItem.preorder_campaign_id || undefined,
          },
        });

        if (preorderCoupon?.type_meta?.delivery_date) {
          // Parse delivery_date which includes both date and time
          // Supports formats: "2025-02-11T12:00:00Z", "2025-02-11 12:00:00", "2025-02-11T12:00:00"
          const deliveryDateTimeStr = preorderCoupon.type_meta.delivery_date;
          
          // Try to parse as ISO datetime string
          estimatedDeliveryTime = new Date(deliveryDateTimeStr);
          
          // Validate the parsed date
          if (isNaN(estimatedDeliveryTime.getTime())) {
            // If parsing fails, try to parse as date-only and default to noon
            const dateOnlyMatch = deliveryDateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateOnlyMatch) {
              const [, year, month, day] = dateOnlyMatch.map(Number);
              estimatedDeliveryTime = new Date(year, month - 1, day, 12, 0, 0);
              this.logger.warn(
                `⚠️ Could not parse delivery_date time, using date with default 12:00 PM: ${deliveryDateTimeStr}`,
              );
            } else {
              // Fallback to default calculation
              estimatedDeliveryTime = this.calculateEstimatedDeliveryTime();
              this.logger.warn(
                `⚠️ Invalid delivery_date format, using default estimated delivery time: ${deliveryDateTimeStr}`,
              );
            }
          } else {
            this.logger.log(
              `📅 Preorder order: Using delivery date/time ${deliveryDateTimeStr} for estimated delivery time`,
            );
          }
        } else {
          // Fallback to default calculation if delivery_date not found
          estimatedDeliveryTime = this.calculateEstimatedDeliveryTime();
          this.logger.warn(
            `⚠️ Preorder coupon found but delivery_date not set, using default estimated delivery time`,
          );
        }
      } else {
        // Regular order - use default calculation
        estimatedDeliveryTime = this.calculateEstimatedDeliveryTime();
      }

      const order = this.orderRepository.create({
        order_number: orderNumber,
        user: { id: userId },
        store: { id: cart.store.id },
        // Copy address data for historical record keeping
        delivery_address_line1: deliveryAddress.address1,
        delivery_address_line2: deliveryAddress.address2,
        delivery_address_line3: deliveryAddress.address3,
        delivery_city: deliveryAddress.city,
        delivery_state: deliveryAddress.state,
        delivery_pincode: deliveryAddress.pincode,
        delivery_latitude: deliveryAddress.latitude,
        delivery_longitude: deliveryAddress.longitude,
        delivery_address_type: deliveryAddress.type,
        delivery_alternate_phone: deliveryAddress.alternate_phone_number,
        status: orderStatus,
        subtotal: cart.total_amount,
        delivery_fee: cart.delivery_fee,
        tax_amount: cart.tax_amount,
        discount_amount: cart.discount_amount,
        tip_amount: cart.tip_amount || 0,
        total_amount: cart.final_amount,
        payment_method: createOrderDto.payment_method,
        payment_status: paymentStatus,
        notes: createOrderDto.notes,
        estimated_delivery_time: estimatedDeliveryTime,
      });

      const savedOrder = await this.orderRepository.save(order);

      // Create order items from cart items
      const orderItems = cart.cart_items.map((cartItem) =>
        this.orderItemRepository.create({
          order: { id: savedOrder.id },
          item: { id: cartItem.item.id },
          quantity: cartItem.quantity,
          unit_price: cartItem.unit_price,
          total_price: cartItem.total_price,
          customizations: cartItem.customizations,
          variants: cartItem.variants,
          special_instructions: cartItem.special_instructions, // Include special instructions
          is_preorder: cartItem.is_preorder || false, // NEW
          preorder_campaign_id: cartItem.preorder_campaign_id, // NEW
        }),
      );

      await this.orderItemRepository.save(orderItems);

      // NEW: If preorder, redeem coupon after order is created
      const preorderCartItemsForRedemption = cart.cart_items.filter(ci => ci.is_preorder && ci.preorder_reservation_token);

      for (const cartItem of preorderCartItemsForRedemption) {
        if (cartItem.preorder_reservation_token) {
          await this.couponService.redeemCoupon({
            reservation_token: cartItem.preorder_reservation_token,
            order_id: savedOrder.id,
            user_id: userId,
            payment_status: createOrderDto.payment_method === "cod" 
              ? PaymentStatus.PAID 
              : PaymentStatus.FAILED, // Will be updated on payment success
            // Note: idempotency_key is optional but recommended for idempotency
          });
        }
      }

      // Create initial tracking entry
      const trackingMessage =
        createOrderDto.payment_method === "cod"
          ? "Order placed successfully - Cash on Delivery"
          : "Order placed successfully - Payment pending";
      await this.createOrderTracking(
        savedOrder.id,
        orderStatus,
        trackingMessage,
      );

      // Deactivate cart
      await this.cartRepository.update(cart.id, { is_active: false });

      // 🚀 PUSH ORDER TO SELLER IMMEDIATELY
      try {
        // Get complete order data with relations for seller push
        const orderWithRelations = await this.orderRepository
          .createQueryBuilder("o")
          .leftJoinAndSelect("o.user", "u")
          .leftJoinAndSelect("o.store", "s")
          .leftJoinAndSelect("o.order_items", "oi")
          .leftJoinAndSelect("oi.item", "i")
          .where("o.id = :orderId", { orderId: savedOrder.id })
          .getOne();

        if (orderWithRelations && orderWithRelations.status === "confirmed") {
          const response = await this.sellerPushService.pushOrderToSeller(orderWithRelations);
          console.log("SELLER PUSH RESPONSE:", response);
          this.logger.log(
            `✅ Order ${savedOrder.order_number} pushed to seller successfully`,
          );
        }
      } catch (sellerPushError) {
        this.logger.error(
          `❌ Failed to push order to seller: ${sellerPushError.message}`,
        );
        // Don't fail order creation if seller push fails
      }

      // Get complete order data
      const orderData = await this.getOrderById(savedOrder.id, userId);

      // For COD orders, return immediately
      if (createOrderDto.payment_method === "cod") {
        return {
          success: true,
          message: "Order created successfully - Cash on Delivery",
          order: orderData,
          payment_required: false,
        };
      }

      // For online payment, return order with payment_required flag
      return {
        success: true,
        message: "Order created successfully - Payment required",
        order: orderData,
        payment_required: true,
        payment_amount: Math.round(cart.final_amount * 100), // in paise
        currency: "INR",
      };
    } catch (error) {
      this.logger.error(
        `❌ Error creating order: ${error.message}`,
        error.stack,
      );
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
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.store", "s")
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoinAndSelect("o.tracking", "t")
        .leftJoin("o.user", "u")
        .where("o.id = :orderId", { orderId })
        .andWhere("u.id = :userId", { userId })
        .orderBy("t.timestamp", "ASC")
        .getOne();

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      return await this.formatOrderData(order);
    } catch (error) {
      this.logger.error(
        `❌ Error getting order: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: number, page: number = 1, limit: number = 10) {
    try {
      this.logger.log(`📋 Getting orders for user ${userId}, page ${page}, limit ${limit}`);

      // Step 1: Get paginated order IDs and total count (without joins to avoid duplication)
      const [paginatedOrders, total] = await Promise.all([
        this.orderRepository
          .createQueryBuilder("o")
          .leftJoin("o.user", "u")
          .where("u.id = :userId", { userId })
          .orderBy("o.created_at", "DESC")
          .skip((page - 1) * limit)
          .take(limit)
          .getMany(),
        this.orderRepository
          .createQueryBuilder("o")
          .leftJoin("o.user", "u")
          .where("u.id = :userId", { userId })
          .getCount(),
      ]);

      this.logger.log(`📊 Found ${paginatedOrders.length} orders on page ${page} of ${total} total`);
      this.logger.log(`🔍 First order ID sample: ${JSON.stringify(paginatedOrders[0]?.id)}`);

      // If no orders found, return empty result
      if (paginatedOrders.length === 0) {
        return {
          success: true,
          message: "Orders retrieved successfully",
          data: [],
          meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            has_next: false,
            has_prev: page > 1,
          },
        };
      }

      // Step 2: Extract IDs from paginated orders
      const ids = paginatedOrders.map((order) => order.id).filter((id) => id !== undefined && id !== null);
      this.logger.log(`📌 Order IDs to fetch (${ids.length}): ${JSON.stringify(ids)}`);

      // Safety check: if no valid IDs, return empty
      if (ids.length === 0) {
        this.logger.warn(`⚠️ No valid IDs extracted from orderIds`);
        return {
          success: true,
          message: "Orders retrieved successfully",
          data: [],
          meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            has_next: false,
            has_prev: page > 1,
          },
        };
      }

      const orders = await this.orderRepository
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.store", "s")
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoinAndSelect("o.tracking", "t")
        .where("o.id IN (:...ids)", { ids })
        .orderBy("o.created_at", "DESC")
        .addOrderBy("t.timestamp", "ASC")
        .getMany();

      this.logger.log(`✅ Loaded ${orders.length} orders with relations`);

      // Step 3: Format orders
      const formattedOrders = await Promise.all(
        orders.map((order) => this.formatOrderData(order)),
      );

      return {
        success: true,
        message: "Orders retrieved successfully",
        data: formattedOrders,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting user orders: ${error.message}`,
        error.stack,
      );
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
        relations: ["store", "user"],
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.payment_status === "paid") {
        throw new BadRequestException("Order is already paid");
      }

      if (order.status !== "pending_payment") {
        throw new BadRequestException("Order is not in pending payment status");
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        Math.round(order.total_amount * 100), // Convert to paise
        "INR",
        order.order_number,
      );

      // Create payment record
      const payment = this.paymentRepository.create({
        order: { id: order.id },
        user: { id: userId },
        payment_id: razorpayOrder.id, // Store Razorpay order ID temporarily
        payment_method: "online",
        payment_status: "pending",
        amount: order.total_amount,
        gateway: "razorpay",
      });

      await this.paymentRepository.save(payment);

      const paymentDetails = {
        razorpay_order_id: razorpayOrder.id,
        amount: Math.round(order.total_amount * 100),
        currency: "INR",
        key: this.razorpayService.getRazorpayKey(),
        name: order.store.name,
        description: `Order #${order.order_number}`,
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone,
        },
      };

      return {
        success: true,
        message: "Payment initiated successfully",
        payment_details: paymentDetails,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error initiating payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create payment for order (legacy method - kept for backward compatibility)
   */
  async createPayment(userId: number, createPaymentDto: CreatePaymentDto) {
    try {
      this.logger.log(
        `💳 Creating payment for order ${createPaymentDto.order_id}`,
      );

      // Get order
      const order = await this.orderRepository.findOne({
        where: { id: createPaymentDto.order_id, user: { id: userId } },
        relations: ["store", "user"],
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.payment_status === "paid") {
        throw new BadRequestException("Order is already paid");
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        createPaymentDto.amount,
        createPaymentDto.currency,
        order.order_number,
      );

      // Create payment record
      const payment = this.paymentRepository.create({
        order: { id: order.id },
        user: { id: userId },
        payment_id: razorpayOrder.id, // Store Razorpay order ID temporarily
        payment_method: createPaymentDto.payment_method,
        payment_status: "pending",
        amount: createPaymentDto.amount / 100, // Convert from paise to rupees
        gateway: "razorpay",
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
          contact: createPaymentDto.customer_phone,
        },
      };

      return {
        success: true,
        message: "Payment initiated successfully",
        payment_details: paymentDetails,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error creating payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    userId: number,
    orderId: number,
    cancelOrderDto: CancelOrderDto,
  ) {
    try {
      this.logger.log(`❌ Cancelling order ${orderId} for user ${userId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (["delivered", "cancelled"].includes(order.status)) {
        throw new BadRequestException("Order cannot be cancelled");
      }

      // Update order status
      await this.orderRepository.update(orderId, {
        status: "cancelled",
      });

      // NEW: Restore quota for preorder items
      const orderItems = await this.orderItemRepository.find({
        where: { order: { id: orderId } },
        relations: ['item'],
      });

      for (const orderItem of orderItems) {
        if (orderItem.is_preorder) {
          // Find the coupon redemption for this order
          const couponRedemption = await this.couponRedemptionRepository.findOne({
            where: { order_id: orderId },
            relations: ['coupon'],
          });

          if (couponRedemption && couponRedemption.coupon.type === CouponType.PREORDER) {
            // Restore quota in Redis
            await this.redisCouponService.incrementQuota(couponRedemption.coupon.id, 1);
            
            this.logger.log(
              `✅ Restored quota for preorder coupon ${couponRedemption.coupon.id} after order cancellation`
            );
          }
        }
      }

      // Create tracking entry
      await this.createOrderTracking(
        orderId,
        "cancelled",
        `Order cancelled: ${cancelOrderDto.reason || "Customer request"}`,
      );

      // If payment was made, initiate refund
      if (
        order.payment_status === "paid" &&
        order.payment_method === "online"
      ) {
        // In a real app, you would initiate refund here
        this.logger.log(`💰 Refund initiated for order ${orderId}`);
      }

      return {
        success: true,
        message: "Order cancelled successfully",
      };
    } catch (error) {
      this.logger.error(
        `❌ Error cancelling order: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Verify payment manually (for mobile app)
   */
  async verifyPayment(userId: number, verifyPaymentDto: VerifyPaymentDto) {
    try {
      this.logger.log(`🔍 Verifying payment for user ${userId}`);
      this.logger.log(
        `🔍 Payment details: razorpay_order_id=${verifyPaymentDto.razorpay_order_id}, razorpay_payment_id=${verifyPaymentDto.razorpay_payment_id}`,
      );

      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
        verifyPaymentDto;

      // Verify payment signature
      const isValid = this.razorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      if (!isValid) {
        this.logger.error(`❌ Invalid payment signature`);
        throw new BadRequestException("Invalid payment signature");
      }

      this.logger.log(`✅ Payment signature verified`);

      // Find payment record by Razorpay order ID (payment_id temporarily stores razorpay_order_id)
      const payment = await this.paymentRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.order", "o")
        .leftJoin("o.user", "u")
        .where("p.payment_id = :razorpayOrderId", {
          razorpayOrderId: razorpay_order_id,
        })
        .andWhere("u.id = :userId", { userId })
        .getOne();

      if (!payment || !payment.order) {
        this.logger.error(
          `❌ Order not found for razorpay_order_id: ${razorpay_order_id}`,
        );
        throw new NotFoundException("Order not found");
      }

      const order = payment.order;
      this.logger.log(`✅ Found order ${order.order_number} (ID: ${order.id})`);

      // Update payment record with actual payment ID
      await this.paymentRepository.update(payment.id, {
        payment_id: razorpay_payment_id,
        payment_status: "paid",
      });

      // Update payment status
      await this.updatePaymentStatus(order.id, "paid", razorpay_payment_id);

      // Update order status
      await this.updateOrderStatus(order.id, "confirmed");

      this.logger.log(
        `✅ Payment verified successfully for order ${order.order_number}`,
      );

      // Get updated order data
      const orderData = await this.getOrderById(order.id, userId);

      return {
        success: true,
        message: "Payment verified successfully",
        payment_id: razorpay_payment_id,
        order: orderData,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error verifying payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(
    userId: number,
    orderId: number,
    failureReason?: string,
  ) {
    try {
      this.logger.log(`❌ Handling payment failure for order ${orderId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Update payment status to failed
      await this.updatePaymentStatus(order.id, "failed");

      // NEW: Release reservations for preorder items on payment failure
      const orderItems = await this.orderItemRepository.find({
        where: { order: { id: orderId } },
        relations: ['item'],
      });

      for (const orderItem of orderItems) {
        if (orderItem.is_preorder) {
          // Find the coupon redemption for this order
          const couponRedemption = await this.couponRedemptionRepository.findOne({
            where: { order_id: orderId },
            relations: ['coupon'],
          });

          if (couponRedemption && couponRedemption.reserved_token) {
            // Release reservation and restore quota
            await this.redisCouponService.releaseReservation(
              couponRedemption.coupon_id,
              couponRedemption.reserved_token
            );
            
            this.logger.log(
              `✅ Released reservation for preorder coupon ${couponRedemption.coupon_id} after payment failure`
            );
          }
        }
      }

      // Keep order in pending_payment status so user can retry
      await this.createOrderTracking(
        order.id,
        "pending_payment",
        `Payment failed: ${failureReason || "Unknown error"}. You can retry payment.`,
      );

      return {
        success: true,
        message: "Payment failure recorded. You can retry payment.",
        order_id: orderId,
        can_retry: true,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error handling payment failure: ${error.message}`,
        error.stack,
      );
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
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.store", "s")
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoin("o.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("o.status = :status", { status: "pending_payment" })
        .andWhere("o.payment_status = :paymentStatus", {
          paymentStatus: "pending",
        })
        .orderBy("o.created_at", "DESC")
        .getMany();

      const formattedOrders = await Promise.all(
        orders.map((order) => this.formatOrderData(order)),
      );

      return {
        success: true,
        message: "Pending payment orders retrieved successfully",
        data: formattedOrders,
        count: formattedOrders.length,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting pending payment orders: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: number,
    paymentStatus: string,
    paymentId?: string,
  ) {
    try {
      this.logger.log(
        `💳 Updating payment status for order ${orderId}: ${paymentStatus}`,
      );

      // Update order payment status (Order table only has payment_status field)
      await this.orderRepository.update(orderId, {
        payment_status: paymentStatus,
      });

      // If paymentId is provided, update it in the Payment table (not Order table)
      if (paymentId) {
        await this.paymentRepository.update(
          { order: { id: orderId } },
          {
            payment_id: paymentId,
            payment_status:
              paymentStatus === "paid" ? "success" : paymentStatus,
          },
        );
      }

      // Create tracking entry
      await this.createOrderTracking(
        orderId,
        paymentStatus,
        `Payment ${paymentStatus}`,
      );

      this.logger.log(`✅ Payment status updated for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Error updating payment status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string) {
    try {
      this.logger.log(
        `📋 Updating order status for order ${orderId}: ${status}`,
      );

      await this.orderRepository.update(orderId, { status });

      // Push order to seller if status is confirmed
      if (status === "confirmed") {
        const orderWithRelations = await this.orderRepository
          .createQueryBuilder("o")
          .leftJoinAndSelect("o.user", "u")
          .leftJoinAndSelect("o.store", "s")
          .leftJoinAndSelect("o.order_items", "oi")
          .leftJoinAndSelect("oi.item", "i")
          .where("o.id = :orderId", { orderId: orderId })
          .getOne();

        if(orderWithRelations && orderWithRelations.status === "confirmed") {
          try {
            const response = await this.sellerPushService.pushOrderToSeller(orderWithRelations);
            console.log("SELLER PUSH RESPONSE:", response);
            this.logger.log(
              `✅ Order ${orderId} status updated to ${status} and pushed to seller successfully`,
            );
          } catch (error) {
            this.logger.error(
              `❌ Error pushing order ${orderId} to seller: ${error.message}`,
              error.stack,
            );
          }
        }
        else {
          this.logger.error(
            `❌ Order ${orderId} not found or status is not confirmed`,
          );
        }
      }

      // Create tracking entry
      await this.createOrderTracking(orderId, status, `Order ${status}`);

      this.logger.log(`✅ Order status updated for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Error updating order status: ${error.message}`,
        error.stack,
      );
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
      timestamps?: any;
      status_history?: any;
      current_location?: any;
    },
    trackingUrl?: string,
    deliveryCode?: string,
    cancelReason?: CancelReasonDto,
  ) {
    // Extract only code, reason, and cancelled_by from cancelReason
    const cancelReasonToSave = cancelReason
      ? {
          code: cancelReason.code,
          reason: cancelReason.reason,
          cancelled_by: cancelReason.cancelled_by,
        }
      : undefined;

    const tracking = this.orderTrackingRepository.create({
      order: { id: orderId },
      status,
      message,
      agent_name: agentDetails?.name,
      agent_phone: agentDetails?.phone,
      agent_vehicle_number: agentDetails?.vehicle_number,
      agent_eta: agentDetails?.eta,
      agent_photo_url: agentDetails?.photo_url,
      agent_details_json: agentDetails || null, // Store complete agent details
      tracking_url: trackingUrl || undefined,
      delivery_code: deliveryCode || undefined,
      cancel_reason: cancelReasonToSave,
      timestamp: new Date(),
    });

    const savedTracking = await this.orderTrackingRepository.save(tracking);

    // Create notification for order status update
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ["user", "store"],
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
          },
        );
      }
    } catch (notificationError) {
      this.logger.error(
        `Failed to create notification for order tracking: ${notificationError.message}`,
        notificationError.stack,
      );
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
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    return `ORD-${year}${month}${day}-${random}`;
  }

  /**
   * Calculate estimated delivery time
   */
  private calculateEstimatedDeliveryTime(): Date {
    const now = new Date();
    const deliveryTime = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now
    return deliveryTime;
  }

  /**
   * Format order data for response
   */
  private async formatOrderData(order: Order) {
    // Format order items with customizations and preorder details
    const formattedItems = await Promise.all(
      (order.order_items || []).map(async (item) => {
        const formattedCustomizations = await this.formatCustomizations(
          item.customizations || [],
        );

        const itemPayload: any = {
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
          special_instructions: item.special_instructions,
        };

        // NEW: Add preorder details if this is a preorder item
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
                campaign_id: preorderCoupon.campaign_id,
                title: preorderCoupon.type_meta.title || "Preorder",
                delivery_date: preorderCoupon.type_meta.delivery_date,
                available_slots: availableSlots,
                free_delivery: preorderCoupon.type_meta.free_delivery === true,
              };
            }
          } catch (error) {
            this.logger.warn(
              `Could not fetch preorder coupon ${item.preorder_campaign_id}: ${error.message}`,
            );
          }
        }

        return itemPayload;
      }),
    );

    // NEW: Check if order has any preorder items
    const hasPreorderItems = order.order_items?.some(
      (item) => item.is_preorder === true,
    );

    // NEW: Get preorder delivery date (from first preorder item)
    let preorderDeliveryDate: string | undefined;
    if (hasPreorderItems) {
      const firstPreorderItem = order.order_items?.find(
        (item) => item.is_preorder === true && item.preorder_campaign_id,
      );
      if (firstPreorderItem?.preorder_campaign_id) {
        try {
          const preorderCoupon = await this.couponRepository.findOne({
            where: { id: firstPreorderItem.preorder_campaign_id },
          });
          if (preorderCoupon?.type_meta?.delivery_date) {
            preorderDeliveryDate = preorderCoupon.type_meta.delivery_date;
          }
        } catch (error) {
          this.logger.warn(
            `Could not fetch preorder delivery date: ${error.message}`,
          );
        }
      }
    }

    const orderData: any = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      overall_rating: order.overall_rating
        ? Number(order.overall_rating)
        : null,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      restaurant: {
        id: order.store.id,
        name: order.store.name,
        description: order.store.description,
        logo_url: order.store.logo_url,
        fssai_license: order.store.fssai_license_no,
        gst_number: order.store.gst_number,
      },
      delivery_address: {
        address1: order.delivery_address_line1,
        address2: order.delivery_address_line2,
        address3: order.delivery_address_line3,
        city: order.delivery_city,
        state: order.delivery_state,
        pincode: order.delivery_pincode,
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        type: order.delivery_address_type,
        alternate_phone_number: order.delivery_alternate_phone,
      },
      items: formattedItems,
      summary: {
        subtotal: Number(order.subtotal),
        delivery_fee: Number(order.delivery_fee),
        tax_amount: Number(order.tax_amount),
        discount_amount: Number(order.discount_amount),
        tip_amount: Number(order.tip_amount || 0),
        total_amount: Number(order.total_amount),
      },
      notes: order.notes,
      estimated_delivery_time: order.estimated_delivery_time?.toISOString(),
      // Extract cancel_reason from tracking if order is cancelled
      cancel_reason: order.status === "cancelled" && order.tracking
        ? (() => {
            const cancelledTracking = order.tracking.find(
              (t) => t.status === "cancelled",
            );
            return cancelledTracking?.cancel_reason || null;
          })()
        : undefined,
      tracking:
        order.tracking?.map((t) => ({
          id: t.id,
          status: t.status,
          message: t.message,
          timestamp: t.timestamp.toISOString(),
          agent_name: t.agent_name,
          agent_phone: t.agent_phone,
          agent_vehicle_number: t.agent_vehicle_number,
          agent_eta: t.agent_eta,
          agent_photo_url: t.agent_photo_url,
          tracking_url: t.tracking_url,
          delivery_code: t.delivery_code,
          cancel_reason: t.cancel_reason,
        })) || [],
      tracking_url: order.tracking && order.tracking.length > 0 
        ? order.tracking[order.tracking.length - 1].tracking_url 
        : null,
      delivery_code: order.tracking && order.tracking.length > 0
        ? (() => {
            // Find the most recent tracking event that has a delivery_code
            const trackingWithCode = [...order.tracking]
              .reverse()
              .find((t) => t.delivery_code);
            return trackingWithCode?.delivery_code || null;
          })()
        : null,
      created_at: order.created_at.toISOString(),
      updated_at: order.updated_at.toISOString(),
      // Invoice information
      invoice: {
        available:
          order.status === "delivered" && order.delivered_at ? true : false,
        download_url:
          order.status === "delivered" && order.delivered_at
            ? `/api/buyer/invoice/download/${order.id}`
            : null,
        data_url:
          order.status === "delivered" && order.delivered_at
            ? `/api/buyer/invoice/data/${order.id}`
            : null,
      },
    };

    // NEW: Add preorder fields if order has preorder items
    if (hasPreorderItems) {
      orderData.has_preorder_items = true;
      if (preorderDeliveryDate) {
        orderData.preorder_delivery_date = preorderDeliveryDate;
      }
    }

    return orderData;
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
   * Update order status from seller webhook
   */
  async updateOrderStatusFromSeller(
    sellerStatusUpdateDto: SellerStatusUpdateDto,
  ) {
    try {
      this.logger.log(
        `🔄 Received seller status update for order ${sellerStatusUpdateDto.order_number}: ${sellerStatusUpdateDto.status}`,
      );

      // Find order by order_number
      const order = await this.orderRepository
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.user", "u")
        .leftJoinAndSelect("o.store", "s")
        .where("o.order_number = :orderNumber", {
          orderNumber: sellerStatusUpdateDto.order_number,
        })
        .getOne();

      if (!order) {
        throw new NotFoundException(
          `Order with number ${sellerStatusUpdateDto.order_number} not found`,
        );
      }

      // Validate status transition
      this.sellerStatusService.validateSellerStatusUpdate(
        sellerStatusUpdateDto.order_number,
        order.status,
        sellerStatusUpdateDto.status,
      );

      // Update order status
      const previousStatus = order.status;
      order.status = sellerStatusUpdateDto.status;

      // Set delivered_at timestamp if status is delivered
      if (sellerStatusUpdateDto.status === "delivered") {
        order.delivered_at = new Date();
      }

      // Update estimated delivery time if provided
      if (sellerStatusUpdateDto.estimated_delivery_time) {
        order.estimated_delivery_time = new Date(
          sellerStatusUpdateDto.estimated_delivery_time,
        );
      }

      await this.orderRepository.save(order);

      // Create tracking entry
      const statusMessage = this.sellerStatusService.getStatusMessage(
        sellerStatusUpdateDto.status,
      );
      const fullMessage = sellerStatusUpdateDto.message
        ? `${statusMessage}. ${sellerStatusUpdateDto.message}`
        : statusMessage;

      // Prepare agent details for storage
      const agentDetails = sellerStatusUpdateDto.agent_details
        ? {
            name: sellerStatusUpdateDto.agent_details.name,
            phone: sellerStatusUpdateDto.agent_details.phone,
            vehicle_number: sellerStatusUpdateDto.agent_details.vehicle_number,
            eta: sellerStatusUpdateDto.agent_details.eta,
            photo_url: sellerStatusUpdateDto.agent_details.photo_url,
          }
        : undefined;

      await this.createOrderTracking(
        order.id,
        sellerStatusUpdateDto.status,
        fullMessage,
        agentDetails,
        sellerStatusUpdateDto.tracking_url,
        sellerStatusUpdateDto.delivery_code,
        sellerStatusUpdateDto.status === "cancelled"
          ? sellerStatusUpdateDto.cancel_reason
          : undefined,
      );

      // Send notification to user
      await this.notificationService.createNotification({
        user_id: order.user.id,
        title: `Order ${sellerStatusUpdateDto.status}`,
        message: fullMessage,
        type: "order",
        data: {
          order_number: order.order_number,
          previous_status: previousStatus,
          new_status: sellerStatusUpdateDto.status,
        },
      });

      this.logger.log(
        `✅ Order ${sellerStatusUpdateDto.order_number} status updated: ${previousStatus} → ${sellerStatusUpdateDto.status}`,
      );

      return {
        success: true,
        message: "Order status updated successfully",
        order_number: sellerStatusUpdateDto.order_number,
        previous_status: previousStatus,
        new_status: sellerStatusUpdateDto.status,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error updating order status from seller: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Reserve preorder item from cart
   */
  private async reservePreorderFromCart(
    userId: number,
    cartItem: CartItem,
    pincode: string,
  ): Promise<string> {
    // Find PREORDER coupon
    const coupon = await this.couponRepository.findOne({
      where: {
        type: CouponType.PREORDER,
        id: cartItem.preorder_campaign_id || undefined,
      },
    });

    if (!coupon) {
      throw new BadRequestException(
        `Preorder campaign not found for item ${cartItem.item.id}`,
      );
    }

    // Reserve coupon using correct DTO structure
    const reservation = await this.couponService.reserveCoupon({
      code: coupon.code,
      user_id: userId,
      store_id: cartItem.cart.store.id,
      cart_total: cartItem.total_price,
      pincode: pincode, // Required field
    });

    // reserveCoupon returns { reservation_token, expires_in_seconds }
    return reservation.reservation_token;
  }
}
