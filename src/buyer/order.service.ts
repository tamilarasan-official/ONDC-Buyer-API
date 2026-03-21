import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
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
import { CartService } from "./cart.service";
import { SellerStatusService } from "../shared/services/seller-status.service";
import { AppOperationHoursService } from "../shared/services/app-operation-hours.service";
import { AppServiceableAreaService } from "../shared/services/app-serviceable-area.service";
import {
  CreateOrderDto,
  CreatePaymentDto,
  VerifyPaymentDto,
  UpdateOrderStatusDto,
} from "./dto/order-request.dto";
import {
  SellerStatusUpdateDto,
  CancelReasonDto,
} from "./dto/seller-status-update.dto";
import { Coupon } from "../coupon/entities/coupon.entity";
import {
  CouponRedemption,
  RedemptionStatus,
} from "../coupon/entities/coupon-redemption.entity";
import { CouponService } from "../coupon/services/coupon.service";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { CouponType } from "../coupon/entities/coupon.entity";
import { PaymentStatus } from "../coupon/dto/redeem-coupon.dto";
import { TimezoneUtil } from "../shared/utils/timezone.util";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { OrderCancelDto } from "./dto/cancel-order.dto";
import { WebhookEvent } from "src/payment/entities/webhook-event.entity";
import { SellerSyncQueueService } from "../seller-sync/seller-sync.queue.service";
import { CouponMetricsQueueService } from "../coupon/services/coupon-metrics.queue.service";
import { AppSettingsService } from "../shared/services/app-settings.service";

/**
 * Statuses for which buyer receives an order notification; all others use skipNotification.
 * - created/pending: order placed (payment pending or being processed).
 * - confirmed: seller accepted the order → buyer sees "Order confirmed by the restaurant".
 * - billed, packed, agent-assigned, out_for_delivery, delivered: fulfillment updates.
 * - cancelled, refunded: order cancelled or refunded.
 */
