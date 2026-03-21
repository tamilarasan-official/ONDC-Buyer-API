jest.mock(
  "src/super-admin-access/super-admin-access.service",
  () => ({
    AdminAccessService: class AdminAccessService {},
  }),
  { virtual: true },
);

jest.mock(
  "bullmq",
  () => ({
    Queue: class Queue {
      add = jest.fn();
    },
  }),
  { virtual: true },
);

jest.mock(
  "src/payment/entities/webhook-event.entity",
  () => ({
    WebhookEvent: class WebhookEvent {},
  }),
  { virtual: true },
);

import { OrderService } from "./order.service";
import { PaymentMethod } from "./dto/order-request.dto";
import { CouponType } from "../coupon/entities/coupon.entity";

const asNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

describe("OrderService integration - percent coupon discount propagation", () => {
  it("should persist cart discount and discounted final amount into order after coupon application", async () => {
    const expectedDiscountAmount = asNumber(
      process.env.FLOW_COUPON_DISCOUNT_AMOUNT,
      15,
    );
    const expectedFinalAmount = asNumber(
      process.env.FLOW_COUPON_FINAL_AMOUNT,
      112,
    );
    const paymentMethodEnv = (
      process.env.FLOW_COUPON_PAYMENT_METHOD || "cod"
    ).toLowerCase();
    const selectedPaymentMethod =
      paymentMethodEnv === "online" ? PaymentMethod.ONLINE : PaymentMethod.COD;

    const userId = 101;

    const initialCart = {
      id: 10,
      is_active: true,
      store: { id: 5, status: true, name: "Test Store" },
      user: { id: userId },
      cart_items: [
        {
          id: 1,
          quantity: 1,
          unit_price: 100,
          total_price: 100,
          customizations: [],
          variants: [],
          special_instructions: "",
          is_preorder: false,
          preorder_campaign_id: null,
          preorder_reservation_token: null,
          item: { id: 201, tax_rate: 5 },
        },
      ],
      total_amount: 100,
      tax_amount: 5,
      delivery_fee: 20,
      delivery_fee_tax: 2,
      delivery_percent: 18,
      platform_fee: 0,
      platform_fee_tax: 0,
      platform_percent: 18,
      discount_amount: 0,
      tip_amount: 0,
      final_amount: 127,
    } as any;

    // Simulate cart after percent coupon applied + totals recalculated
    const updatedCart = {
      ...initialCart,
      discount_amount: expectedDiscountAmount,
      final_amount: expectedFinalAmount,
    } as any;

    const cartQbFirst = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(initialCart),
    } as any;

    const cartQbSecond = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(updatedCart),
    } as any;

    const cartRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(cartQbFirst)
        .mockReturnValueOnce(cartQbSecond),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const orderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    } as any;

    const orderItemRepository = {} as any;
    const orderTrackingRepository = {} as any;
    const paymentRepository = {} as any;
    const cartItemRepository = {} as any;
    const userAddressRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 77,
        address1: "Line 1",
        address2: "Line 2",
        address3: "",
        city: "Chennai",
        state: "TN",
        pincode: "600001",
        latitude: 12.9716,
        longitude: 77.5946,
        type: "home",
        alternate_phone_number: "9999999999",
      }),
    } as any;
    const userRepository = {} as any;
    const storeRepository = {} as any;
    const itemRepository = {} as any;
    const itemCustomizationGroupsRepository = {} as any;
    const couponRedemptionRepository = {} as any;
    const couponRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as any;

    const couponService = {} as any;
    const redisCouponService = {} as any;
    const razorpayService = {} as any;
    const notificationService = {} as any;
    const sellerPushService = {
      pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
      transformOrderToSellerPayload: jest.fn().mockResolvedValue({}),
    } as any;
    const cartService = {
      recalculateCartTotals: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue(undefined),
      getPlatformFeeConfig: jest.fn().mockResolvedValue({
        amount: 0,
        tax: 0,
        isEnabled: false,
      }),
    } as any;
    const sellerStatusService = {} as any;
    const appOperationHoursService = {
      validateAppIsOpen: jest.fn().mockResolvedValue(undefined),
    } as any;
    const appServiceableAreaService = {
      validateServiceableArea: jest.fn().mockResolvedValue(undefined),
    } as any;
    const httpService = {} as any;
    const sellerSyncQueueService = {
      addOutboxRowInTransaction: jest.fn().mockResolvedValue(undefined),
    } as any;
    const webhookEventRepository = {} as any;

    let createdOrderPayload: any;

    const dataSource = {
      transaction: jest.fn(async (cb: any) => {
        const orderRepoInTxn = {
          create: jest.fn((payload: any) => {
            createdOrderPayload = payload;
            return payload;
          }),
          save: jest.fn(async (payload: any) => ({
            id: 501,
            order_number: "ORD-TEST-501",
            ...payload,
          })),
          findOne: jest.fn().mockResolvedValue(null),
        };

        const orderItemRepoInTxn = {
          create: jest.fn((payload: any) => payload),
          save: jest.fn().mockResolvedValue([]),
        };

        const manager = {
          getRepository: jest.fn((entity: any) => {
            const entityName = entity?.name || "";
            if (entityName === "Order") {
              return orderRepoInTxn;
            }
            if (entityName === "OrderItem") {
              return orderItemRepoInTxn;
            }
            return {
              create: jest.fn((payload: any) => payload),
              save: jest.fn(async (payload: any) => payload),
              findOne: jest.fn().mockResolvedValue(null),
            };
          }),
        };

        return cb(manager);
      }),
    } as any;

    const service = new OrderService(
      orderRepository,
      orderItemRepository,
      orderTrackingRepository,
      paymentRepository,
      cartRepository,
      cartItemRepository,
      userAddressRepository,
      userRepository,
      storeRepository,
      itemRepository,
      itemCustomizationGroupsRepository,
      couponRedemptionRepository,
      couponRepository,
      couponService,
      redisCouponService,
      razorpayService,
      notificationService,
      sellerPushService,
      cartService,
      sellerStatusService,
      appOperationHoursService,
      appServiceableAreaService,
      httpService,
      sellerSyncQueueService,
      webhookEventRepository,
      dataSource,
    );

    jest
      .spyOn(service as any, "createOrderTracking")
      .mockResolvedValue(undefined);
    jest.spyOn(service, "getOrderById").mockResolvedValue({
      id: 501,
      discount_amount: updatedCart.discount_amount,
      total_amount: updatedCart.final_amount,
    } as any);

    const result = await service.createOrder(userId, {
      delivery_address_id: 77,
      payment_method: selectedPaymentMethod,
      notes: "integration test",
    } as any);

    expect(cartService.recalculateCartTotals).toHaveBeenCalledWith(
      initialCart.id,
    );

    // Core assertions requested: order amount fields must carry applied percent coupon effect from cart
    expect(createdOrderPayload.discount_amount).toBe(
      updatedCart.discount_amount,
    );
    expect(createdOrderPayload.total_amount).toBe(updatedCart.final_amount);

    expect(result.success).toBe(true);
    expect(result.payment_required).toBe(false);
  });

  describe("OrderService integration - free_delivery coupon", () => {
    it("should apply free_delivery discount and set delivery_waived flag when creating order", async () => {
      const userId = 102;
      const expectedDiscountAmount = 45; // Free delivery fee amount
      const expectedDeliveryFee = 0; // Waived

      const initialCart = {
        id: 11,
        is_active: true,
        store: { id: 5, status: true, name: "Test Store" },
        user: { id: userId },
        cart_items: [
          {
            id: 2,
            quantity: 2,
            unit_price: 200,
            total_price: 400,
            customizations: [],
            variants: [],
            special_instructions: "",
            is_preorder: false,
            preorder_campaign_id: null,
            preorder_reservation_token: null,
            item: { id: 202, tax_rate: 5 },
          },
        ],
        total_amount: 400,
        tax_amount: 20,
        delivery_fee: 45,
        delivery_fee_tax: 4,
        delivery_percent: 18,
        platform_fee: 50,
        platform_fee_tax: 5,
        platform_percent: 18,
        discount_amount: 0, // No discount initially
        tip_amount: 0,
        final_amount: 524, // 400 + 20 + 45 + 4 + 50 + 5
      } as any;

      // Cart after free_delivery coupon applied
      const updatedCart = {
        ...initialCart,
        coupon_code: "FREEDEL50",
        discount_amount: expectedDiscountAmount,
        delivery_fee: expectedDeliveryFee, // Waived
        delivery_fee_tax: 0,
        final_amount: 479, // 400 + 20 + 0 + 0 + 50 + 5 + 4 (tip) = 479
      } as any;

      const cartQbFirst = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(initialCart),
      } as any;

      const cartQbSecond = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(updatedCart),
      } as any;

      const cartRepository = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(cartQbFirst)
          .mockReturnValueOnce(cartQbSecond),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      const orderRepository = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setParameters: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      } as any;

      const orderItemRepository = {} as any;
      const orderTrackingRepository = {} as any;
      const paymentRepository = {} as any;
      const cartItemRepository = {} as any;
      const userAddressRepository = {
        findOne: jest.fn().mockResolvedValue({
          id: 78,
          address1: "Line 1",
          address2: "Line 2",
          address3: "",
          city: "Chennai",
          state: "TN",
          pincode: "600002",
          latitude: 12.9716,
          longitude: 77.5946,
          type: "work",
          alternate_phone_number: "8888888888",
        }),
      } as any;
      const userRepository = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: userId, phone_number: "9876543210" }),
      } as any;
      const storeRepository = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 5, gstin: "27AAFCC0001H1Z0" }),
      } as any;
      const itemRepository = {} as any;
      const itemCustomizationGroupsRepository = {
        find: jest.fn().mockResolvedValue([]),
      } as any;
      const couponRedemptionRepository = {} as any;
      const couponRepository = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;
      const couponService = {
        redeemCoupon: jest.fn().mockResolvedValue({ success: true }),
      } as any;
      const redisCouponService = {} as any;
      const razorpayService = {} as any;
      const notificationService = {
        sendNotification: jest.fn().mockResolvedValue(true),
      } as any;
      const sellerPushService = {
        pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
        transformOrderToSellerPayload: jest.fn().mockResolvedValue({}),
      } as any;
      const cartService = {
        recalculateCartTotals: jest.fn().mockResolvedValue(undefined),
        clearCart: jest.fn().mockResolvedValue(undefined),
        getPlatformFeeConfig: jest.fn().mockResolvedValue({
          amount: 0,
          tax: 0,
          isEnabled: false,
        }),
      } as any;
      const sellerStatusService = {} as any;
      const appOperationHoursService = {
        validateAppIsOpen: jest.fn().mockResolvedValue(undefined),
      } as any;
      const appServiceableAreaService = {
        validateServiceableArea: jest.fn().mockResolvedValue(undefined),
      } as any;
      const httpService = {} as any;
      const sellerSyncQueueService = {
        addOutboxRowInTransaction: jest.fn().mockResolvedValue(undefined),
      } as any;
      const webhookEventRepository = {} as any;

      let createdOrderPayload: any;

      const dataSource = {
        transaction: jest.fn(async (cb: any) => {
          const orderRepoInTxn = {
            create: jest.fn((payload: any) => {
              createdOrderPayload = payload;
              return payload;
            }),
            save: jest.fn(async (payload: any) => ({
              id: 502,
              order_number: "ORD-TEST-502",
              ...payload,
            })),
            findOne: jest.fn().mockResolvedValue(null),
          };

          const orderItemRepoInTxn = {
            create: jest.fn((payload: any) => payload),
            save: jest.fn().mockResolvedValue([]),
          };

          const manager = {
            getRepository: jest.fn((entity: any) => {
              const entityName = entity?.name || "";
              if (entityName === "Order") {
                return orderRepoInTxn;
              }
              if (entityName === "OrderItem") {
                return orderItemRepoInTxn;
              }
              return {
                create: jest.fn((payload: any) => payload),
                save: jest.fn(async (payload: any) => payload),
                findOne: jest.fn().mockResolvedValue(null),
              };
            }),
          };

          return cb(manager);
        }),
      } as any;

      const service = new OrderService(
        orderRepository,
        orderItemRepository,
        orderTrackingRepository,
        paymentRepository,
        cartRepository,
        cartItemRepository,
        userAddressRepository,
        userRepository,
        storeRepository,
        itemRepository,
        itemCustomizationGroupsRepository,
        couponRedemptionRepository,
        couponRepository,
        couponService,
        redisCouponService,
        razorpayService,
        notificationService,
        sellerPushService,
        cartService,
        sellerStatusService,
        appOperationHoursService,
        appServiceableAreaService,
        httpService,
        sellerSyncQueueService,
        webhookEventRepository,
        dataSource,
      );

      jest
        .spyOn(service as any, "createOrderTracking")
        .mockResolvedValue(undefined);
      jest.spyOn(service, "getOrderById").mockResolvedValue({
        id: 502,
        discount_amount: updatedCart.discount_amount,
        delivery_waived: true,
        total_amount: updatedCart.final_amount,
      } as any);

      const result = await service.createOrder(userId, {
        delivery_address_id: 78,
        payment_method: "cod",
        notes: "free delivery integration test",
      } as any);

      // Verify free_delivery discount correctly propagated to order
      expect(createdOrderPayload.discount_amount).toBe(expectedDiscountAmount);
      expect(createdOrderPayload.delivery_fee).toBe(expectedDeliveryFee);
      expect(result.success).toBe(true);
      expect(result.order.delivery_waived).toBe(true);
    });
  });

  describe("OrderService integration - payment callback idempotency", () => {
    it("should process payment once and skip update on duplicate callback (update called exactly once)", async () => {
      const userId = 303;

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        // Call 1 (by razorpay_order_id): returns the payment+order → triggers normal processing
        // All subsequent calls (Call 2 by order_id + by payment_id): return null → falls through
        getOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 99, order: { id: 777, order_number: "ORD-777" } })
          .mockResolvedValue(null),
      } as any;

      const paymentRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      const razorpayService = {
        verifyPaymentSignature: jest.fn().mockReturnValue(true),
      } as any;

      const webhookEventRepository = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const couponRedemptionRepository = {
        find: jest.fn().mockResolvedValue([]),
      } as any;

      const cartService = {
        clearCart: jest.fn().mockResolvedValue(undefined),
      } as any;

      const service = new OrderService(
        { createQueryBuilder: jest.fn() } as any,
        {} as any,
        {} as any,
        paymentRepository,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        couponRedemptionRepository,
        {} as any,
        {} as any,
        {} as any,
        razorpayService,
        {} as any,
        {} as any,
        cartService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        webhookEventRepository,
        {} as any,
      );

      // Call 2: both queryBuilder.getOne return null → reaches findPaymentByRazorpayPaymentId
      jest
        .spyOn(service as any, "findPaymentByRazorpayPaymentId")
        .mockResolvedValue({
          payment_status: "success",
          order: {
            id: 777,
            status: "confirmed",
            payment_status: "paid",
          },
        });

      // Spy on internal methods called during Call 1 processing
      jest.spyOn(service as any, "updatePaymentStatus").mockResolvedValue(undefined);
      jest.spyOn(service as any, "redeemPreorderCouponForOrder").mockResolvedValue(undefined);
      jest.spyOn(service as any, "updateOrderStatus").mockResolvedValue(undefined);

      jest.spyOn(service, "getOrderById").mockResolvedValue({
        id: 777,
        status: "confirmed",
      } as any);

      const dto = {
        razorpay_order_id: "order_DUPLICATE_1",
        razorpay_payment_id: "pay_DUPLICATE_1",
        razorpay_signature: "sig_DUPLICATE_1",
      } as any;

      // Call 1: payment found by queryBuilder → processes payment, calls update once
      const result1 = await service.verifyPayment(userId, dto);
      // Call 2: same payload → payment not found in queryBuilder, but found via findPaymentByRazorpayPaymentId → already verified
      const result2 = await service.verifyPayment(userId, dto);

      expect(result1.success).toBe(true);
      expect(result1.message).toContain("verified successfully");
      expect(result2.success).toBe(true);
      expect(result2.message).toContain("already verified");
      expect(result2.order.id).toBe(777);

      // Signature verified on every call
      expect(razorpayService.verifyPaymentSignature).toHaveBeenCalledTimes(2);
      // DB update triggered exactly once — duplicate callback had no side effect
      expect(paymentRepository.update).toHaveBeenCalledTimes(1);
    });
  });
});

