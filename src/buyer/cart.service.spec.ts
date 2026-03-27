jest.mock(
  "src/super-admin-access/super-admin-access.service",
  () => ({
    AdminAccessService: class AdminAccessService {},
  }),
  { virtual: true },
);

import { CartService } from "./cart.service";
import { CouponType, ValueType } from "../coupon/entities/coupon.entity";

describe("CartService - cart summary coupon details", () => {
  const createService = (couponRepoOverrides: Record<string, any> = {}) => {
    const cartRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    const couponRepository = {
      findOne: jest.fn(),
      ...couponRepoOverrides,
    } as any;

    const appSettingsService = {
      getFromDb: jest.fn().mockImplementation(async (key: string) => {
        if (key === "INCLUDE_PLATFORM_FEE") return "true";
        if (key === "PLATFORM_FEE") return "0";
        return null;
      }),
    } as any;

    const service = new CartService(
      cartRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      couponRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      appSettingsService,
      {} as any,
    );

    return { service, cartRepository, couponRepository };
  };

  it("should return applied_coupon details for coupon-applied cart summary", async () => {
    const { service, couponRepository } = createService({
      findOne: jest.fn().mockResolvedValue({
        id: 2099,
        code: "AM-WNAWHU",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        type_meta: {
          free_delivery: true,
          delivery_fee_cap: 50,
          store_reference_id: "STORE-REF-150",
          item_reference_ids: ["ITEM-REF-1769"],
        },
      }),
    });

    (service as any).couponRepository = couponRepository;

    const summary = await (service as any).calculateCartSummary({
      id: 6658,
      delivery_fee: 30,
      delivery_percent: 18,
      delivery_fee_tax: 5,
      platform_fee: 0,
      platform_percent: 18,
      platform_fee_tax: 0,
      tax_amount: 5,
      discount_amount: 20,
      tip_amount: 0,
      cart_items: [],
      coupon_id: 2099,
      coupon_code: "AM-WNAWHU",
      store: { id: 150 },
    });

    expect(summary.applied_coupon).toEqual(
      expect.objectContaining({
        id: 2099,
        code: "AM-WNAWHU",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        discount_amount: 20,
        free_delivery: true,
        delivery_fee_cap: 50,
      }),
    );
    expect(summary.applied_offer).toEqual(
      expect.objectContaining({
        id: 2099,
        name: "Applied Coupon",
        offer_code: "AM-WNAWHU",
        discount_amount: 20,
      }),
    );
  });

  it("should keep generic applied_offer for non-coupon discount", async () => {
    const { service, couponRepository } = createService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    (service as any).couponRepository = couponRepository;

    const summary = await (service as any).calculateCartSummary({
      id: 7788,
      delivery_fee: 30,
      delivery_percent: 18,
      delivery_fee_tax: 5,
      platform_fee: 0,
      platform_percent: 18,
      platform_fee_tax: 0,
      tax_amount: 5,
      discount_amount: 20,
      tip_amount: 0,
      cart_items: [],
      store: { id: 150 },
    });

    expect(summary.applied_coupon).toBeUndefined();
    expect(summary.applied_offer).toEqual(
      expect.objectContaining({
        id: 1,
        name: "Applied Offer",
        offer_code: "OFFER",
        discount_amount: 20,
      }),
    );
  });

  describe("calculateCartSummary - flat coupon with free_delivery", () => {
    it("should waive delivery fee for flat coupon with free_delivery: true", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3001,
          code: "FLAT100FD",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            free_delivery: true,
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5001,
        delivery_fee: 60,
        delivery_percent: 18,
        delivery_fee_tax: 10.8,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3001,
        coupon_code: "FLAT100FD",
        store: { id: 200 },
      });

      expect(summary.delivery_fee).toBe(0);
      expect(summary.delivery_fee_tax).toBe(0);
      expect(summary.applied_coupon).toEqual(
        expect.objectContaining({
          id: 3001,
          code: "FLAT100FD",
          type: CouponType.FLAT,
          free_delivery: true,
        }),
      );
    });

    it("should cap delivery fee waiver at delivery_fee_cap for flat coupon", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3002,
          code: "FLAT100CAP50",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            free_delivery: true,
            delivery_fee_cap: 50,
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5002,
        delivery_fee: 80,
        delivery_percent: 18,
        delivery_fee_tax: 14.4,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3002,
        coupon_code: "FLAT100CAP50",
        store: { id: 200 },
      });

      // Delivery fee should be 80 - min(50, 80) = 30
      expect(summary.delivery_fee).toBe(30);
      // Tax should be recalculated: 30 * 18% = 5.4
      expect(summary.delivery_fee_tax).toBeCloseTo(5.4, 1);
    });

    it("should NOT waive delivery fee when free_delivery is false for flat coupon", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3003,
          code: "FLAT100NOFD",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            free_delivery: false,
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5003,
        delivery_fee: 60,
        delivery_percent: 18,
        delivery_fee_tax: 10.8,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3003,
        coupon_code: "FLAT100NOFD",
        store: { id: 200 },
      });

      expect(summary.delivery_fee).toBe(60);
      expect(summary.delivery_fee_tax).toBe(10.8);
    });

    it("should NOT waive delivery fee when free_delivery is omitted for flat coupon", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3004,
          code: "FLAT100OMIT",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            store_reference_id: "STORE-REF-200",
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5004,
        delivery_fee: 60,
        delivery_percent: 18,
        delivery_fee_tax: 10.8,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3004,
        coupon_code: "FLAT100OMIT",
        store: { id: 200 },
      });

      expect(summary.delivery_fee).toBe(60);
      expect(summary.delivery_fee_tax).toBe(10.8);
    });

    it("should handle flat coupon with free_delivery and delivery_fee_cap: 0", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3005,
          code: "FLAT100CAP0",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            free_delivery: true,
            delivery_fee_cap: 0,
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5005,
        delivery_fee: 80,
        delivery_percent: 18,
        delivery_fee_tax: 14.4,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3005,
        coupon_code: "FLAT100CAP0",
        store: { id: 200 },
      });

      // With cap of 0, no delivery fee is waived
      expect(summary.delivery_fee).toBe(80);
    });

    it("should include free_delivery and delivery_fee_cap in applied_coupon response for flat coupon", async () => {
      const { service, couponRepository, cartRepository } = createService({
        findOne: jest.fn().mockResolvedValue({
          id: 3006,
          code: "FLAT100SUMMARY",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            free_delivery: true,
            delivery_fee_cap: 50,
            store_reference_id: "STORE-REF-200",
            item_reference_ids: ["ITEM-REF-1", "ITEM-REF-2"],
          },
        }),
      });

      (service as any).couponRepository = couponRepository;
      (service as any).cartRepository = cartRepository;

      const summary = await (service as any).calculateCartSummary({
        id: 5006,
        delivery_fee: 60,
        delivery_percent: 18,
        delivery_fee_tax: 10.8,
        platform_fee: 0,
        platform_percent: 18,
        platform_fee_tax: 0,
        tax_amount: 50,
        discount_amount: 100,
        tip_amount: 0,
        cart_items: [],
        coupon_id: 3006,
        coupon_code: "FLAT100SUMMARY",
        store: { id: 200 },
      });

      expect(summary.applied_coupon).toEqual(
        expect.objectContaining({
          id: 3006,
          code: "FLAT100SUMMARY",
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          free_delivery: true,
          delivery_fee_cap: 50,
          store_reference_id: "STORE-REF-200",
          item_reference_ids: ["ITEM-REF-1", "ITEM-REF-2"],
        }),
      );
    });
  });
});