const BUYER_ORDER_NOTIFICATION_STATUSES = [
  "confirmed",
  "billed",
  "packed",
  "agent-assigned",
  "out-for-delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  // Default coordinates used when location permissions are disabled in buyer app
  private readonly DEFAULT_LATITUDE = 9.9252;
  private readonly DEFAULT_LONGITUDE = 78.1198;

  private readonly metricEligibleStatuses = new Set([
    "paid",
    "confirmed",
    "delivered",
    "completed",
  ]);

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
    private readonly cartService: CartService,
    private readonly sellerStatusService: SellerStatusService,
    private readonly appOperationHoursService: AppOperationHoursService,
    private readonly appServiceableAreaService: AppServiceableAreaService,
    private readonly httpService: HttpService,
    private readonly sellerSyncQueueService: SellerSyncQueueService,
     private readonly appSettingsService: AppSettingsService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly couponMetricsQueueService?: CouponMetricsQueueService,
  ) {}

  private createCorrelationId(prefix: string, orderId: number): string {
    return `${prefix}-${orderId}-${Date.now()}`;
  }

  private async enqueueCouponRedemptionRetry(
    orderId: number,
    userId: number,
    reservationToken: string,
    correlationId: string,
  ): Promise<void> {
    if (!this.couponMetricsQueueService) {
      this.logger.warn(
        `[${correlationId}] couponMetricsQueueService unavailable; skipping async coupon redemption retry enqueue`,
      );
      return;
    }

    try {
      await this.couponMetricsQueueService.enqueueCouponRedeemRetry({
        orderId,
        userId,
        reservationToken,
        correlationId,
      });
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] Failed to enqueue coupon redemption retry for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async enqueuePaidOrderMetricsUpdate(
    orderId: number,
    userId: number,
    correlationId: string,
  ): Promise<void> {
    if (!this.couponMetricsQueueService) {
      await this.couponService.recordPaidOrderEvent?.(
        orderId,
        userId,
        correlationId,
      );
      return;
    }

    try {
      await this.couponMetricsQueueService.enqueuePaidOrderEvent({
        orderId,
        userId,
        correlationId,
      });
    } catch (queueError) {
      this.logger.warn(
        `[${correlationId}] Failed to enqueue paid-order event, using direct fallback: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
      );

      await this.couponService.recordPaidOrderEvent?.(
        orderId,
        userId,
        correlationId,
      );
    }
  }

  private async isOrderRecoveryAlreadyFinalized(
    payment: Payment,
  ): Promise<boolean> {
    const paymentStatus = String(payment?.payment_status ?? "").toLowerCase();
    const orderPaymentStatus = String(payment?.order?.payment_status ?? "").toLowerCase();
    const orderStatus = String(payment?.order?.status ?? "").toLowerCase();

    const isPaymentSettled =
      paymentStatus === "paid" || paymentStatus === "success";
    const isOrderPaymentSettled = orderPaymentStatus === "paid";
    const isOrderFinalized =
      orderStatus === "confirmed" ||
      orderStatus === "delivered" ||
      orderStatus === "completed";

    if (!(isPaymentSettled && isOrderPaymentSettled && isOrderFinalized)) {
      return false;
    }

    const orderId = Number(payment?.order?.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return false;
    }

    const couponRedemptions = await this.couponRedemptionRepository.find({
      where: { order_id: orderId },
    });

    const hasPendingCouponRedemption = couponRedemptions.some(
      (redemption) => redemption.status !== RedemptionStatus.REDEEMED,
    );

    return !hasPendingCouponRedemption;
  }

   /**
   * Buyer cancel window in seconds from app_settings (BUYER_CANCEL_TIMING_VALUE).
   * Cancel is allowed only while: BUYER_CANCEL_TIMING_VALUE >= elapsed seconds since order placed.
   * null = no time limit (setting missing, inactive, or <= 0).
   */
  private async getBuyerCancelWindowSeconds(): Promise<number | null> {
    const raw = await this.appSettingsService.getNumber(
      "BUYER_CANCEL_TIMING_VALUE",
      0,
    );
    if (raw == null || !Number.isFinite(raw)) return null;
    const sec = Math.floor(Number(raw));
    if (sec <= 0) return null;
    return sec;
  }

  /**
   * Whole seconds since order.created_at using the **database** clock.
   * Avoids false "outside cancel window" when app servers are NTP-skewed vs each other or vs Postgres.
   */
  private async getOrderElapsedSecondsSinceCreated(
    orderId: number,
  ): Promise<number | null> {
    const row = await this.orderRepository
      .createQueryBuilder("o")
      .select(
        "FLOOR(GREATEST(0, EXTRACT(EPOCH FROM (NOW() - o.created_at))))::integer",
        "elapsed_sec",
      )
      .where("o.id = :id", { id: orderId })
      .getRawOne<{ elapsed_sec: string | number | null }>();
    if (!row || row.elapsed_sec == null) return null;
    const n = Number(row.elapsed_sec);
    return Number.isFinite(n) ? n : null;
  }
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

      // Validate store is still accepting orders (seller may have closed after user added items)
      if (!cart.store || cart.store.status === false) {
        await this.cartRepository.update(cart.id, { is_active: false });
        throw new BadRequestException(
          "Sorry, Restaurant is not accepting orders right now. Please try with another restaurant.",
        );
      }

      // CRITICAL: Recalculate cart totals before creating order to ensure latest pricing
      // This ensures platform fee setting changes are reflected immediately
      await this.cartService.recalculateCartTotals(cart.id);

      // Reload cart after recalculation to get updated totals
      const updatedCart = await this.cartRepository
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.store", "s")
        .leftJoinAndSelect("c.cart_items", "ci")
        .leftJoinAndSelect("ci.item", "i")
        .leftJoin("c.user", "u")
        .where("c.id = :cartId", { cartId: cart.id })
        .getOne();

      if (!updatedCart) {
        throw new BadRequestException("Cart not found after recalculation");
      }

      // Use updated cart for order creation
      const cartToUse = updatedCart;

      // Validate store is still accepting orders (seller may have closed after user added items)
      if (!cartToUse.store || cartToUse.store.status === false) {
        await this.cartRepository.update(cartToUse.id, { is_active: false });
        throw new BadRequestException(
          "Sorry, Restaurant is not accepting orders right now. Please try with another restaurant.",
        );
      }

      // NEW: Validate app operation hours before allowing order creation
      // This is separate from restaurant timings - it's a global app-level control
      await this.appOperationHoursService.validateAppIsOpen();

      // Get delivery address
      const deliveryAddress = await this.userAddressRepository.findOne({
        where: { id: createOrderDto.delivery_address_id, user: { id: userId } },
      });

      if (!deliveryAddress) {
        throw new NotFoundException("Delivery address not found");
      }

      // Validate that coordinates are not the default values (location permissions disabled)
      // Use tolerance-based comparison to handle floating-point precision
      const latDiff = Math.abs(Number(deliveryAddress.latitude) - this.DEFAULT_LATITUDE);
      const lngDiff = Math.abs(Number(deliveryAddress.longitude) - this.DEFAULT_LONGITUDE);
      const tolerance = 0.0001; // Very small tolerance for floating-point comparison

      if (latDiff < tolerance && lngDiff < tolerance) {
        this.logger.warn(
          `⚠️ Default coordinates detected and blocked. User ID: ${userId}, Address ID: ${deliveryAddress.id}, Coordinates: (${deliveryAddress.latitude}, ${deliveryAddress.longitude})`,
        );
        throw new BadRequestException(
          "Please update your address and location details properly to create an order. We need your accurate location to provide delivery services.",
        );
      }

      // NEW: Validate delivery address is within app serviceable area
      // This is a global app-level control for service availability
      await this.appServiceableAreaService.validateServiceableArea(
        deliveryAddress.latitude,
        deliveryAddress.longitude,
      );

      // NEW: Re-validate preorder campaigns before checkout
      const preorderCartItems = cartToUse.cart_items.filter(ci => ci.is_preorder);

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
        // Use IST time to ensure consistent timezone comparison with database timestamps
        const now = TimezoneUtil.getCurrentISTTime();
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
        // FIX: Pass store_id directly since cartItem.cart is not loaded
        const reservationToken = await this.reservePreorderFromCart(
          userId,
          cartItem,
          deliveryAddress.pincode,
          cartToUse.store.id, // Pass store_id directly
        );

        // Update cart item with reservation token
        // FIX: Handle cart item save failure - rollback reservation if save fails
        try {
          cartItem.preorder_reservation_token = reservationToken;
          await this.cartItemRepository.save(cartItem);
        } catch (saveError) {
          // Release reservation if cart item save fails
          this.logger.error(
            `❌ Failed to save cart item with reservation token: ${saveError.message}. Releasing reservation.`
          );
          if (cartItem.preorder_campaign_id && reservationToken) {
            await this.redisCouponService.releaseReservation(
              cartItem.preorder_campaign_id,
              reservationToken
            );
          }
          throw saveError;
        }
      }

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order with appropriate status based on payment method
      const orderStatus =
        createOrderDto.payment_method === "cod"
          ? "confirmed"
          : "created";
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

      // FIX: Log cart values before creating order to debug payment amount mismatch
      // NEW: For preorders, explicitly log platform fee handling
      if (preorderCartItems.length > 0) {
        const platformFeeConfig = await this.cartService.getPlatformFeeConfig();
        this.logger.log(
          `🛒 PREORDER - Platform Fee Config: amount=${platformFeeConfig.amount}, include_platform_fee=${platformFeeConfig.isEnabled}`,
        );
        if (!platformFeeConfig.isEnabled) {
          this.logger.log(
            `✅ PREORDER - Platform fee (₹${platformFeeConfig.amount}) is EXCLUDED from order total as per configuration`,
          );
        } else {
          this.logger.log(
            `💰 PREORDER - Platform fee (₹${platformFeeConfig.amount}) is INCLUDED in order total`,
          );
        }
      }

      this.logger.log(
        `💰 Cart totals before order creation: subtotal=${cartToUse.total_amount}, delivery_fee=${cartToUse.delivery_fee}, delivery_fee_tax=${cartToUse.delivery_fee_tax}, platform_fee=${cartToUse.platform_fee}, platform_fee_tax=${cartToUse.platform_fee_tax}, tax=${cartToUse.tax_amount}, discount=${cartToUse.discount_amount}, tip=${cartToUse.tip_amount || 0}, final_amount=${cartToUse.final_amount}`,
      );

      let totalTaxAmount = Number(cartToUse.tax_amount || 0) + Number(cartToUse.delivery_fee_tax || 0) + Number(cartToUse.platform_fee_tax || 0);
      totalTaxAmount = Number(totalTaxAmount.toFixed(2));

      const savedOrder = await this.dataSource.transaction(async (manager) => {
        const order = manager.getRepository(Order).create({
          order_number: orderNumber,
          user: { id: userId },
          store: { id: cartToUse.store.id },
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
          subtotal: cartToUse.total_amount,
          tax_amount: cartToUse.tax_amount,
          delivery_fee: cartToUse.delivery_fee,
          delivery_fee_tax: cartToUse.delivery_fee_tax || 0,
          delivery_percent: cartToUse.delivery_percent || 18.00,
          platform_fee: cartToUse.platform_fee || 0,
          platform_fee_tax: cartToUse.platform_fee_tax || 0,
          platform_percent: cartToUse.platform_percent || 18.00,
          discount_amount: cartToUse.discount_amount,
          tip_amount: cartToUse.tip_amount || 0,
          total_tax_amount: totalTaxAmount || 0,
          total_amount: cartToUse.final_amount,
          payment_method: createOrderDto.payment_method,
          payment_status: paymentStatus,
          notes: createOrderDto.notes,
          estimated_delivery_time: estimatedDeliveryTime,
        });

        const saved = await manager.getRepository(Order).save(order);

        const orderItems = cartToUse.cart_items.map((cartItem) =>
          manager.getRepository(OrderItem).create({
            order: { id: saved.id },
            item: { id: cartItem.item.id },
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price,
            total_price: cartItem.total_price,
            customizations: cartItem.customizations,
            variants: cartItem.variants,
            special_instructions: cartItem.special_instructions,
            is_preorder: cartItem.is_preorder || false,
            preorder_campaign_id: cartItem.preorder_campaign_id,
          }),
        );
        await manager.getRepository(OrderItem).save(orderItems);

        if (orderStatus === "confirmed") {
          const orderWithRelations = await manager.getRepository(Order).findOne({
            where: { id: saved.id },
            relations: ["user", "store", "order_items", "order_items.item"],
          });
          if (orderWithRelations) {
            const payload = await this.sellerPushService.transformOrderToSellerPayload(
              orderWithRelations,
            );
            await this.sellerSyncQueueService.addOutboxRowInTransaction(
              manager,
              "order.push",
              saved.order_number,
              payload as Record<string, unknown>,
            );
          }
        }

        return saved;
      });

      this.logger.log(
        `💰 Order saved with totals: subtotal=${savedOrder.subtotal}, delivery_fee=${savedOrder.delivery_fee}, tax=${savedOrder.tax_amount}, discount=${savedOrder.discount_amount}, tip=${savedOrder.tip_amount}, total_amount=${savedOrder.total_amount}`,
      );

      // NEW: If preorder, redeem coupon after order is created
      // FIX: Only redeem for COD orders. Online payment orders will be redeemed on payment success.
      const preorderCartItemsForRedemption = cartToUse.cart_items.filter(
        (ci) => ci.is_preorder && ci.preorder_reservation_token,
      );

      // Link preorder CouponRedemption to order (so verifyPayment/webhook can find by order_id).
      // COD: redeem immediately. Online: redeem only on payment success (verifyPayment or webhook).
      const preorderCartItemsWithToken = cartToUse.cart_items.filter(
        (ci) => ci.is_preorder && ci.preorder_reservation_token,
      );

      const codCouponRedemptionFailures: string[] = [];

      for (const cartItem of preorderCartItemsWithToken) {
        if (!cartItem.preorder_reservation_token) continue;

        const redemption = await this.couponRedemptionRepository.findOne({
          where: { reserved_token: cartItem.preorder_reservation_token },
        });
        if (redemption) {
          redemption.order_id = savedOrder.id;
          await this.couponRedemptionRepository.save(redemption);
          this.logger.log(
            `🔗 Linked preorder redemption to order ${savedOrder.id} (reserved_token)`,
          );
        }

        // Redeem immediately only for COD. Online orders redeem on payment success.
        if (createOrderDto.payment_method === "cod") {
          try {
            await this.couponService.redeemCoupon({
              reservation_token: cartItem.preorder_reservation_token,
              order_id: savedOrder.id,
              user_id: userId,
              payment_status: PaymentStatus.PAID,
              idempotency_key: `cod-${savedOrder.id}-${cartItem.preorder_reservation_token}`,
            });
            this.logger.log(
              `✅ Redeemed preorder coupon for COD order ${savedOrder.order_number}`,
            );
          } catch (redeemError) {
            this.logger.error(
              `❌ Failed to redeem coupon for COD order: ${redeemError.message}. Order created but coupon not redeemed.`,
            );
            codCouponRedemptionFailures.push(
              cartItem.preorder_reservation_token,
            );

            await this.enqueueCouponRedemptionRetry(
              savedOrder.id,
              userId,
              cartItem.preorder_reservation_token,
              this.createCorrelationId("cod-redeem-retry", savedOrder.id),
            );
          }
        }
      }

      // Link cart-level coupon reservation to order and redeem immediately for COD orders.
      if (cartToUse.coupon_reservation_token) {
        const cartCouponRedemption = await this.couponRedemptionRepository.findOne({
          where: { reserved_token: cartToUse.coupon_reservation_token },
        });

        if (cartCouponRedemption) {
          cartCouponRedemption.order_id = savedOrder.id;
          await this.couponRedemptionRepository.save(cartCouponRedemption);
          this.logger.log(
            `🔗 Linked cart coupon redemption to order ${savedOrder.id} (reserved_token)`,
          );

          if (createOrderDto.payment_method === "cod") {
            try {
              await this.couponService.redeemCoupon({
                reservation_token: cartToUse.coupon_reservation_token,
                order_id: savedOrder.id,
                user_id: userId,
                payment_status: PaymentStatus.PAID,
                idempotency_key: `cod-${savedOrder.id}-${cartToUse.coupon_reservation_token}`,
              });
              this.logger.log(
                `✅ Redeemed cart coupon for COD order ${savedOrder.order_number}`,
              );
            } catch (redeemError) {
              this.logger.error(
                `❌ Failed to redeem cart coupon for COD order: ${redeemError.message}`,
              );
              codCouponRedemptionFailures.push(
                cartToUse.coupon_reservation_token,
              );

              await this.enqueueCouponRedemptionRetry(
                savedOrder.id,
                userId,
                cartToUse.coupon_reservation_token,
                this.createCorrelationId("cod-cart-redeem-retry", savedOrder.id),
              );
            }
          }
        }
      }

      if (
        createOrderDto.payment_method === "cod" &&
        codCouponRedemptionFailures.length > 0
      ) {
        // Best-effort synchronous reconciliation before relying on async retries.
        try {
          const reconciliation = await this.redeemPreorderCouponForOrder(
            savedOrder.id,
            userId,
          );

          if (reconciliation.success) {
            this.logger.log(
              `✅ COD coupon reconciliation succeeded synchronously for order ${savedOrder.order_number}`,
            );
            codCouponRedemptionFailures.length = 0;
          }
        } catch (reconcileError) {
          this.logger.warn(
            `⚠️ COD coupon reconciliation attempt failed for order ${savedOrder.order_number}: ${reconcileError.message}`,
          );
        }

      }

      if (
        createOrderDto.payment_method === "cod" &&
        codCouponRedemptionFailures.length > 0
      ) {
        this.logger.error(
          `⚠️ COD order ${savedOrder.order_number} created with coupon redemption failures for tokens: ${codCouponRedemptionFailures.join(",")}`,
        );
      }

      // Create initial tracking entry (without notification - logged only)
      const trackingMessage =
        createOrderDto.payment_method === "cod"
          ? "Order placed successfully - Cash on Delivery"
          : "Order placed successfully - Payment pending";
      await this.createOrderTracking(
        savedOrder.id,
        orderStatus,
        trackingMessage,
        undefined,
        undefined,
        undefined,
        undefined,
        !BUYER_ORDER_NOTIFICATION_STATUSES.includes(orderStatus as any),
      );

      // Note: Cart will be cleared after order confirmation (COD) or payment success (online)
      // clearCart will handle deactivation after releasing preorder/coupon reservations
      // so we do NOT deactivate here - let it remain active until clearCart is called

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
          await this.sellerPushService.pushOrderToSeller(orderWithRelations);
          this.logger.log(
            `✅ Order ${savedOrder.order_number} enqueued for seller sync`,
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

      // For COD orders, clear cart and return immediately
      if (createOrderDto.payment_method === "cod") {
        // Clear cart after successful COD order creation
        try {
          await this.cartService.clearCart(userId, {
            releaseCouponReservations: false,
          });
          this.logger.log(
            `🗑️ Cart cleared for user ${userId} after COD order creation`,
          );
        } catch (clearCartError) {
          this.logger.error(
            `❌ Failed to clear cart after COD order: ${clearCartError.message}`,
          );
          // Don't fail order creation if cart clear fails
        }

        return {
          success: true,
          message: "Order created successfully - Cash on Delivery",
          order: orderData,
          payment_required: false,
        };
      }

      // For online payment, create Razorpay order and return payment details
      // FIX: Use savedOrder.total_amount instead of cart.final_amount to ensure consistency
      const paymentAmountInPaise = Math.round(savedOrder.total_amount * 100);

      this.logger.log(
        `💳 Creating Razorpay order for order ${savedOrder.id}: amount=${paymentAmountInPaise} paise (₹${savedOrder.total_amount})`,
      );

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        paymentAmountInPaise,
        "INR",
        savedOrder.order_number,
      );

      this.logger.log(
        `✅ Razorpay order created: ${razorpayOrder.id}, amount: ${razorpayOrder.amount}`,
      );

      // Create payment record
      const payment = this.paymentRepository.create({
        order: { id: savedOrder.id },
        user: { id: userId },
        payment_id: razorpayOrder.id, // Store Razorpay order ID temporarily
        payment_method: "online",
        payment_status: "pending",
        amount: savedOrder.total_amount,
        gateway: "razorpay",
      });

      await this.paymentRepository.save(payment);

      // Get user details for prefill
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      // Return order with payment details
      // FIX: Use cartToUse.store.name instead of cart.store.name since cart is not recalculated
      const response = {
        success: true,
        message: "Order created successfully - Payment required",
        order: orderData,
        payment_required: true,
        payment_amount: paymentAmountInPaise,
        currency: "INR",
        payment_details: {
          razorpay_order_id: razorpayOrder.id,
          amount: paymentAmountInPaise,
          currency: "INR",
          key: this.razorpayService.getRazorpayKey(),
          name: cartToUse.store.name,
          description: `Order #${savedOrder.order_number}`,
          prefill: {
            name: user?.name || "User",
            email: user?.email || "",
            contact: user?.phone_number?.toString() || "",
          },
        },
      };

      this.logger.log(
        `✅ Order creation response prepared with payment_details: ${JSON.stringify({ razorpay_order_id: razorpayOrder.id, amount: paymentAmountInPaise })}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `❌ Error creating order: ${error.message}`,
        error.stack,
      );

      // FIX: Restore quota if reservation was created but order creation failed
      // Get cart again to check for reservation tokens
      try {
        const failedCart = await this.cartRepository
          .createQueryBuilder("c")
          .leftJoinAndSelect("c.cart_items", "ci")
          .leftJoin("c.user", "u")
          .where("u.id = :userId", { userId })
          .andWhere("c.is_active = :isActive", { isActive: true })
          .getOne();

        if (failedCart && failedCart.cart_items) {
          const preorderItems = failedCart.cart_items.filter(
            ci => ci.is_preorder && ci.preorder_reservation_token && ci.preorder_campaign_id
          );

          for (const cartItem of preorderItems) {
            if (cartItem.preorder_campaign_id && cartItem.preorder_reservation_token) {
              try {
                await this.redisCouponService.releaseReservation(
                  cartItem.preorder_campaign_id,
                  cartItem.preorder_reservation_token
                );
                this.logger.log(
                  `✅ Restored quota for preorder coupon ${cartItem.preorder_campaign_id} after order creation failure`
                );
              } catch (rollbackError) {
                this.logger.error(
                  `❌ Failed to restore quota after order creation failure: ${rollbackError.message}`
                );
              }
            }
          }
        }
      } catch (rollbackError) {
        this.logger.error(
          `❌ Error during quota rollback after order creation failure: ${rollbackError.message}`
        );
      }

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
        .leftJoinAndSelect("s.locations", "sl", "sl.status = :locStatus", {
          locStatus: true,
        })
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoinAndSelect("o.tracking", "t")
        .leftJoin("o.user", "u")
        .where("o.id = :orderId", { orderId })
        .andWhere("u.id = :userId", { userId })
        .setParameters({ orderId, userId, locStatus: true })
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
          .andWhere("o.status NOT IN (:...excludedStatuses)", {
            excludedStatuses: ["pending", "created"]
          })
          .orderBy("o.created_at", "DESC")
          .skip((page - 1) * limit)
          .take(limit)
          .getMany(),
        this.orderRepository
          .createQueryBuilder("o")
          .leftJoin("o.user", "u")
          .where("u.id = :userId", { userId })
          .andWhere("o.status NOT IN (:...excludedStatuses)", {
            excludedStatuses: ["pending", "created"]
          })
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
        .leftJoinAndSelect("s.locations", "sl", "sl.status = :locStatus", {
          locStatus: true,
        })
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoinAndSelect("o.tracking", "t")
        .where("o.id IN (:...ids)", { ids })
        .setParameters({ ids, locStatus: true })
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

      if (order.status !== "created") {
        throw new BadRequestException("Order is not in created status");
      }

      // FIX: Log order total_amount before payment initiation to debug amount mismatch
      this.logger.log(
        `💰 Payment initiation: Order ID=${order.id}, order.total_amount=${order.total_amount}, payment_amount_in_paise=${Math.round(order.total_amount * 100)}`,
      );

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
   * Cancel order (Buyer only)
   * Validates order belongs to authenticated user
   */
  async cancelOrder(
    cancelOrderDto: OrderCancelDto,
    userId: number,
  ) {
    try {
      this.logger.log(
        `❌ Cancelling order ${cancelOrderDto.order_number} for user ${userId}`,
      );

      const order = await this.orderRepository.findOne({
        where: { 
          order_number: cancelOrderDto.order_number,
          user: { id: userId }
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const cancelledBy = cancelOrderDto.cancelled_by ?? "buyer";

      // Buyer: allow cancel only if BUYER_CANCEL_TIMING_VALUE >= elapsed seconds since placed.
      if (cancelledBy === "buyer") {
        const windowSec = await this.getBuyerCancelWindowSeconds();
        if (windowSec != null) {
          const elapsedSec =
            await this.getOrderElapsedSecondsSinceCreated(order.id);
          const placedMs = new Date(order.created_at).getTime();
          const elapsedSecApp =
            Number.isFinite(placedMs) && placedMs > 0
              ? Math.floor((Date.now() - placedMs) / 1000)
              : null;
          const allowCancelByTiming =
            elapsedSec != null && windowSec >= elapsedSec;
          // Console debug (grep: BUYER_CANCEL_TIMING)
          console.log("[BUYER_CANCEL_TIMING]", {
            order_number: cancelOrderDto.order_number,
            order_id: order.id,
            BUYER_CANCEL_TIMING_VALUE: windowSec,
            elapsed_sec_db: elapsedSec,
            elapsed_sec_app: elapsedSecApp,
            allow_within_window:
              elapsedSec == null ? "skipped_no_db_elapsed" : allowCancelByTiming,
            rule: "allowed when BUYER_CANCEL_TIMING_VALUE >= elapsed_sec_db",
            created_at: order.created_at,
            app_now_iso: new Date().toISOString(),
          });
          if (elapsedSec == null) {
            this.logger.warn(
              `Buyer cancel timing skipped: could not compute elapsed_sec for order id=${order.id} (${cancelOrderDto.order_number})`,
            );
          } else {
            if (!allowCancelByTiming) {
              this.logger.warn(
                `Buyer cancel rejected by timing: order=${cancelOrderDto.order_number} windowSec=${windowSec} elapsedSec=${elapsedSec} (DB clock)`,
              );
              throw new BadRequestException(
                `You cannot cancel this order. You can only cancel within ${windowSec} seconds of placing your order.`,
              );
            }
          }
        }
      }

      let blockedStatuses = ["delivered", "cancelled"];

      if (cancelledBy === "buyer") {
        // Allow buyer to cancel when status is "confirmed"
        // Block only after order moves into preparation / logistics flow
        blockedStatuses = [
          "preparing",
          "billed",
          "packed",
          "agent-assigned",
          "agent-arrived-restaurant",
          "picked",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ];
      } else if (cancelledBy === "seller" || cancelledBy === "system") {
        blockedStatuses = ["delivered", "cancelled"];
      }

      // Use atomic update with WHERE clause to prevent race conditions
      // Only allow cancellation if order is not already delivered or cancelled
      const updateResult = await this.orderRepository
        .createQueryBuilder()
        .update(Order)
        .set({ status: "cancelled" })
        .where("id = :orderId", { orderId: order.id })
        .andWhere("status NOT IN (:...blockedStatuses)", {
          blockedStatuses,
        })
        .execute();

      if (updateResult.affected === 0) {
        // Order was already cancelled/delivered or doesn't exist
        // Re-check to provide appropriate error message
        const currentOrder = await this.orderRepository.findOne({
          where: { id: order.id },
          select: ["id", "status"],
        });

        if (!currentOrder) {
          throw new NotFoundException("Order not found");
        }

        // Provide more specific reasons why cancellation is not allowed
        if (currentOrder.status === "delivered") {
          throw new BadRequestException(
            "Order has already been delivered and cannot be cancelled.",
          );
        }

        if (currentOrder.status === "cancelled") {
          throw new BadRequestException(
            "Order has already been cancelled.",
          );
        }

        if (cancelledBy === "buyer") {
          throw new BadRequestException(
            `Order is currently in '${currentOrder.status}' status and cannot be cancelled by the buyer.`,
          );
        }

        if (cancelledBy === "seller" || cancelledBy === "system") {
          throw new BadRequestException(
            `Order is currently in '${currentOrder.status}' status and cannot be cancelled at this stage.`,
          );
        }

        // Fallback message (should rarely be hit)
        throw new BadRequestException("Order cannot be cancelled at this time.");
      }

      // Stop delayed/waiting seller order.push; mark outbox skipped for audit (worker also skips if job could not be removed).
      try {
        const removed =
          await this.sellerSyncQueueService.removePendingOrderPush(
            order.order_number,
          );
        const skipReason = removed
          ? "buyer_cancelled_job_removed"
          : "cancelled_before_seller_push";
        this.logger.debug(
          `[SELLER_SYNC_SKIP] cancel cleanup order=${order.order_number} removePendingOrderPush_removed=${removed} next_mark_skipped_reason=${skipReason}`,
        );
        await this.sellerSyncQueueService.markOutboxSkippedByReference(
          order.order_number,
          "order.push",
          skipReason,
        );
        this.logger.debug(
          `[SELLER_SYNC_SKIP] cancel cleanup markOutboxSkippedByReference done order=${order.order_number} reason=${skipReason}`,
        );
      } catch (cleanupErr) {
        this.logger.warn(
          `seller_sync order.push cleanup: ${(cleanupErr as Error).message}`,
        );
      }

      if (cancelledBy === "buyer") {
        try {
          const payload = {
            external_order_id: order.order_number,
            cancel_code: cancelOrderDto.code,
            cancelled_by: cancelledBy,
          };

          const row = await this.sellerSyncQueueService.addOutboxRow(
            "order.cancel",
            order.order_number,
            payload as Record<string, unknown>,
          );
          const jobId = await this.sellerSyncQueueService.enqueueOrderCancel(
            payload,
          );
          await this.sellerSyncQueueService.updateOutboxToQueued(
            row.id,
            jobId ?? undefined,
          );
        } catch (error) {
          this.logger.error(`❌ Seller cancel push failed: ${error.message}`);
        }
      }

      // NEW: Restore quota for preorder items
      const orderItems = await this.orderItemRepository.find({
        where: { order: { id: order.id } },
        relations: ['item'],
      });

      for (const orderItem of orderItems) {
        if (orderItem.is_preorder) {
          // Find the coupon redemption for this order
          const couponRedemption = await this.couponRedemptionRepository.findOne({
            where: { order_id: order.id },
            relations: ['coupon'],
          });

          if (couponRedemption && couponRedemption.coupon.type === CouponType.PREORDER) {
            // FIX: Use releaseReservation instead of incrementQuota to properly clean up reservation
            if (couponRedemption.reserved_token) {
              await this.redisCouponService.releaseReservation(
                couponRedemption.coupon.id,
                couponRedemption.reserved_token
              );
              this.logger.log(
                `✅ Released reservation and restored quota for preorder coupon ${couponRedemption.coupon.id} after order cancellation`
              );
            } else {
              // Fallback: If no reservation token, restore quota directly
              await this.redisCouponService.incrementQuota(couponRedemption.coupon.id, 1);
              this.logger.log(
                `✅ Restored quota directly for preorder coupon ${couponRedemption.coupon.id} after order cancellation (no reservation token found)`
              );
            }
          }
        }
      }

      // Create tracking entry
      await this.createOrderTracking(
        order.id,
        "cancelled",
        `Order cancelled: ${cancelOrderDto.reason || "Customer request"}`,
        undefined,
        undefined,
        undefined,
        undefined,
        !BUYER_ORDER_NOTIFICATION_STATUSES.includes("cancelled"),
      );

      // If payment was made, initiate refund
      if (
        order.payment_status === "paid" &&
        order.payment_method === "online"
      ) {
        // In a real app, you would initiate refund here
        this.logger.log(`💰 Refund initiated for order ${order.id}`);
      }

      return {
        success: true,
        message: "Order cancelled successfully",
      };
    } catch (error) {
      // For expected business / validation errors (4xx), avoid noisy error logs
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        this.logger.warn(
          `⚠️ Order cancellation rejected: ${error.message}`,
        );
      } else {
        // Log unexpected errors with stack trace
        this.logger.error(
          `❌ Error cancelling order: ${error.message}`,
          error.stack,
        );
      }
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
      // OR by Razorpay payment ID (if payment was already processed by webhook)
      let payment = await this.paymentRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.order", "o")
        .leftJoin("o.user", "u")
        .where("p.payment_id = :razorpayOrderId", {
          razorpayOrderId: razorpay_order_id,
        })
        .andWhere("u.id = :userId", { userId })
        .getOne();

      // If not found by order ID, try finding by payment ID (in case webhook already processed it)
      if (!payment || !payment.order) {
        payment = await this.paymentRepository
          .createQueryBuilder("p")
          .leftJoinAndSelect("p.order", "o")
          .leftJoin("o.user", "u")
          .where("p.payment_id = :razorpayPaymentId", {
            razorpayPaymentId: razorpay_payment_id,
          })
          .andWhere("u.id = :userId", { userId })
          .getOne();
      }

      if (!payment || !payment.order) {
        // Order not found - check if it was already created by webhook
        // Try to find order by payment ID to see if it exists
        const existingPayment = await this.findPaymentByRazorpayPaymentId(
          razorpay_payment_id,
        );

        if (existingPayment?.order) {
          const isAlreadyFinalized =
            await this.isOrderRecoveryAlreadyFinalized(existingPayment);

          if (isAlreadyFinalized) {
            this.logger.log(
              `ℹ️ Order already finalized (ID: ${existingPayment.order.id}) for payment ${razorpay_payment_id}. Returning idempotent success.`,
            );

            // Get updated order data
            const orderData = await this.getOrderById(
              existingPayment.order.id,
              userId,
            );

            return {
              success: true,
              message:
                "Payment already verified and order created successfully",
              payment_id: razorpay_payment_id,
              order: orderData,
            };
          }

          this.logger.warn(
            `⚠️ Found payment ${razorpay_payment_id} with partially finalized order ${existingPayment.order.id}. Continuing recovery flow.`,
          );

          payment = existingPayment;
        }

        // If still not found, this might be a retry scenario where payment_id was updated to a failed payment ID
        // Try to find any payment record for this user that was created for this razorpay_order_id
        // Since payment_id gets updated, we need to find by searching for orders that might match
        // Actually, we can't easily do this without the order_number

        // Alternative: Since we have the order_id in the payment description in Razorpay,
        // but we don't have access to that here, we need another approach
        // The best we can do is return the error, as the order should exist if payment was initiated

        this.logger.error(
          `❌ Order not found for razorpay_order_id: ${razorpay_order_id}. This may be a retry scenario where payment_id was updated to a failed payment ID.`,
        );
        throw new NotFoundException("Order not found");
      }

      const order = payment.order;
      this.logger.log(`✅ Found order ${order.order_number} (ID: ${order.id})`);

      // Try to fetch webhook payload for this payment
      const webhookEvent = await this.webhookEventRepository.findOne({
        where: {
          payment_id: razorpay_payment_id,
          event_type: 'payment.captured',
        },
      });

      // Update payment record with actual payment ID
      await this.paymentRepository.update(payment.id, {
        payment_id: razorpay_payment_id,
        payment_status: "paid",
        gateway_response: webhookEvent?.event_payload ?? payment.gateway_response,
        paid_at: new Date(),
      });

      // Update payment status
      await this.updatePaymentStatus(order.id, "paid", razorpay_payment_id);

      // Redeem coupon reservations linked to this order on payment success.
      const redemptionResult = await this.redeemPreorderCouponForOrder(
        order.id,
        userId,
      );
      if (redemptionResult?.success === false) {
        throw new InternalServerErrorException(
          `Coupon redemption failed for order ${order.id}. Please retry verification.`,
        );
      }

      // Update order status
      await this.updateOrderStatus(order.id, "confirmed");

      // Clear cart after successful payment
      try {
        await this.cartService.clearCart(userId, {
          releaseCouponReservations: false,
        });
        this.logger.log(
          `🗑️ Cart cleared for user ${userId} after payment success`,
        );
      } catch (clearCartError) {
        this.logger.error(
          `❌ Failed to clear cart after payment success: ${clearCartError.message}`,
        );
        // Don't fail payment verification if cart clear fails
      }

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
   * Redeem preorder coupon for an order (used after payment success: verifyPayment or webhook).
   * Finds CouponRedemption by order_id and calls redeemCoupon. Idempotent if already redeemed.
   * @returns userId from redemption if found (for e.g. cart clear in webhook); otherwise undefined
   */
  async redeemPreorderCouponForOrder(
    orderId: number,
    userId?: number,
  ): Promise<{ userId?: number; success: boolean; failedTokens: string[] }> {
    const couponRedemptions = await this.couponRedemptionRepository.find({
      where: { order_id: orderId },
    });

    if (!couponRedemptions.length) {
      return { success: true, failedTokens: [] };
    }

    let resolvedUserId: number | undefined;
    const failedTokens: string[] = [];

    for (const couponRedemption of couponRedemptions) {
      if (!couponRedemption.reserved_token) {
        continue;
      }

      const redeemUserId = userId ?? couponRedemption.user_id;
      if (redeemUserId == null) {
        this.logger.warn(
          `⚠️ Coupon redemption for order ${orderId} has no user_id; skipping redeem`,
        );
        failedTokens.push(couponRedemption.reserved_token);
        continue;
      }

      try {
        await this.couponService.redeemCoupon({
          reservation_token: couponRedemption.reserved_token,
          order_id: orderId,
          user_id: redeemUserId,
          payment_status: PaymentStatus.PAID,
          idempotency_key: `pay-${orderId}-${couponRedemption.reserved_token}`,
        });
        resolvedUserId = redeemUserId;
        this.logger.log(
          `✅ Redeemed coupon for order ${orderId} (payment success)`,
        );
      } catch (redeemError) {
        this.logger.error(
          `❌ Failed to redeem coupon for order ${orderId}: ${redeemError.message}`,
        );
        failedTokens.push(couponRedemption.reserved_token);

        await this.enqueueCouponRedemptionRetry(
          orderId,
          redeemUserId,
          couponRedemption.reserved_token,
          this.createCorrelationId("payment-redeem-retry", orderId),
        );
      }
    }

    return {
      userId: resolvedUserId,
      success: failedTokens.length === 0,
      failedTokens,
    };
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

      // Policy: do NOT restore coupon quota for placed orders on payment failure.
      this.logger.log(
        `ℹ️ Skipping coupon quota restore for order ${orderId} on payment failure (preorder/nth lock policy)`,
      );

      // Reactivate cart to allow user to retry payment or modify cart
      try {
        const cart = await this.cartRepository
          .createQueryBuilder("c")
          .leftJoin("c.user", "u")
          .where("u.id = :userId", { userId })
          .andWhere("c.is_active = :isActive", { isActive: false })
          .orderBy("c.updated_at", "DESC")
          .getOne();

        if (cart) {
          await this.cartRepository.update(cart.id, { is_active: true });
          this.logger.log(
            `✅ Cart reactivated for user ${userId} after payment failure`,
          );
        }
      } catch (reactivateCartError) {
        this.logger.error(
          `❌ Failed to reactivate cart after payment failure: ${reactivateCartError.message}`,
        );
        // Don't fail payment failure handling if cart reactivation fails
      }

      // Keep order in created status so user can retry
      // Log payment failure without notification (user already knows from payment UI)
      await this.createOrderTracking(
        order.id,
        "created",
        `Payment failed: ${failureReason || "Unknown error"}. You can retry payment.`,
        undefined,
        undefined,
        undefined,
        undefined,
        true, // skipNotification = true
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
   * Handle payment refunded (called from webhook)
   */
  async handlePaymentRefunded(
    orderId: number,
    paymentId: string,
    refundId?: string | null,
    refundAmount?: number | null,
    refundStatus?: string | null,
  ) {
    try {
      this.logger.log(
        `💸 Handling payment refunded for order ${orderId}, Payment ID: ${paymentId}, Refund ID: ${refundId || "N/A"}`,
      );

      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ["order_items", "order_items.item"],
      });

      if (!order) {
        this.logger.warn(`⚠️ Order ${orderId} not found for refund processing`);
        return;
      }

      // Check refund status - only restore quota for successfully processed refunds
      if (refundStatus && refundStatus !== "processed") {
        this.logger.log(
          `⏭️ Refund status is "${refundStatus}" (not "processed"), skipping quota restoration for order ${orderId}`,
        );
        // Continue to create tracking entry but don't restore quota
      } else {
        // Calculate total value of preorder items in this order
        const preorderItems = (order.order_items || []).filter(
          (item) => item.is_preorder,
        );
        const preorderItemsTotal = preorderItems.reduce(
          (sum, item) => sum + Number(item.total_price || 0),
          0,
        );

        this.logger.log(
          `📊 Refund analysis for order ${orderId}: Preorder items count=${preorderItems.length}, Preorder items total=₹${preorderItemsTotal}, Refund amount=${refundAmount ? `₹${refundAmount}` : "N/A"}`,
        );

        // Only restore quota if refund amount >= preorder items total value
        // This handles partial refunds correctly - small refunds don't restore quota
        if (refundAmount !== null && refundAmount !== undefined) {
          if (refundAmount >= preorderItemsTotal && preorderItemsTotal > 0) {
            // Refund covers preorder items.
            this.logger.log(
              `✅ Refund amount (₹${refundAmount}) >= preorder items total (₹${preorderItemsTotal}).`,
            );

            this.logger.log(
              `ℹ️ Skipping coupon quota restore for order ${orderId} on refund (preorder/nth lock policy)`,
            );
          } else {
            // Partial refund - don't restore quota
            this.logger.log(
              `ℹ️ Partial refund (₹${refundAmount}) is less than preorder items total (₹${preorderItemsTotal}). Not restoring quota.`,
            );
          }
        } else {
          // Refund amount not provided - conservative approach: don't restore quota
          this.logger.warn(
            `⚠️ Refund amount not provided for order ${orderId}. Not restoring quota to prevent incorrect restoration.`,
          );
        }
      }

      // Create tracking entry for refund
      const refundMessage = refundAmount
        ? `Payment refunded: ₹${refundAmount}. Refund ID: ${refundId || "N/A"}`
        : `Payment refunded. Refund ID: ${refundId || "N/A"}`;

      await this.createOrderTracking(
        order.id,
        "refunded",
        refundMessage,
        undefined,
        undefined,
        undefined,
        undefined,
        !BUYER_ORDER_NOTIFICATION_STATUSES.includes("refunded"),
      );

      this.logger.log(
        `✅ Payment refunded processed successfully for order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling payment refunded: ${error.message}`,
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
        .leftJoinAndSelect("s.locations", "sl", "sl.status = :locStatus", {
          locStatus: true,
        })
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .leftJoin("o.user", "u")
        .where("u.id = :userId", { userId })
        .andWhere("o.status = :status", { status: "created" })
        .andWhere("o.payment_status = :paymentStatus", {
          paymentStatus: "pending",
        })
        .setParameters({ userId, status: "created", paymentStatus: "pending", locStatus: true })
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
   * Update payment status (with idempotency check)
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

      // Check if payment status has actually changed to prevent duplicate updates
      const currentOrder = await this.orderRepository.findOne({
        where: { id: orderId },
        select: ["id", "payment_status"],
      });

      if (!currentOrder) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Use atomic update with WHERE clause to prevent race conditions
      // Only update if current payment status is different (idempotency)
      const updateResult = await this.orderRepository
        .createQueryBuilder()
        .update(Order)
        .set({ payment_status: paymentStatus })
        .where("id = :orderId", { orderId })
        .andWhere("payment_status != :paymentStatus", { paymentStatus })
        .execute();

      // If no rows were updated, payment status was already the target status (idempotent)
      if (updateResult.affected === 0) {
        this.logger.log(
          `⏭️ Order ${orderId} already has payment status ${paymentStatus}, skipping duplicate update`,
        );

        // Still update payment_id if provided and different (even if status is same)
        if (paymentId) {
          const existingPayment = await this.paymentRepository.findOne({
            where: { order: { id: orderId } },
          });

          if (existingPayment && existingPayment.payment_id !== paymentId) {
            await this.paymentRepository.update(
              { order: { id: orderId } },
              {
                payment_id: paymentId,
                payment_status:
                  paymentStatus === "paid" ? "success" : paymentStatus,
              },
            );
            this.logger.log(
              `✅ Updated payment_id for order ${orderId} to ${paymentId}`,
            );
          }
        }

        return; // Skip further processing
      }

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
        undefined,
        undefined,
        undefined,
        undefined,
        !BUYER_ORDER_NOTIFICATION_STATUSES.includes(paymentStatus as any),
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
   * Find order by Razorpay order ID
   * Handles retry scenarios where payment_id was updated to a failed payment ID
   */
  async findOrderByRazorpayOrderId(razorpayOrderId: string) {
    try {
      // First, try to find by payment_id = razorpay_order_id (initial state, before payment attempts)
      let payment = await this.paymentRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.order", "o")
        .where("p.payment_id = :razorpayOrderId", {
          razorpayOrderId,
        })
        .getOne();

      if (payment?.order) {
        return payment.order;
      }

      // If not found, payment_id may have been updated to a failed payment ID
      // Return null - the calling code will handle fallback logic (e.g., finding by order_number from description)
      return null;
    } catch (error) {
      this.logger.error(
        `❌ Error finding order by Razorpay order ID: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find order by order number (e.g., "ORD-20251220103837-262")
   * Used as fallback when payment_id lookup fails (e.g., retry scenarios)
   */
  async findOrderByOrderNumber(orderNumber: string) {
    try {
      const order = await this.orderRepository.findOne({
        where: { order_number: orderNumber },
      });
      return order;
    } catch (error) {
      this.logger.error(
        `❌ Error finding order by order number: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find order that was already processed by checking payment records
   * This happens when payment.captured webhook processes the order before order.paid or verifyPayment
   * After payment.captured, payment.payment_id is updated from razorpay_order_id to razorpay_payment_id
   * So we check if there's a payment with payment_status = "paid" or "success" 
   * and payment_id starts with "pay_" (not "order_"), indicating it was already processed
   */
  async findOrderAlreadyProcessed(razorpayOrderId: string, razorpayPaymentId?: string) {
    try {
      // First, try to find by payment ID if provided
      if (razorpayPaymentId) {
        const payment = await this.findPaymentByRazorpayPaymentId(razorpayPaymentId);
        if (payment?.order && (payment.payment_status === "paid" || payment.payment_status === "success")) {
          return payment.order;
        }
      }

      // If not found, check all payment records for orders with paid status
      // and see if any payment_id was updated (starts with "pay_" instead of "order_")
      // This indicates the order was already processed by payment.captured
      const payments = await this.paymentRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.order", "o")
        .where("p.payment_status IN (:...statuses)", {
          statuses: ["paid", "success"],
        })
        .andWhere("p.payment_id LIKE :paymentIdPattern", {
          paymentIdPattern: "pay_%",
        })
        .getMany();

      // Check if any of these payments might be related to the order_id
      // by checking the order's payment_status
      for (const payment of payments) {
        if (payment.order && payment.order.payment_status === "paid") {
          // This order was already processed, return it
          return payment.order;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `❌ Error finding already processed order: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find payment by Razorpay payment ID
   */
  async findPaymentByRazorpayPaymentId(razorpayPaymentId: string) {
    try {
      const payment = await this.paymentRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.order", "o")
        .where("p.payment_id = :razorpayPaymentId", {
          razorpayPaymentId,
        })
        .getOne();

      return payment;
    } catch (error) {
      this.logger.error(
        `❌ Error finding payment by Razorpay payment ID: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get order with user relation (for webhook handlers)
   */
  async getOrderWithUser(orderId: number) {
    try {
      const order = await this.orderRepository
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.user", "u")
        .where("o.id = :orderId", { orderId })
        .getOne();

      return order;
    } catch (error) {
      this.logger.error(
        `❌ Error getting order with user: ${error.message}`,
      );
      return null;
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

      // Use atomic update with WHERE clause to prevent race conditions
      // Only update if current status is different (idempotency)
      const updateResult = await this.orderRepository
        .createQueryBuilder()
        .update(Order)
        .set({ status })
        .where("id = :orderId", { orderId })
        .andWhere("status != :status", { status }) // Only update if status is different
        .execute();

      // If no rows were updated, status was already the target status (idempotent)
      if (updateResult.affected === 0) {
        this.logger.log(
          `⏭️ Order ${orderId} already has status ${status}, skipping duplicate update`,
        );
        return;
      }

      // Record paid-like order transitions for nth-order metrics with idempotent dedupe by order_id.
      if (this.metricEligibleStatuses.has(status)) {
        try {
          const rows = await this.dataSource.query(
            `SELECT user_id FROM "order" WHERE id = $1 LIMIT 1`,
            [orderId],
          );
          const userId = Number(rows?.[0]?.user_id);
          if (Number.isInteger(userId) && userId > 0) {
            await this.enqueuePaidOrderMetricsUpdate(
              orderId,
              userId,
              `order-status-${orderId}-${status}-${Date.now()}`,
            );
          }
        } catch (metricsError) {
          this.logger.warn(
            `⚠️ Failed to update nth-order metrics for order ${orderId}: ${metricsError instanceof Error ? metricsError.message : String(metricsError)}`,
          );
        }
      }

      // Status was successfully updated (updateResult.affected > 0)
      // Push order to seller if status is confirmed AND our update succeeded
      if (status === "confirmed" && updateResult.affected !== undefined && updateResult.affected > 0) {
        const orderWithRelations = await this.orderRepository
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.user", "u")
        .leftJoinAndSelect("o.store", "s")
        .leftJoinAndSelect("o.order_items", "oi")
        .leftJoinAndSelect("oi.item", "i")
        .where("o.id = :orderId", { orderId: orderId })
        .getOne();
        
        // Double-check status is still confirmed (race condition protection)
        // Another thread might have changed status between update and this query
        if (orderWithRelations && orderWithRelations.status === "confirmed") {
          try {
            await this.sellerPushService.pushOrderToSeller(orderWithRelations);
            this.logger.log(
              `✅ Order ${orderId} status updated to ${status} and enqueued for seller sync`,
            );
          } catch (error) {
            this.logger.error(
              `❌ Error pushing order ${orderId} to seller: ${error.message}`,
              error.stack,
            );
          }
        } else {
          this.logger.warn(
            `⚠️ Order ${orderId} status changed before seller push (expected: confirmed, got: ${orderWithRelations?.status || "not found"})`,
          );
        }
      }

      // Create tracking entry
      await this.createOrderTracking(
        orderId,
        status,
        `Order ${status}`,
        undefined,
        undefined,
        undefined,
        undefined,
        !BUYER_ORDER_NOTIFICATION_STATUSES.includes(status as any),
      );

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
    skipNotification?: boolean,
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

    // Create notification for order status update (unless skipped)
    if (!skipNotification) {
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
    } else {
      this.logger.log(
        `📝 Tracking logged without notification: Order ${orderId} | Status: ${status} | Message: "${message}"`,
      );
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
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    return `ORD-${year}${month}${day}${hours}${minutes}${seconds}-${random}`;
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

    // 

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
      pickup_address: (() => {
        const locations = order.store?.locations?.filter((l) => l.status !== false) || [];
        const loc = locations[0];
        if (!loc) {
          return null;
        }
        return {
          id: loc.id,
          latitude: Number(loc.gps_lat),
          longitude: Number(loc.gps_lng),
          locality: loc.address_locality,
          street: loc.address_street,
          city: loc.address_city,
          area_code: loc.address_area_code,
          state: loc.address_state,
        };
      })(),
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
        delivery_fee_tax: Number(order.delivery_fee_tax),
        delivery_percent: Number(order.delivery_percent || 18.00),
        platform_fee: Number(order.platform_fee),
        platform_fee_tax: Number(order.platform_fee_tax),
        platform_percent: Number(order.platform_percent || 18.00),
        tax_amount: Number(order.tax_amount),
        discount_amount: Number(order.discount_amount),
        tip_amount: Number(order.tip_amount || 0),
        total_tax_amount: Number(order.total_tax_amount),
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
      tracking_id: order.tracking && order.tracking.length > 0
        ? (() => {
          const url = order.tracking[order.tracking.length - 1].tracking_url;
          if (!url) return null;
          const last = String(url)
            .split(/[?#]/)[0]
            .split("/")
            .filter(Boolean)
            .pop();
          const n = last != null ? Number(last) : NaN;
          return Number.isFinite(n) ? n : null;
        })()
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

      // Reassignment when order is already past agent-assigned (picked, out_for_delivery, delivered):
      // seller may send agent-assigned again with new rider. Do not move status backward or create duplicate tracking/notification.
      const statusAlreadyPastAgentAssigned = [
        "picked",
        "out_for_delivery",
        "out-for-delivery",
        "delivered",
      ].includes(order.status);
      if (
        sellerStatusUpdateDto.status === "agent-assigned" &&
        statusAlreadyPastAgentAssigned
      ) {
        this.logger.log(
          `⏭️ Order ${sellerStatusUpdateDto.order_number} already ${order.status} (past agent-assigned); ignoring agent-assigned (reassign) update`,
        );
        return {
          success: true,
          message: "Order status updated successfully",
          order_number: sellerStatusUpdateDto.order_number,
          previous_status: order.status,
          new_status: order.status,
        };
      }

      // Validate status transition (before atomic update)
      this.sellerStatusService.validateSellerStatusUpdate(
        sellerStatusUpdateDto.order_number,
        order.status,
        sellerStatusUpdateDto.status,
      );

      // Prepare update data
      const updateData: any = {
        status: sellerStatusUpdateDto.status,
      };

      // Set delivered_at timestamp if status is delivered
      if (sellerStatusUpdateDto.status === "delivered") {
        updateData.delivered_at = new Date();
        // When seller sends payment_status 'paid' (e.g. COD collected), update order payment_status
        if (order.payment_method === "cod" && sellerStatusUpdateDto.payment_status === "paid") {
          updateData.payment_status = "paid";
        }
      }

      // Update estimated delivery time if provided
      if (sellerStatusUpdateDto.estimated_delivery_time) {
        updateData.estimated_delivery_time = new Date(
          sellerStatusUpdateDto.estimated_delivery_time,
        );
      }

      // Use atomic update with WHERE clause to prevent race conditions
      // Only update if current status matches what we validated against
      let updateBuilder = this.orderRepository
        .createQueryBuilder()
        .update(Order)
        .set(updateData)
        .where("id = :orderId", { orderId: order.id })
        .andWhere("status = :currentStatus", { currentStatus: order.status });

      const updateResult = await updateBuilder.execute();

      if (updateResult.affected === 0) {
        // Status changed between validation and update (race condition)
        // Re-read order to get current status
        const currentOrder = await this.orderRepository.findOne({
          where: { id: order.id },
          select: ["id", "status"],
        });

        if (currentOrder) {
          // Re-validate with current status
          this.sellerStatusService.validateSellerStatusUpdate(
            sellerStatusUpdateDto.order_number,
            currentOrder.status,
            sellerStatusUpdateDto.status,
          );

          // Retry update with current status (using same updateData)
          const retryBuilder = this.orderRepository
            .createQueryBuilder()
            .update(Order)
            .set(updateData)
            .where("id = :orderId", { orderId: order.id })
            .andWhere("status = :currentStatus", {
              currentStatus: currentOrder.status,
            });

          await retryBuilder.execute();
        } else {
          throw new NotFoundException(
            `Order with number ${sellerStatusUpdateDto.order_number} not found`,
          );
        }
      }

      const previousStatus = order.status;
      const newStatus = sellerStatusUpdateDto.status;

      // Idempotency: when status unchanged (e.g. agent-assigned → agent-assigned on reassign),
      // skip tracking and notification to avoid duplicates from multiple webhook deliveries.
      if (previousStatus === newStatus) {
        this.logger.log(
          `⏭️ Order ${sellerStatusUpdateDto.order_number} status unchanged (${previousStatus}), skipping tracking and notification`,
        );
        return {
          success: true,
          message: "Order status updated successfully",
          order_number: sellerStatusUpdateDto.order_number,
          previous_status: previousStatus,
          new_status: newStatus,
        };
      }

      // Create tracking entry
      const statusMessage = this.sellerStatusService.getStatusMessage(newStatus);
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
        newStatus,
        fullMessage,
        agentDetails,
        sellerStatusUpdateDto.tracking_url,
        sellerStatusUpdateDto.delivery_code,
        sellerStatusUpdateDto.status === "cancelled"
          ? sellerStatusUpdateDto.cancel_reason
          : undefined,
        true, // skipNotification: only send via createNotification below when status is allowed
      );

      // Send notification to user only for allowed statuses.
      // Exclude "created" and "pending" so "Order Placed Successfully" is sent only once (at order creation).
      const status = newStatus;
      const isAllowed = BUYER_ORDER_NOTIFICATION_STATUSES.includes(status as any);
      const isPlacementStatus = status === "created" || status === "pending";
      if (isAllowed && !isPlacementStatus) {
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
      }

      this.logger.log(
        `✅ Order ${sellerStatusUpdateDto.order_number} status updated: ${previousStatus} → ${newStatus}`,
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
    storeId: number, // FIX: Accept store_id as parameter instead of accessing from cartItem.cart
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
      store_id: storeId, // FIX: Use passed store_id instead of cartItem.cart.store.id
      cart_total: cartItem.total_price,
      pincode: pincode, // Required field
    });

    // reserveCoupon returns { reservation_token, expires_in_seconds }
    return reservation.reservation_token;
  }

}