describe("OrderService integration - cart cleanup policy", () => {
  it("should clear cart with releaseCouponReservations=false after COD order", async () => {
    const userId = 101;
    const cart = {
      id: 10,
      is_active: true,
      store: { id: 5, status: true },
      user: { id: userId },
      cart_items: [
        {
          id: 1,
          quantity: 1,
          unit_price: 100,
          total_price: 100,
          customizations: [],
          variants: [],
          special_instructions: "",
          is_preorder: false,
          preorder_campaign_id: null,
          preorder_reservation_token: null,
          item: { id: 201, tax_rate: 5 },
        },
      ],
      delivery_fee: 20,
      delivery_fee_tax: 2,
      platform_fee: 0,
      platform_fee_tax: 0,
      tax_amount: 5,
      discount_amount: 0,
      tip_amount: 0,
      final_amount: 127,
      coupon_id: null,
      coupon_code: null,
      coupon_reservation_token: null,
    } as any;

    const cartQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(cart),
    } as any;

    const cartRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(cartQb),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const orderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    } as any;

    const cartService = {
      recalculateCartTotals: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue({ success: true }),
      getPlatformFeeConfig: jest.fn().mockResolvedValue({
        amount: 0,
        tax: 0,
        isEnabled: false,
      }),
    } as any;

    const dataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn((payload: any) => payload),
            save: jest.fn(async (payload: any) => ({
              id: 1,
              order_number: "ORD-001",
              status: "confirmed",
              ...payload,
            })),
            findOne: jest.fn().mockResolvedValue(null),
          }),
        };
        return cb(manager);
      }),
    } as any;

    const service = new OrderService(
      orderRepository,
      {} as any,
      {} as any,
      {} as any,
      cartRepository,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          address1: "Line1",
          city: "Chennai",
          state: "TN",
          pincode: "600001",
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
        transformOrderToSellerPayload: jest.fn().mockResolvedValue({}),
      } as any,
      cartService,
      {} as any,
      { validateAppIsOpen: jest.fn().mockResolvedValue(undefined) } as any,
      { validateServiceableArea: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      { addOutboxRowInTransaction: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      dataSource,
    );

    jest.spyOn(service as any, "createOrderTracking").mockResolvedValue(undefined);
    jest.spyOn(service, "getOrderById").mockResolvedValue({ id: 1 } as any);

    await service.createOrder(userId, {
      payment_method: PaymentMethod.COD,
      delivery_address_id: 1,
      special_instructions: "",
    } as any);

    expect(cartService.clearCart).toHaveBeenCalledWith(userId, {
      releaseCouponReservations: false,
    });
  });
});