describe("CartService - preorder coupon blocking", () => {
  it("should block non-preorder coupons when cart has preorder items", async () => {
    const userId = 101;
    const cartId = 501;

    const cartRepository = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findOne: jest.fn(),
    } as any;

    const cartItemRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          is_preorder: true,
          quantity: 1,
          item: { id: 101 },
        },
      ]),
      delete: jest.fn(),
    } as any;

    const couponRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1001,
        code: "FLAT100",
        type: CouponType.FLAT, // Non-preorder coupon
        value: 100,
        value_type: ValueType.RUPEES,
      }),
    } as any;

    const locationService = {
      getUserLocation: jest.fn().mockResolvedValue({
        address: { pincode: "560001" },
      }),
    } as any;

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
      }),
    };

    (cartRepository.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const appSettingsService = {
      getFromDb: jest.fn().mockImplementation(async (key: string) => {
        if (key === "INCLUDE_PLATFORM_FEE") return "true";
        if (key === "PLATFORM_FEE") return "0";
        return null;
      }),
    } as any;

    const service = new CartService(
      cartRepository,
      cartItemRepository,
      {} as any, // itemRepository
      {} as any, // itemCustomizationGroupsRepository
      {} as any, // customizationRelationshipsRepository
      {} as any, // storeRepository
      {} as any, // userRepository
      {} as any, // offersRepository
      couponRepository,
      {} as any, // buyerService
      locationService,
      {} as any, // deliveryPricingService
      {} as any, // couponService
      {} as any, // redisCouponService
      {} as any, // configService
      {} as any, // appOperationHoursService
      appSettingsService,
      {} as any, // appServiceableAreaService
    );

    try {
      await (service as any).applyCoupon(userId, { coupon_code: "FLAT100" });
      fail("Expected BadRequestException to be thrown");
    } catch (error: any) {
      expect(error.message).toContain(
        "Preorder coupon discount was applied",
      );
    }
  });

  it("should allow preorder coupons when cart has preorder items", async () => {
    const userId = 101;
    const cartId = 501;

    const cartRepository = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
        cart_items: [],
        delivery_fee: 0,
        delivery_fee_tax: 0,
      }),
    } as any;

    const cartItemRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            id: 1,
            is_preorder: true,
            quantity: 1,
            total_price: 100,
            item: { id: 101 },
          },
        ]),
    } as any;

    const couponRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1001,
        code: "PREORDER001",
        type: CouponType.PREORDER, // Preorder coupon
        value: 50,
        value_type: ValueType.RUPEES,
      }),
    } as any;

    const couponService = {
      validateCoupon: jest.fn().mockResolvedValue({
        valid: true,
        discount_amount: 50,
        delivery_waived: false,
        reservation_token: "token-123",
      }),
      isReservationValid: jest.fn(),
    } as any;

    const locationService = {
      getUserLocation: jest.fn().mockResolvedValue({
        address: { pincode: "560001" },
      }),
    } as any;

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
      }),
    };

    (cartRepository.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const appSettingsService = {
      getFromDb: jest.fn().mockImplementation(async (key: string) => {
        if (key === "INCLUDE_PLATFORM_FEE") return "true";
        if (key === "PLATFORM_FEE") return "0";
        return null;
      }),
    } as any;

    const service = new CartService(
      cartRepository,
      cartItemRepository,
      {} as any, // itemRepository
      {} as any, // itemCustomizationGroupsRepository
      {} as any, // customizationRelationshipsRepository
      {} as any, // storeRepository
      {} as any, // userRepository
      {} as any, // offersRepository
      couponRepository,
      {} as any, // buyerService
      locationService,
      {} as any, // deliveryPricingService
      couponService,
      {} as any, // redisCouponService
      {} as any, // configService
      {} as any, // appOperationHoursService
      appSettingsService,
      {} as any, // appServiceableAreaService
    );

    // Mock the private method
    (service as any).buildCouponValidationContextFromCartItems = jest
      .fn()
      .mockResolvedValue({});
    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);
    (service as any).calculateCartSummary = jest.fn().mockResolvedValue({
      items: [],
      applied_coupon: {
        code: "PREORDER001",
        type: CouponType.PREORDER,
      },
    });
    (service as any).getCartCouponValidation = jest.fn().mockResolvedValue({
      is_valid: true,
      validation_status: "VALID",
    });

    const result = await (service as any).applyCoupon(userId, {
      coupon_code: "PREORDER001",
    });

    expect(result.success).toBe(true);
    expect(result.data.coupon_code).toBe("PREORDER001");
    expect(result.data.coupon_validation).toEqual(
      expect.objectContaining({
        is_valid: true,
        validation_status: "VALID",
      }),
    );
  });

  it("should allow any coupon when cart has no preorder items", async () => {
    const userId = 101;
    const cartId = 501;

    const cartRepository = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
        cart_items: [],
        delivery_fee: 0,
        delivery_fee_tax: 0,
      }),
    } as any;

    const cartItemRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          is_preorder: false, // No preorder items
          quantity: 1,
          total_price: 100,
          item: { id: 101 },
        },
      ]),
    } as any;

    const couponRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1001,
        code: "FLAT100",
        type: CouponType.FLAT, // Non-preorder coupon should be allowed
        value: 100,
        value_type: ValueType.RUPEES,
      }),
    } as any;

    const couponService = {
      validateCoupon: jest.fn().mockResolvedValue({
        valid: true,
        discount_amount: 100,
        delivery_waived: false,
        reservation_token: "token-456",
      }),
      isReservationValid: jest.fn(),
    } as any;

    const locationService = {
      getUserLocation: jest.fn().mockResolvedValue({
        address: { pincode: "560001" },
      }),
    } as any;

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
      }),
    };

    (cartRepository.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const appSettingsService = {
      getFromDb: jest.fn().mockImplementation(async (key: string) => {
        if (key === "INCLUDE_PLATFORM_FEE") return "true";
        if (key === "PLATFORM_FEE") return "0";
        return null;
      }),
    } as any;

    const service = new CartService(
      cartRepository,
      cartItemRepository,
      {} as any, // itemRepository
      {} as any, // itemCustomizationGroupsRepository
      {} as any, // customizationRelationshipsRepository
      {} as any, // storeRepository
      {} as any, // userRepository
      {} as any, // offersRepository
      couponRepository,
      {} as any, // buyerService
      locationService,
      {} as any, // deliveryPricingService
      couponService,
      {} as any, // redisCouponService
      {} as any, // configService
      {} as any, // appOperationHoursService
      appSettingsService,
      {} as any, // appServiceableAreaService
    );

    (service as any).buildCouponValidationContextFromCartItems = jest
      .fn()
      .mockResolvedValue({});
    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);
    (service as any).calculateCartSummary = jest.fn().mockResolvedValue({
      items: [],
      applied_coupon: {
        code: "FLAT100",
        type: CouponType.FLAT,
      },
    });
    (service as any).getCartCouponValidation = jest.fn().mockResolvedValue({
      is_valid: true,
      validation_status: "VALID",
      minimum_order_amount: 100,
    });

    const result = await (service as any).applyCoupon(userId, {
      coupon_code: "FLAT100",
    });

    expect(result.success).toBe(true);
    expect(result.data.coupon_code).toBe("FLAT100");
    expect(result.data.coupon_validation).toEqual(
      expect.objectContaining({
        is_valid: true,
        validation_status: "VALID",
        minimum_order_amount: 100,
      }),
    );
  });
});