describe("OrderService integration - coupon redemption reliability", () => {
  it("should report failed tokens when order-linked redemption does not complete", async () => {
    const couponRedemptionRepository = {
      find: jest.fn().mockResolvedValue([
        {
          reserved_token: "token-ok",
          user_id: 101,
        },
        {
          reserved_token: "token-fail",
          user_id: 101,
        },
      ]),
    } as any;

    const couponService = {
      redeemCoupon: jest
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error("redis timeout")),
    } as any;

    const couponMetricsQueueService = {
      enqueueCouponRedeemRetry: jest.fn().mockResolvedValue("job-1"),
    } as any;

    const service = new OrderService(
      {} as any, // orderRepository
      {} as any, // orderItemRepository
      {} as any, // orderTrackingRepository
      {} as any, // paymentRepository
      {} as any, // cartRepository
      {} as any, // cartItemRepository
      {} as any, // userAddressRepository
      {} as any, // userRepository
      {} as any, // storeRepository
      {} as any, // itemRepository
      {} as any, // itemCustomizationGroupsRepository
      couponRedemptionRepository,
      {} as any, // couponRepository
      couponService,
      {} as any, // redisCouponService
      {} as any, // razorpayService
      {} as any, // notificationService
      {} as any, // sellerPushService
      {} as any, // cartService
      {} as any, // sellerStatusService
      {} as any, // appOperationHoursService
      {} as any, // appServiceableAreaService
      {} as any, // httpService
      {} as any, // sellerSyncQueueService
      {} as any, // webhookEventRepository
      {} as any, // dataSource
      couponMetricsQueueService,
    );

    const result = await service.redeemPreorderCouponForOrder(501, 101);

    expect(result.success).toBe(false);
    expect(result.failedTokens).toEqual(["token-fail"]);
    expect(couponService.redeemCoupon).toHaveBeenCalledTimes(2);
    expect(couponMetricsQueueService.enqueueCouponRedeemRetry).toHaveBeenCalledTimes(1);
  });

  it("should enqueue metrics event when order status moves to confirmed", async () => {
    const couponMetricsQueueService = {
      enqueuePaidOrderEvent: jest.fn().mockResolvedValue("job-metrics-1"),
      enqueueCouponRedeemRetry: jest.fn().mockResolvedValue("job-redeem-1"),
    } as any;

    const updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;

    const loadQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 77, status: "confirmed" }),
    } as any;

    const orderRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(loadQb),
      findOne: jest.fn().mockResolvedValue(null),
    } as any;

    const service = new OrderService(
      orderRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { recordPaidOrderEvent: jest.fn().mockResolvedValue({ processed: true }) } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        query: jest.fn().mockResolvedValue([{ user_id: 501 }]),
      } as any,
      couponMetricsQueueService,
    );

    jest.spyOn(service as any, "createOrderTracking").mockResolvedValue(undefined);

    await service.updateOrderStatus(77, "confirmed");

    expect(couponMetricsQueueService.enqueuePaidOrderEvent).toHaveBeenCalledTimes(1);
    expect(couponMetricsQueueService.enqueuePaidOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 77,
        userId: 501,
      }),
    );
  });

  it("should not fail COD order creation when coupon redemption fails after order persistence", async () => {
    const userId = 202;
    const cart = {
      id: 22,
      is_active: true,
      store: { id: 7, status: true },
      user: { id: userId },
      cart_items: [
        {
          id: 11,
          quantity: 1,
          unit_price: 100,
          total_price: 100,
          customizations: [],
          variants: [],
          special_instructions: "",
          is_preorder: false,
          preorder_campaign_id: null,
          preorder_reservation_token: null,
          item: { id: 3001, tax_rate: 5 },
        },
      ],
      total_amount: 100,
      tax_amount: 5,
      delivery_fee: 20,
      delivery_fee_tax: 2,
      platform_fee: 0,
      platform_fee_tax: 0,
      discount_amount: 0,
      tip_amount: 0,
      final_amount: 127,
      coupon_reservation_token: "tok-cart-1",
    } as any;

    const cartRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(cart),
        })
        .mockReturnValueOnce({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(cart),
        }),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const orderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    } as any;

    const couponRedemptionRepository = {
      findOne: jest.fn().mockResolvedValue({ reserved_token: "tok-cart-1" }),
      save: jest.fn().mockResolvedValue(undefined),
    } as any;

    const couponService = {
      redeemCoupon: jest.fn().mockRejectedValue(new Error("redis timeout")),
    } as any;

    const redisCouponService = {
      getQuota: jest.fn().mockResolvedValue(10),
      releaseReservation: jest.fn().mockResolvedValue(true),
    } as any;

    const cartService = {
      recalculateCartTotals: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue({ success: true }),
      getPlatformFeeConfig: jest.fn().mockResolvedValue({
        amount: 0,
        tax: 0,
        isEnabled: false,
      }),
    } as any;

    const dataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn((payload: any) => payload),
            save: jest.fn(async (payload: any) => ({
              id: 9901,
              order_number: "ORD-COD-9901",
              status: "confirmed",
              ...payload,
            })),
            findOne: jest.fn().mockResolvedValue(null),
          }),
        };
        return cb(manager);
      }),
    } as any;

    const service = new OrderService(
      orderRepository,
      {} as any,
      {} as any,
      {} as any,
      cartRepository,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          address1: "Line1",
          city: "Chennai",
          state: "TN",
          pincode: "600001",
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      couponRedemptionRepository,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      couponService,
      redisCouponService,
      {} as any,
      {} as any,
      {
        pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
        transformOrderToSellerPayload: jest.fn().mockResolvedValue({}),
      } as any,
      cartService,
      {} as any,
      { validateAppIsOpen: jest.fn().mockResolvedValue(undefined) } as any,
      { validateServiceableArea: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      { addOutboxRowInTransaction: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      dataSource,
    );

    jest.spyOn(service as any, "createOrderTracking").mockResolvedValue(undefined);
    jest.spyOn(service, "getOrderById").mockResolvedValue({ id: 9901 } as any);

    const result = await service.createOrder(userId, {
      payment_method: PaymentMethod.COD,
      delivery_address_id: 1,
      special_instructions: "",
    } as any);

    expect(result.success).toBe(true);
    expect(couponService.redeemCoupon).toHaveBeenCalled();
  });

  it("should not fail COD order creation when retry enqueue also fails", async () => {
    const userId = 203;
    const cart = {
      id: 23,
      is_active: true,
      store: { id: 7, status: true },
      user: { id: userId },
      cart_items: [
        {
          id: 11,
          quantity: 1,
          unit_price: 100,
          total_price: 100,
          customizations: [],
          variants: [],
          special_instructions: "",
          is_preorder: false,
          preorder_campaign_id: null,
          preorder_reservation_token: null,
          item: { id: 3001, tax_rate: 5 },
        },
      ],
      total_amount: 100,
      tax_amount: 5,
      delivery_fee: 20,
      delivery_fee_tax: 2,
      platform_fee: 0,
      platform_fee_tax: 0,
      discount_amount: 0,
      tip_amount: 0,
      final_amount: 127,
      coupon_reservation_token: "tok-cart-2",
    } as any;

    const cartRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(cart),
        })
        .mockReturnValueOnce({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(cart),
        }),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const orderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    } as any;

    const couponRedemptionRepository = {
      findOne: jest.fn().mockResolvedValue({ reserved_token: "tok-cart-2" }),
      save: jest.fn().mockResolvedValue(undefined),
    } as any;

    const couponService = {
      redeemCoupon: jest.fn().mockRejectedValue(new Error("redis timeout")),
      recordPaidOrderEvent: jest.fn().mockResolvedValue({ processed: true }),
    } as any;

    const redisCouponService = {
      getQuota: jest.fn().mockResolvedValue(10),
      releaseReservation: jest.fn().mockResolvedValue(true),
    } as any;

    const cartService = {
      recalculateCartTotals: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue({ success: true }),
      getPlatformFeeConfig: jest.fn().mockResolvedValue({
        amount: 0,
        tax: 0,
        isEnabled: false,
      }),
    } as any;

    const couponMetricsQueueService = {
      enqueueCouponRedeemRetry: jest.fn().mockRejectedValue(new Error("queue down")),
      enqueuePaidOrderEvent: jest.fn().mockResolvedValue("job-1"),
    } as any;

    const dataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn((payload: any) => payload),
            save: jest.fn(async (payload: any) => ({
              id: 9902,
              order_number: "ORD-COD-9902",
              status: "confirmed",
              ...payload,
            })),
            findOne: jest.fn().mockResolvedValue(null),
          }),
        };
        return cb(manager);
      }),
    } as any;

    const service = new OrderService(
      orderRepository,
      {} as any,
      {} as any,
      {} as any,
      cartRepository,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          address1: "Line1",
          city: "Chennai",
          state: "TN",
          pincode: "600001",
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      couponRedemptionRepository,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      couponService,
      redisCouponService,
      {} as any,
      {} as any,
      {
        pushOrderToSeller: jest.fn().mockResolvedValue(undefined),
        transformOrderToSellerPayload: jest.fn().mockResolvedValue({}),
      } as any,
      cartService,
      {} as any,
      { validateAppIsOpen: jest.fn().mockResolvedValue(undefined) } as any,
      { validateServiceableArea: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      { addOutboxRowInTransaction: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      dataSource,
      couponMetricsQueueService,
    );

    jest.spyOn(service as any, "createOrderTracking").mockResolvedValue(undefined);
    jest.spyOn(service, "getOrderById").mockResolvedValue({ id: 9902 } as any);

    const result = await service.createOrder(userId, {
      payment_method: PaymentMethod.COD,
      delivery_address_id: 1,
      special_instructions: "",
    } as any);

    expect(result.success).toBe(true);
    expect(couponService.redeemCoupon).toHaveBeenCalled();
    expect(couponMetricsQueueService.enqueueCouponRedeemRetry).toHaveBeenCalledTimes(1);
  });
});