describe("CartService - coupon_validation response fields", () => {
  const appSettingsService = {
    getFromDb: jest.fn().mockImplementation(async (key: string) => {
      if (key === "INCLUDE_PLATFORM_FEE") return "true";
      if (key === "PLATFORM_FEE") return "0";
      return null;
    }),
  } as any;

  const createService = (overrides: Record<string, any> = {}) => {
    const cartRepository = overrides.cartRepository || {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const cartItemRepository = overrides.cartItemRepository || {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    };
    const itemRepository = overrides.itemRepository || {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new CartService(
      cartRepository as any,
      cartItemRepository as any,
      itemRepository as any,
      (overrides.itemCustomizationGroupsRepository || {}) as any,
      (overrides.customizationRelationshipsRepository || {}) as any,
      (overrides.storeRepository || {}) as any,
      (overrides.userRepository || {}) as any,
      (overrides.offersRepository || {}) as any,
      (overrides.couponRepository || { findOne: jest.fn() }) as any,
      (overrides.buyerService || { checkItemHasCustomizations: jest.fn().mockResolvedValue(false) }) as any,
      (overrides.locationService || {
        getUserLocation: jest.fn().mockResolvedValue({
          lat: 10,
          lng: 20,
          address: { pincode: "560001" },
        }),
      }) as any,
      (overrides.deliveryPricingService || {}) as any,
      (overrides.couponService || { rollbackCoupon: jest.fn() }) as any,
      (overrides.redisCouponService || {}) as any,
      (overrides.configService || {}) as any,
      (overrides.appOperationHoursService || {
        validateAppIsOpen: jest.fn().mockResolvedValue(undefined),
      }) as any,
      appSettingsService,
      (overrides.appServiceableAreaService || {
        validateServiceableArea: jest.fn().mockResolvedValue(undefined),
      }) as any,
    );

    return {
      service,
      cartRepository,
      cartItemRepository,
      itemRepository,
    };
  };

  it("should return coupon_validation as null for empty cart", async () => {
    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const { service, cartRepository } = createService({
      cartRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      },
    });

    const result = await service.getCart(101);

    expect(cartRepository.createQueryBuilder).toHaveBeenCalled();
    expect(result.data.coupon_validation).toBeNull();
  });

  it("should return coupon_validation in addToCart response", async () => {
    const itemQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 11,
        store: { id: 5, status: true },
        prices: [{ base_price: 120 }],
        quantities: [{ available_count: 10 }],
      }),
    };

    const cartQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const cartItemQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const { service, cartRepository, cartItemRepository, itemRepository } = createService({
      cartRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(cartQueryBuilder),
        findOne: jest.fn().mockResolvedValue({
          id: 501,
          store: { id: 5, name: "Store" },
          user: { id: 101 },
          cart_items: [],
        }),
      },
      cartItemRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(cartItemQueryBuilder),
        create: jest.fn().mockImplementation((value: any) => value),
        save: jest.fn().mockResolvedValue({ id: 9001 }),
      },
      itemRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(itemQueryBuilder),
      },
    });

    (service as any).createCart = jest.fn().mockResolvedValue({
      id: 501,
      store: { id: 5 },
      cart_items: [],
    });
    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);
    (service as any).calculateCartSummary = jest.fn().mockResolvedValue({
      subtotal: 120,
    });
    (service as any).syncAppliedCouponValidation = jest.fn().mockResolvedValue({
      is_valid: true,
      validation_status: "VALID",
    });

    const result = await service.addToCart(101, {
      item_id: 11,
      restaurant_id: 5,
      quantity: 1,
    } as any);

    expect(itemRepository.createQueryBuilder).toHaveBeenCalled();
    expect(cartItemRepository.save).toHaveBeenCalled();
    expect(result.coupon_validation).toEqual(
      expect.objectContaining({
        is_valid: true,
        validation_status: "VALID",
      }),
    );
  });

  it("should return coupon_validation in updateCartItem response", async () => {
    const cartItemQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 71,
        quantity: 1,
        customizations: [],
        variants: [],
        special_instructions: null,
        is_preorder: false,
        cart: {
          id: 501,
          is_active: true,
          store: { id: 5 },
          coupon_id: 1,
          coupon_code: "SAVE100",
          coupon_reservation_token: "token-1",
        },
        item: {
          id: 11,
          store: { status: true },
          prices: [{ base_price: 120 }],
        },
      }),
    };

    const { service, cartRepository, cartItemRepository } = createService({
      cartRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 501,
          store: { id: 5, name: "Store" },
          user: { id: 101 },
          cart_items: [],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      cartItemRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(cartItemQueryBuilder),
        save: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);
    (service as any).calculateCartSummary = jest.fn().mockResolvedValue({
      subtotal: 240,
    });
    (service as any).syncAppliedCouponValidation = jest.fn().mockResolvedValue({
      is_valid: true,
      validation_status: "VALID",
    });
    (service as any).getCartCouponValidation = jest.fn().mockResolvedValue({
      is_valid: true,
      validation_status: "VALID",
    });

    const result = await service.updateCartItem(101, {
      cart_item_id: 71,
      quantity: 2,
    } as any);

    expect(cartItemRepository.save).toHaveBeenCalled();
    expect(cartRepository.findOne).toHaveBeenCalled();
    expect(result.coupon_validation).toEqual(
      expect.objectContaining({
        is_valid: true,
        validation_status: "VALID",
      }),
    );
  });

  it("should preserve sync invalid diagnostics in updateCartItem response", async () => {
    const cartItemQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 72,
        quantity: 1,
        customizations: [],
        variants: [],
        special_instructions: null,
        is_preorder: false,
        cart: {
          id: 502,
          is_active: true,
          store: { id: 5 },
          coupon_id: 1,
          coupon_code: "SAVE100",
          coupon_reservation_token: "token-2",
        },
        item: {
          id: 12,
          store: { status: true },
          prices: [{ base_price: 100 }],
        },
      }),
    };

    const { service, cartRepository, cartItemRepository } = createService({
      cartRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 502,
          store: { id: 5, name: "Store" },
          user: { id: 101 },
          cart_items: [],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      cartItemRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(cartItemQueryBuilder),
        save: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);
    (service as any).calculateCartSummary = jest.fn().mockResolvedValue({
      subtotal: 100,
    });
    (service as any).syncAppliedCouponValidation = jest.fn().mockResolvedValue({
      is_valid: false,
      validation_status: "MIN_CART_NOT_MET",
      invalid_reason_code: "MIN_CART_NOT_MET",
    });
    (service as any).getCartCouponValidation = jest.fn().mockResolvedValue(null);

    const result = await service.updateCartItem(101, {
      cart_item_id: 72,
      quantity: 1,
    } as any);

    expect(cartItemRepository.save).toHaveBeenCalled();
    expect(cartRepository.findOne).toHaveBeenCalled();
    expect(result.coupon_validation).toEqual(
      expect.objectContaining({
        is_valid: false,
        validation_status: "MIN_CART_NOT_MET",
        invalid_reason_code: "MIN_CART_NOT_MET",
      }),
    );
  });

  it("should not clear coupon for non-destructive validation failures", async () => {
    const rollbackCoupon = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const { service, cartRepository } = createService({
      cartRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 600,
          coupon_id: 33,
          coupon_code: "SAVE100",
          coupon_reservation_token: "res-1",
          store: { id: 5 },
          user: { id: 101 },
          cart_items: [],
        }),
        update,
      },
      couponService: {
        rollbackCoupon,
      },
    });

    (service as any).getCartCouponValidationSnapshot = jest
      .fn()
      .mockResolvedValue({
        coupon_validation: {
          is_valid: false,
          validation_status: "PINCODE_REQUIRED",
          minimum_order_amount: 100,
          minimum_order_basis: "SUBTOTAL",
          eligible_subtotal: 120,
          is_minimum_order_satisfied: true,
          invalid_reason_code: "PINCODE_REQUIRED",
          invalid_reason_message: "User location missing",
          is_restaurant_eligible: true,
          are_items_eligible: true,
        },
        validation: {
          valid: false,
          reason_code: "PINCODE_REQUIRED",
          message: "User location missing",
        },
        coupon: { id: 33, type: CouponType.FLAT },
        cart: { id: 600 },
      });
    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);

    const result = await (service as any).syncAppliedCouponValidation(600, 101);

    expect(result).toEqual(
      expect.objectContaining({
        is_valid: false,
        invalid_reason_code: "PINCODE_REQUIRED",
      }),
    );
    expect(rollbackCoupon).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("should preserve preorder discount formula during coupon sync", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const { service } = createService({
      cartRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 700,
          coupon_id: 44,
          coupon_code: "PRE001",
          coupon_reservation_token: "res-2",
          store: { id: 5 },
          user: { id: 101 },
          cart_items: [
            {
              is_preorder: true,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              item: { tax_rate: 5 },
            },
          ],
        }),
        update,
      },
    });

    (service as any).getCartCouponValidationSnapshot = jest
      .fn()
      .mockResolvedValue({
        coupon_validation: {
          is_valid: true,
          validation_status: "VALID",
          minimum_order_amount: 0,
          minimum_order_basis: "SUBTOTAL",
          eligible_subtotal: 100,
          is_minimum_order_satisfied: true,
          invalid_reason_code: null,
          invalid_reason_message: null,
          is_restaurant_eligible: true,
          are_items_eligible: true,
        },
        validation: {
          valid: true,
          discount_amount: 20,
          delivery_waived: false,
        },
        coupon: {
          id: 44,
          type: CouponType.PREORDER,
          value: 20,
          value_type: ValueType.RUPEES,
        },
        cart: { id: 700 },
      });
    (service as any).updateCartTotals = jest.fn().mockResolvedValue(undefined);

    await (service as any).syncAppliedCouponValidation(700, 101);

    expect(update).toHaveBeenCalledWith(
      700,
      expect.objectContaining({
        discount_amount: 21,
      }),
    );
  });

  it("should return coupon_validation in applyCoupon invalid error response", async () => {
    const userId = 101;
    const cartId = 501;

    const cartRepository = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    } as any;

    const cartItemRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          is_preorder: false,
          quantity: 1,
          total_price: 80,
          item: { id: 101, reference_id: "REF-101" },
        },
      ]),
    } as any;

    const couponRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1001,
        code: "FLAT100",
        type: CouponType.FLAT,
        min_cart_value: 100,
        value: 100,
        value_type: ValueType.RUPEES,
        type_meta: {},
      }),
    } as any;

    const couponService = {
      validateCoupon: jest.fn().mockResolvedValue({
        valid: false,
        reason_code: "MIN_CART_NOT_MET",
        message: "Minimum cart value of ₹100 required",
      }),
      isReservationValid: jest.fn(),
    } as any;

    const locationService = {
      getUserLocation: jest.fn().mockResolvedValue({
        address: { pincode: "560001" },
      }),
    } as any;

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
      }),
    };

    (cartRepository.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const service = new CartService(
      cartRepository,
      cartItemRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      couponRepository,
      {} as any,
      locationService,
      {} as any,
      couponService,
      {} as any,
      {} as any,
      {} as any,
      appSettingsService,
      {} as any,
    );

    (service as any).buildCouponValidationContextFromCartItems = jest
      .fn()
      .mockResolvedValue({});

    try {
      await (service as any).applyCoupon(userId, { coupon_code: "FLAT100" });
      fail("Expected BadRequestException to be thrown");
    } catch (error: any) {
      const response =
        typeof error.getResponse === "function"
          ? error.getResponse()
          : error.response;

      expect(response).toEqual(
        expect.objectContaining({
          message: "Minimum cart value of ₹100 required",
          coupon_validation: expect.objectContaining({
            is_valid: false,
            validation_status: "MIN_CART_NOT_MET",
            minimum_order_amount: 100,
            invalid_reason_code: "MIN_CART_NOT_MET",
          }),
        }),
      );
    }
  });

  it("should return coupon_validation on applyCoupon pincode error", async () => {
    const userId = 101;
    const cartId = 501;

    const cartRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    const cartItemRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          is_preorder: false,
          quantity: 1,
          total_price: 120,
          item: { id: 101, reference_id: "REF-101" },
        },
      ]),
    } as any;

    const couponRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1001,
        code: "FLAT100",
        type: CouponType.FLAT,
        min_cart_value: 100,
        value: 100,
        value_type: ValueType.RUPEES,
        type_meta: {},
      }),
    } as any;

    const locationService = {
      getUserLocation: jest.fn().mockResolvedValue({
        address: { pincode: null },
      }),
    } as any;

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: cartId,
        is_active: true,
        store: { id: 5, status: true },
        coupon_id: null,
        coupon_code: null,
        coupon_reservation_token: null,
        user: { id: userId },
      }),
    };

    (cartRepository.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const service = new CartService(
      cartRepository,
      cartItemRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      couponRepository,
      {} as any,
      locationService,
      {} as any,
      { validateCoupon: jest.fn(), isReservationValid: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      appSettingsService,
      {} as any,
    );

    try {
      await (service as any).applyCoupon(userId, { coupon_code: "FLAT100" });
      fail("Expected BadRequestException to be thrown");
    } catch (error: any) {
      const response =
        typeof error.getResponse === "function"
          ? error.getResponse()
          : error.response;

      expect(response).toEqual(
        expect.objectContaining({
          message: "User location (pincode) is required to apply coupon",
          coupon_validation: expect.objectContaining({
            is_valid: false,
            validation_status: "PINCODE_REQUIRED",
            invalid_reason_code: "PINCODE_REQUIRED",
          }),
        }),
      );
    }
  });
});
