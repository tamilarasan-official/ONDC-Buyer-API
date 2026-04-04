import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CouponService } from "./coupon.service";
import { RedisCouponService } from "./redis-coupon.service";
import { CouponCampaign } from "../entities/coupon-campaign.entity";
import {
  Coupon,
  CouponType,
  ValueType,
  CouponStatus,
} from "../entities/coupon.entity";
import {
  CouponRedemption,
  RedemptionStatus,
} from "../entities/coupon-redemption.entity";
import { PaymentStatus } from "../dto/redeem-coupon.dto";
import { CouponCounter } from "../entities/coupon-counter.entity";
import { Item } from "../../item/entities/item.entity";
import { Store } from "../../store/entities/store.entity";
import { Cart } from "../../cart/entities/cart.entity";
import { CartItem } from "../../cart/entities/cart-item.entity";

describe("CouponService", () => {
  let service: CouponService;
  let mockCampaignRepo: any;
  let mockCouponRepo: any;
  let mockRedemptionRepo: any;
  let mockCounterRepo: any;
  let mockItemRepo: any;
  let mockStoreRepo: any;
  let mockCartRepo: any;
  let mockCartItemRepo: any;
  let mockRedisService: any;
  let mockDataSource: any;
  let mockConfigService: any;
  let mockSchedulerRegistry: any;

  beforeEach(async () => {
    mockCampaignRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockCouponRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockRedemptionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    mockCounterRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockItemRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockStoreRepo = {
      findOne: jest.fn(),
    };

    mockCartRepo = {
      findOne: jest.fn(),
    };

    mockCartItemRepo = {
      find: jest.fn(),
    };

    mockRedisService = {
      initializeQuota: jest.fn(),
      initializeQuotaIfAbsent: jest.fn(),
      reserveCoupon: jest.fn(),
      getReservation: jest.fn(),
      releaseReservation: jest.fn(),
      getQuota: jest.fn(),
      incrementQuota: jest.fn(),
      deleteReservation: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(),
      query: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue("*/10 * * * *"),
    };

    mockSchedulerRegistry = {
      addCronJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        {
          provide: getRepositoryToken(CouponCampaign),
          useValue: mockCampaignRepo,
        },
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockCouponRepo,
        },
        {
          provide: getRepositoryToken(CouponRedemption),
          useValue: mockRedemptionRepo,
        },
        {
          provide: getRepositoryToken(CouponCounter),
          useValue: mockCounterRepo,
        },
        {
          provide: getRepositoryToken(Item),
          useValue: mockItemRepo,
        },
        {
          provide: getRepositoryToken(Store),
          useValue: mockStoreRepo,
        },
        {
          provide: getRepositoryToken(Cart),
          useValue: mockCartRepo,
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: mockCartItemRepo,
        },
        {
          provide: RedisCouponService,
          useValue: mockRedisService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("validateCoupon - flat type", () => {
    it("should validate flat coupon successfully", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "FLAT100",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 500,
        user_usage_limit: 1,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const dto = {
        code: "FLAT100",
        cart_total: 1000,
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(100);
    });

    it("should reject if min cart value not met", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "FLAT100",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 500,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const dto = {
        code: "FLAT100",
        cart_total: 300, // Less than min_cart_value
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("MIN_CART_NOT_MET");
    });

    it("should reject when reserved+redeemed count already reached global usage limit", async () => {
      const coupon: Partial<Coupon> = {
        id: 11,
        code: "FLAT-LIMIT-1",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        global_usage_limit: 1,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(1);
      mockRedisService.getQuota.mockResolvedValue(5);

      const result = await service.validateCoupon({
        code: "FLAT-LIMIT-1",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("QUOTA_EXCEEDED");
    });

    it("should rebuild missing Redis quota from DB and set it once", async () => {
      const coupon: Partial<Coupon> = {
        id: 12,
        code: "FLAT-REBUILD",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        global_usage_limit: 10,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(3);
      mockRedisService.getQuota
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(7);
      mockRedisService.initializeQuotaIfAbsent.mockResolvedValue(true);

      const result = await service.validateCoupon({
        code: "FLAT-REBUILD",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(true);
      expect(mockRedisService.initializeQuotaIfAbsent).toHaveBeenCalledWith(
        12,
        7,
      );
    });
  });

  describe("validateCoupon - percent type", () => {
    it("should calculate percent discount with max cap", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "PERCENT20",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const dto = {
        code: "PERCENT20",
        cart_total: 5000, // 20% = 1000, but capped at 500
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(500); // Capped at max_discount_amount
    });

    it("should never return discount greater than cart total", async () => {
      const coupon: Partial<Coupon> = {
        id: 2,
        code: "PERCENT100",
        type: CouponType.PERCENT,
        value: 100,
        value_type: ValueType.PERCENT,
        max_discount_amount: 5000,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const dto = {
        code: "PERCENT100",
        cart_total: 1000,
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(1000);
    });

    it("should reject malformed persisted percent coupon config", async () => {
      const coupon: Partial<Coupon> = {
        id: 3,
        code: "PERCENT_BAD_CONFIG",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);

      const result = await service.validateCoupon({
        code: "PERCENT_BAD_CONFIG",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });

    it("should compensate Redis reservation when reservation row save fails", async () => {
      const coupon: Partial<Coupon> = {
        id: 4,
        campaign_id: 2,
        code: "PERCENT20_RESERVE",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 2,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockRedisService.reserveCoupon.mockResolvedValue({
        success: true,
        token: "res-token",
        ttl: 900,
      });
      mockRedemptionRepo.create.mockImplementation((v: any) => v);
      mockRedemptionRepo.save.mockRejectedValue(new Error("db down"));
      mockRedisService.releaseReservation.mockResolvedValue(true);

      const result = await service.validateCoupon({
        code: "PERCENT20_RESERVE",
        user_id: 42,
        cart_total: 1000,
        pincode: "600001",
        reserve: true,
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("RESERVATION_PERSIST_FAILED");
      expect(mockRedisService.releaseReservation).toHaveBeenCalledTimes(1);
    });

    it("should validate store-wide percent coupon only for matching store", async () => {
      const coupon: Partial<Coupon> = {
        id: 5,
        code: "STORE20",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const validResult = await service.validateCoupon({
        code: "STORE20",
        cart_total: 1000,
        pincode: "600001",
        store_id: 12,
      });

      expect(validResult.valid).toBe(true);
      expect(validResult.discount_amount).toBe(200);

      const invalidResult = await service.validateCoupon({
        code: "STORE20",
        cart_total: 1000,
        pincode: "600001",
        store_id: 99,
      });

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason_code).toBe("INVALID_STORE");
    });

    it("should use eligible item subtotal for product scoped percent coupon", async () => {
      const coupon: Partial<Coupon> = {
        id: 6,
        code: "ITEM20",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
          internal_item_ids: [1001, 1002],
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockCartRepo.findOne.mockResolvedValue({ id: 81 });
      mockCartItemRepo.find.mockResolvedValue([
        { item: { id: 1001 }, total_price: 250 },
        { item: { id: 5555 }, total_price: 750 },
      ]);

      const result = await service.validateCoupon({
        code: "ITEM20",
        cart_total: 1000,
        pincode: "600001",
        user_id: 77,
        store_id: 12,
        item_ids: [1001, 5555],
        eligible_item_subtotal: 250,
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(50);
    });

    it("should require eligible item subtotal for product scoped percent coupon", async () => {
      const coupon: Partial<Coupon> = {
        id: 7,
        code: "ITEM20_NOSUBTOTAL",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
          internal_item_ids: [1001],
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockCartRepo.findOne.mockResolvedValue({ id: 81 });
      mockCartItemRepo.find.mockResolvedValue([
        { item: { id: 1001 }, total_price: 250 },
      ]);

      const result = await service.validateCoupon({
        code: "ITEM20_NOSUBTOTAL",
        cart_total: 1000,
        pincode: "600001",
        user_id: 77,
        store_id: 12,
        item_ids: [1001],
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(50);
    });

    it("should ignore client supplied eligible subtotal and use server cart totals", async () => {
      const coupon: Partial<Coupon> = {
        id: 8,
        code: "ITEM20_SERVER",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
          internal_item_ids: [1001],
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockCartRepo.findOne.mockResolvedValue({ id: 82 });
      mockCartItemRepo.find.mockResolvedValue([
        { item: { id: 1001 }, total_price: 200 },
        { item: { id: 9999 }, total_price: 800 },
      ]);

      const result = await service.validateCoupon({
        code: "ITEM20_SERVER",
        cart_total: 1000,
        pincode: "600001",
        user_id: 77,
        store_id: 12,
        item_ids: [1001],
        eligible_item_subtotal: 1000,
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(40);
    });

    it("should reject malformed percent type_meta with unknown keys", async () => {
      const coupon: Partial<Coupon> = {
        id: 80,
        code: "PERCENT_UNKNOWN",
        type: CouponType.PERCENT,
        value: 15,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          store_id: 44,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: "PERCENT_UNKNOWN",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });
  });

  describe("validateCoupon - flat scoped type", () => {
    it("should validate store-wide flat coupon only for matching store", async () => {
      const coupon: Partial<Coupon> = {
        id: 90,
        code: "FLAT_SCOPE",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const validResult = await service.validateCoupon({
        code: "FLAT_SCOPE",
        cart_total: 1000,
        pincode: "600001",
        store_id: 12,
      });

      expect(validResult.valid).toBe(true);
      expect(validResult.discount_amount).toBe(100);

      const invalidResult = await service.validateCoupon({
        code: "FLAT_SCOPE",
        cart_total: 1000,
        pincode: "600001",
        store_id: 9,
      });

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason_code).toBe("INVALID_STORE");
    });

    it("should use eligible item subtotal for product scoped flat coupon", async () => {
      const coupon: Partial<Coupon> = {
        id: 91,
        code: "FLAT_ITEM",
        type: CouponType.FLAT,
        value: 300,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
          internal_item_ids: [1001],
          free_delivery: true,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockCartRepo.findOne.mockResolvedValue({ id: 77 });
      mockCartItemRepo.find.mockResolvedValue([
        { item: { id: 1001 }, total_price: 180 },
        { item: { id: 9999 }, total_price: 500 },
      ]);

      const result = await service.validateCoupon({
        code: "FLAT_ITEM",
        cart_total: 680,
        pincode: "600001",
        user_id: 1,
        store_id: 12,
        item_ids: [1001, 9999],
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(180);
      expect(result.delivery_waived).toBe(true);
    });

    it("should reject malformed flat type_meta with unknown keys", async () => {
      const coupon: Partial<Coupon> = {
        id: 92,
        code: "FLAT_UNKNOWN",
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          store_id: 12,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: "FLAT_UNKNOWN",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });
  });

  describe("validateCoupon - free_delivery type", () => {
    it("should apply cap using actual delivery_fee from request context", async () => {
      const coupon: Partial<Coupon> = {
        id: 120,
        code: "FD_CAP_40",
        type: CouponType.FREE_DELIVERY,
        value: 0,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          delivery_fee_cap: 40,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await service.validateCoupon({
        code: "FD_CAP_40",
        cart_total: 800,
        pincode: "600001",
        delivery_fee: 60,
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(40);
      expect(result.delivery_waived).toBe(true);
    });

    it("should reject free_delivery validation when request delivery_fee context is missing", async () => {
      const coupon: Partial<Coupon> = {
        id: 121,
        code: "FD_NO_CTX",
        type: CouponType.FREE_DELIVERY,
        value: 0,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          delivery_fee_cap: 30,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await service.validateCoupon({
        code: "FD_NO_CTX",
        cart_total: 800,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("DELIVERY_FEE_REQUIRED");
    });

    it("should reject malformed free_delivery persisted config", async () => {
      const coupon: Partial<Coupon> = {
        id: 122,
        code: "FD_BAD_CFG",
        type: CouponType.FREE_DELIVERY,
        value: 10,
        value_type: ValueType.PERCENT,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: "FD_BAD_CFG",
        cart_total: 1000,
        pincode: "600001",
        delivery_fee: 50,
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });
  });

  describe("redeemCoupon - idempotency", () => {
    it("should return existing redeemed result without Redis lookup for duplicate callback", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        status: RedemptionStatus.REDEEMED,
        amount_applied: 150,
        delivery_waived: false,
      });

      const result = await service.redeemCoupon({
        reservation_token: "550e8400-e29b-41d4-a716-446655440000",
        order_id: 101,
        user_id: 55,
        payment_status: PaymentStatus.PAID,
        idempotency_key: "pay-evt-1",
      });

      expect(result.success).toBe(true);
      expect(result.discount_amount).toBe(150);
      expect(mockRedisService.getReservation).not.toHaveBeenCalled();
    });

    it("should reject reserveCoupon for malformed persisted percent config", async () => {
      const malformedCoupon: Partial<Coupon> = {
        id: 10,
        code: "BAD_RESERVE_PERCENT",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(malformedCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);

      await expect(
        service.reserveCoupon({
          code: "BAD_RESERVE_PERCENT",
          user_id: 101,
          cart_total: 1000,
          pincode: "600001",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow free_delivery reservation when delivery_fee is provided", async () => {
      const coupon: Partial<Coupon> = {
        id: 122,
        code: "FD_RESERVE_OK",
        type: CouponType.FREE_DELIVERY,
        value: 0,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          delivery_fee_cap: 30,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockRedisService.reserveCoupon.mockResolvedValue({ success: true });
      mockRedemptionRepo.create.mockImplementation((payload) => payload);
      mockRedemptionRepo.save.mockImplementation(async (payload) => payload);

      const result = await service.reserveCoupon({
        code: "FD_RESERVE_OK",
        user_id: 101,
        cart_total: 800,
        delivery_fee: 45,
        pincode: "600001",
      } as any);

      expect(result.reservation_token).toBeDefined();
      expect(result.expires_in_seconds).toBeGreaterThan(0);
      expect(mockRedisService.reserveCoupon).toHaveBeenCalled();
    });

    it("should handle duplicate concurrent redeem attempts safely", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);

      const reservationPayload = {
        coupon_id: 7,
        cart_total: 1000,
      };

      mockRedisService.getReservation.mockResolvedValue(reservationPayload);
      mockCouponRepo.findOne.mockResolvedValue({
        id: 7,
        code: "PERCENT20",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
      } as any);

      let findOneCall = 0;
      const firstRedemptionRecord: any = {
        status: RedemptionStatus.RESERVED,
        amount_applied: null,
        delivery_waived: false,
      };

      const queryRunnerFactory = () => {
        const manager = {
          findOne: jest.fn().mockImplementation(() => {
            findOneCall += 1;
            if (findOneCall === 1) {
              return Promise.resolve(firstRedemptionRecord);
            }
            return Promise.resolve({
              status: RedemptionStatus.REDEEMED,
              amount_applied: 200,
              delivery_waived: false,
            });
          }),
          save: jest.fn().mockResolvedValue(undefined),
        };

        return {
          manager,
          connect: jest.fn().mockResolvedValue(undefined),
          startTransaction: jest.fn().mockResolvedValue(undefined),
          commitTransaction: jest.fn().mockResolvedValue(undefined),
          rollbackTransaction: jest.fn().mockResolvedValue(undefined),
          release: jest.fn().mockResolvedValue(undefined),
        };
      };

      mockDataSource.createQueryRunner
        .mockImplementationOnce(() => queryRunnerFactory())
        .mockImplementationOnce(() => queryRunnerFactory());

      const payload = {
        reservation_token: "550e8400-e29b-41d4-a716-446655440000",
        order_id: 501,
        user_id: 42,
        payment_status: PaymentStatus.PAID,
        idempotency_key: "race-test-key",
      };

      const [r1, r2] = await Promise.all([
        service.redeemCoupon(payload as any),
        service.redeemCoupon(payload as any),
      ]);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(mockRedisService.deleteReservation).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateCodes - percent type safety", () => {
    it("should reject percent coupon when value_type is not percent", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PERCENT,
          value: 20,
          value_type: ValueType.RUPEES,
          max_discount_amount: 500,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject percent coupon when value is outside (0, 100]", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PERCENT,
          value: 150,
          value_type: ValueType.PERCENT,
          max_discount_amount: 500,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow global percent coupon when store and items are not provided", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);
      mockCouponRepo.create.mockImplementation((v: any) => v);
      mockCouponRepo.save.mockResolvedValue([{ id: 99, code: "GLOBAL-1" }]);

      const result = await service.generateCodes(1, {
        count: 1,
        type: CouponType.PERCENT,
        value: 15,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
      } as any);

      expect(result.preview).toBe(false);
      expect(result.codes).toHaveLength(1);
    });

    it("should reject percent coupon when item references are provided without store reference", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PERCENT,
          value: 20,
          value_type: ValueType.PERCENT,
          max_discount_amount: 500,
          type_meta: {
            item_reference_ids: ["ITEM-1"],
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should resolve store and item references for scoped percent coupon generation", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);
      mockCouponRepo.create.mockImplementation((v: any) => v);
      mockCouponRepo.save.mockResolvedValue([{ id: 99, code: "SCOPED-1" }]);
      mockStoreRepo.findOne.mockResolvedValue({
        id: 44,
        reference_id: "STORE-REF-44",
      });
      mockItemRepo.find.mockResolvedValue([
        { id: 501, reference_id: "ITEM-1" },
        { id: 502, reference_id: "ITEM-2" },
      ]);

      await service.generateCodes(1, {
        count: 1,
        type: CouponType.PERCENT,
        value: 15,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
        type_meta: {
          store_reference_id: "STORE-REF-44",
          item_reference_ids: ["ITEM-1", "ITEM-2"],
          free_delivery: true,
        },
      } as any);

      expect(mockStoreRepo.findOne).toHaveBeenCalled();
      expect(mockItemRepo.find).toHaveBeenCalled();
      expect(mockCouponRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type_meta: expect.objectContaining({
            store_reference_id: "STORE-REF-44",
            internal_store_id: 44,
            internal_item_ids: [501, 502],
          }),
        }),
      );
    });

    it("should reject unknown keys in percent type_meta", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PERCENT,
          value: 20,
          value_type: ValueType.PERCENT,
          max_discount_amount: 500,
          type_meta: {
            store_id: 44,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("generateCodes - flat type safety", () => {
    it("should reject flat coupon when value_type is not rupees", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.PERCENT,
          max_discount_amount: 500,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject flat coupon when value is not positive", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FLAT,
          value: 0,
          value_type: ValueType.RUPEES,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject flat coupon when item references are provided without store reference", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            item_reference_ids: ["ITEM-1"],
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should resolve store and item references for scoped flat coupon generation", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);
      mockCouponRepo.create.mockImplementation((v: any) => v);
      mockCouponRepo.save.mockResolvedValue([
        { id: 99, code: "FLAT-SCOPED-1" },
      ]);
      mockStoreRepo.findOne.mockResolvedValue({
        id: 44,
        reference_id: "STORE-REF-44",
      });
      mockItemRepo.find.mockResolvedValue([
        { id: 501, reference_id: "ITEM-1" },
        { id: 502, reference_id: "ITEM-2" },
      ]);

      await service.generateCodes(1, {
        count: 1,
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
        type_meta: {
          store_reference_id: "STORE-REF-44",
          item_reference_ids: ["ITEM-1", "ITEM-2"],
          free_delivery: true,
        },
      } as any);

      expect(mockStoreRepo.findOne).toHaveBeenCalled();
      expect(mockItemRepo.find).toHaveBeenCalled();
      expect(mockCouponRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type_meta: expect.objectContaining({
            store_reference_id: "STORE-REF-44",
            internal_store_id: 44,
            internal_item_ids: [501, 502],
          }),
        }),
      );
    });

    it("should reject unknown keys in flat type_meta", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            store_id: 44,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("generateCodes - free_delivery type safety", () => {
    it("should reject free_delivery coupon when value_type is not rupees", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FREE_DELIVERY,
          value: 0,
          value_type: ValueType.PERCENT,
          type_meta: {
            delivery_fee_cap: 50,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject free_delivery coupon when value is non-zero", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FREE_DELIVERY,
          value: 10,
          value_type: ValueType.RUPEES,
          type_meta: {
            delivery_fee_cap: 50,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject unknown keys in free_delivery type_meta", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FREE_DELIVERY,
          value: 0,
          value_type: ValueType.RUPEES,
          type_meta: {
            store_id: 44,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should accept free_delivery without value and value_type (defaults to 0 and rupees)", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);

      const result = await service.generateCodes(1, {
        count: 1,
        preview: true,
        type: CouponType.FREE_DELIVERY,
      } as any);

      expect(result.preview).toBe(true);
      expect(result.codes).toHaveLength(1);
    });
  });

  describe("generateCodes - code format standard", () => {
    it("should generate compact codes without hyphen by default when prefix is provided", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);

      const result = await service.generateCodes(1, {
        count: 3,
        preview: true,
        prefix: "SUMMER",
        length: 8,
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
      } as any);

      expect(result.codes).toHaveLength(3);
      for (const code of result.codes) {
        expect(code).toMatch(/^SUMMER[A-Z0-9]{8}$/);
        expect(code).not.toContain("-");
      }
    });

    it("should generate prefixed codes with hyphen when separator is set to '-'", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);

      const result = await service.generateCodes(1, {
        count: 2,
        preview: true,
        prefix: "SUMMER",
        separator: "-",
        length: 8,
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
      } as any);

      expect(result.codes).toHaveLength(2);
      for (const code of result.codes) {
        expect(code).toMatch(/^SUMMER-[A-Z0-9]{8}$/);
      }
    });

    it("should normalize lowercase prefix to uppercase", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);

      const result = await service.generateCodes(1, {
        count: 1,
        preview: true,
        prefix: "summer",
        length: 8,
        type: CouponType.FLAT,
        value: 100,
        value_type: ValueType.RUPEES,
      } as any);

      expect(result.codes[0]).toMatch(/^SUMMER[A-Z0-9]{8}$/);
    });

    it("should reject invalid prefix characters", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          preview: true,
          prefix: "SUMMER_2026",
          length: 8,
          type: CouponType.FLAT,
          value: 100,
          value_type: ValueType.RUPEES,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("validateCoupon - percent type meta safety", () => {
    it("should reject malformed persisted percent type_meta when item references exist without store", async () => {
      const coupon: Partial<Coupon> = {
        id: 33,
        code: "PERCENT_META_BAD",
        type: CouponType.PERCENT,
        value: 10,
        value_type: ValueType.PERCENT,
        max_discount_amount: 200,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          item_reference_ids: ["ITEM-1"],
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: "PERCENT_META_BAD",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });

    it("should include eligible item subtotal in reservation metadata for product scoped coupon", async () => {
      const coupon: Partial<Coupon> = {
        id: 34,
        campaign_id: 2,
        code: "ITEM20_RESERVE",
        type: CouponType.PERCENT,
        value: 10,
        value_type: ValueType.PERCENT,
        max_discount_amount: 200,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          internal_store_id: 12,
          internal_item_ids: [7001],
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockRedisService.reserveCoupon.mockResolvedValue({ success: true });
      mockRedemptionRepo.create.mockImplementation((value: any) => value);
      mockRedemptionRepo.save.mockResolvedValue({ id: 1 });
      mockCartRepo.findOne.mockResolvedValue({ id: 91 });
      mockCartItemRepo.find.mockResolvedValue([
        { item: { id: 7001 }, total_price: 300 },
      ]);

      const result = await service.validateCoupon({
        code: "ITEM20_RESERVE",
        user_id: 1,
        cart_total: 1000,
        pincode: "600001",
        store_id: 12,
        item_ids: [7001],
        eligible_item_subtotal: 300,
        reserve: true,
      });

      expect(result.valid).toBe(true);
      expect(mockRedisService.reserveCoupon).toHaveBeenCalledWith(
        34,
        expect.any(String),
        expect.objectContaining({
          eligible_item_subtotal: 300,
          item_ids: [7001],
        }),
        expect.any(Number),
      );
    });
  });

  describe("validateCoupon - first_order type", () => {
    it("should validate first order coupon for new user", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "FIRST50",
        type: CouponType.FIRST_ORDER,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockDataSource.query.mockResolvedValue([{ count: "0" }]); // No paid orders
      mockRedisService.getQuota.mockResolvedValue(10);

      const dto = {
        code: "FIRST50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(true);
    });

    it("should reject first order coupon for existing user", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "FIRST50",
        type: CouponType.FIRST_ORDER,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockDataSource.query.mockResolvedValue([{ count: "2" }]); // User has 2 paid orders

      const dto = {
        code: "FIRST50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      };

      const result = await service.validateCoupon(dto);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("NOT_FIRST_ORDER");
    });

    it("should block first_order coupon reapply when COD order has order_id linked redemption (COD double-apply fix)", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "FIRST50",
        type: CouponType.FIRST_ORDER,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        user_usage_limit: 1,
        min_cart_value: 0,
        campaign: { id: 1, status: "active" as any } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      // redemption count: 1 RESERVED row with order_id set (COD order placed but undelivered)
      mockRedemptionRepo.count.mockResolvedValue(1);

      const result = await service.validateCoupon({
        code: "FIRST50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("USER_LIMIT_EXCEEDED");
    });
  });

  describe("validateCoupon - referral type", () => {
    const referralCoupon: Partial<Coupon> = {
      id: 601,
      code: "REFERRAL50",
      type: CouponType.REFERRAL,
      value: 50,
      value_type: ValueType.RUPEES,
      status: CouponStatus.ACTIVE,
      min_cart_value: 0,
      type_meta: {
        referral_code: "REF123",
        referrer_user_id: 456,
      },
      campaign: {
        id: 1,
        status: "active" as any,
      } as any,
    };

    it("should require user_id for referral coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        cart_total: 1000,
        pincode: "600001",
        referral_code: "REF123",
        referrer_user_id: 456,
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("USER_REQUIRED");
    });

    it("should require referral context for referral coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("REFERRAL_CONTEXT_REQUIRED");
    });

    it("should reject self referral", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        user_id: 456,
        cart_total: 1000,
        pincode: "600001",
        referral_code: "REF123",
        referrer_user_id: 456,
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_REFERRAL");
    });

    it("should reject referral when code context does not match coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
        referral_code: "REF999",
        referrer_user_id: 456,
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_REFERRAL");
    });

    it("should enforce first paid order for referral referee flow", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockDataSource.query.mockResolvedValue([{ count: "2" }]);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
        referral_code: "REF123",
        referrer_user_id: 456,
      } as any);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("NOT_FIRST_ORDER");
    });

    it("should validate referral coupon for referee on first paid order", async () => {
      mockCouponRepo.findOne.mockResolvedValue(referralCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);
      mockDataSource.query.mockResolvedValue([{ count: "0" }]);

      const result = await service.validateCoupon({
        code: "REFERRAL50",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
        referral_code: "REF123",
        referrer_user_id: 456,
      } as any);

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(50);
    });
  });

  describe("validateCoupon - nth_order type", () => {
    const nthCoupon: Partial<Coupon> = {
      id: 401,
      code: "NTH100",
      type: CouponType.NTH_ORDER,
      value: 100,
      value_type: ValueType.RUPEES,
      user_usage_limit: 1,
      status: CouponStatus.ACTIVE,
      min_cart_value: 0,
      type_meta: {
        nth: 3,
      },
      campaign: {
        id: 1,
        status: "active" as any,
      } as any,
    };

    it("should require user_id for nth_order coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);

      const result = await service.validateCoupon({
        code: "NTH100",
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("USER_REQUIRED");
    });


    it("should reject invalid nth_order type_meta", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        ...nthCoupon,
        type_meta: { nth: 3, foo: "bar" },
      });
      mockRedemptionRepo.count.mockResolvedValue(0);

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_META");
    });

    it("should reject when user is not at nth paid order", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockDataSource.query.mockResolvedValue([{ count: "1" }]);

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("NOT_NTH_ORDER");
    });

    it("should validate when paid_orders_count + 1 equals nth", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockDataSource.query.mockResolvedValue([{ count: "2" }]);

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(100);
    });

    it("should fall back to order table count when metrics read fails", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockDataSource.query
        .mockRejectedValueOnce(new Error('relation "user_order_metrics" does not exist'))
        .mockResolvedValueOnce([{ count: "2" }]);

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it("should fall back to order table count when metrics row is missing", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: "2" }]);

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it("should throw when fallback order table query also fails", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockDataSource.query
        .mockRejectedValueOnce(new Error("user_order_metrics unavailable"))
        .mockRejectedValueOnce(new Error("orders table unavailable"));

      await expect(
        service.validateCoupon({
          code: "NTH100",
          user_id: 123,
          cart_total: 1000,
          pincode: "600001",
        }),
      ).rejects.toThrow("Failed to determine order eligibility for coupon validation");
    });

    it("should block reapply when placed nth-order redemption was rolled back", async () => {
      mockCouponRepo.findOne.mockResolvedValue(nthCoupon);
      mockRedemptionRepo.count
        .mockResolvedValueOnce(1) // per-user usage lock path
        .mockResolvedValueOnce(0); // global limit path for this test setup

      const result = await service.validateCoupon({
        code: "NTH100",
        user_id: 123,
        cart_total: 1000,
        pincode: "600001",
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("USER_LIMIT_EXCEEDED");
    });
  });

  describe("recordPaidOrderEvent", () => {
    it("should upsert metrics when order event is new", async () => {
      mockDataSource.query.mockResolvedValue([{ count: 4 }]);

      const result = await service.recordPaidOrderEvent(501, 42, "corr-1");

      expect(result).toEqual({ processed: true, paid_order_count: 4 });
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent when duplicate order event is received", async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.recordPaidOrderEvent(501, 42, "corr-2");

      expect(result).toEqual({ processed: false });
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    });

    it("should throw when metrics write fails so queue retry can trigger", async () => {
      mockDataSource.query.mockRejectedValue(new Error("db unavailable"));

      await expect(
        service.recordPaidOrderEvent(501, 42, "corr-3"),
      ).rejects.toThrow("Failed to record paid order metrics event");
    });
  });

  describe("generateCodes - nth_order type safety", () => {
    it("should reject nth_order coupon without type_meta", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.NTH_ORDER,
          value: 100,
          value_type: ValueType.RUPEES,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject nth_order coupon when nth is not an integer", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.NTH_ORDER,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            nth: 2.5,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject nth_order coupon with unknown type_meta keys", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.NTH_ORDER,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            nth: 3,
            foo: "bar",
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow valid nth_order coupon", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);
      mockCouponRepo.create.mockImplementation((v: any) => v);
      mockCouponRepo.save.mockResolvedValue([{ id: 99, code: "NTH-OK-1" }]);

      const result = await service.generateCodes(1, {
        count: 1,
        type: CouponType.NTH_ORDER,
        value: 100,
        value_type: ValueType.RUPEES,
        type_meta: {
          nth: 3,
        },
      } as any);

      expect(result.preview).toBe(false);
      expect(result.codes).toHaveLength(1);
    });
  });

  describe("redeemCoupon - reservation expiry edge case", () => {
    it("should derive deterministic idempotency key when client key is omitted", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        status: RedemptionStatus.REDEEMED,
        amount_applied: 80,
        delivery_waived: false,
      });

      const result = await service.redeemCoupon({
        reservation_token: "derived-idem-token",
        order_id: 900,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      expect(result).toEqual({
        success: true,
        discount_amount: 80,
        delivery_waived: false,
      });
      expect(mockRedemptionRepo.findOne).toHaveBeenCalledWith({
        where: {
          idempotency_key: "coupon-redeem-900-derived-idem-token",
        },
      });
    });

    it("should reject redeem when reservation is expired (not found in Redis)", async () => {
      // Mock Redis: getReservation returns null (TTL expired)
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.getReservation.mockResolvedValue(null);

      await expect(
        service.redeemCoupon({
          reservation_token: "expired-token-001",
          order_id: 701,
          user_id: 123,
          payment_status: PaymentStatus.PAID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return success when reservation token was already redeemed even if Redis key is missing", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        status: RedemptionStatus.REDEEMED,
        amount_applied: 120,
        delivery_waived: false,
      });
      mockRedisService.getReservation.mockResolvedValue(null);

      const result = await service.redeemCoupon({
        reservation_token: "expired-token-but-redeemed",
        order_id: 702,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      expect(result).toEqual({
        success: true,
        discount_amount: 120,
        delivery_waived: false,
      });
      expect(mockRedisService.getReservation).not.toHaveBeenCalled();
    });

    it("should redeem using DB fallback when Redis key is missing but redemption is RESERVED", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 880,
        coupon_id: 77,
        status: RedemptionStatus.RESERVED,
        reserved_token: "expired-token-reserved",
        amount_applied: null,
        delivery_waived: false,
      });
      mockRedisService.getReservation.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([
        {
          id: 702,
          user_id: 123,
          discount_amount: 130,
          delivery_fee: 0,
        },
      ]);
      mockCouponRepo.findOne.mockResolvedValue({
        id: 77,
        type: CouponType.FLAT,
        type_meta: {},
      });
      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.redeemCoupon({
        reservation_token: "expired-token-reserved",
        order_id: 702,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      expect(result).toEqual({
        success: true,
        discount_amount: 130,
        delivery_waived: false,
      });
      expect(mockRedemptionRepo.update).toHaveBeenCalledWith(
        {
          id: 880,
          status: RedemptionStatus.RESERVED,
        },
        expect.objectContaining({
          status: RedemptionStatus.REDEEMED,
          order_id: 702,
          user_id: 123,
          amount_applied: 130,
        }),
      );
    });

    it("should not increment quota when redeem fails before completion", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 901,
        cart_total: 1000,
      });
      mockCouponRepo.findOne.mockResolvedValue({
        id: 901,
        code: "PERCENT20",
        type: CouponType.PERCENT,
        value: 20,
        value_type: ValueType.PERCENT,
        max_discount_amount: 500,
      } as any);

      const queryRunner = {
        manager: {
          findOne: jest.fn().mockResolvedValue({
            id: 99,
            status: RedemptionStatus.RESERVED,
            reserved_token: "tok-fail-1",
          }),
          save: jest.fn().mockRejectedValue(new Error("write failed")),
        },
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockDataSource.createQueryRunner.mockReturnValue(queryRunner);

      await expect(
        service.redeemCoupon({
          reservation_token: "tok-fail-1",
          order_id: 902,
          user_id: 44,
          payment_status: PaymentStatus.PAID,
          idempotency_key: "idem-fail-1",
        }),
      ).rejects.toThrow("Failed to redeem coupon");

      expect(mockRedisService.incrementQuota).not.toHaveBeenCalled();
    });

    it("should auto-revoke coupon via DB fallback path when quota is exhausted", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 881,
        coupon_id: 78,
        status: RedemptionStatus.RESERVED,
        reserved_token: "expired-token-revoke",
        amount_applied: null,
        delivery_waived: false,
      });
      mockRedisService.getReservation.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([
        { id: 703, user_id: 123, discount_amount: 50, delivery_fee: 0 },
      ]);

      const coupon = {
        id: 78,
        code: "MULTI5",
        type: CouponType.FLAT,
        type_meta: {},
        global_usage_limit: 5,
        status: CouponStatus.ACTIVE,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });
      // After this redemption, count equals the limit
      mockRedemptionRepo.count.mockResolvedValue(5);
      mockCouponRepo.update.mockResolvedValue({ affected: 1 });

      await service.redeemCoupon({
        reservation_token: "expired-token-revoke",
        order_id: 703,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      expect(mockCouponRepo.update).toHaveBeenCalledWith(
        { id: 78, status: CouponStatus.ACTIVE },
        { status: CouponStatus.REVOKED },
      );
    });

    it("should NOT auto-revoke via DB fallback when quota is not exhausted", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 882,
        coupon_id: 79,
        status: RedemptionStatus.RESERVED,
        reserved_token: "expired-token-no-revoke",
        amount_applied: null,
        delivery_waived: false,
      });
      mockRedisService.getReservation.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([
        { id: 704, user_id: 123, discount_amount: 50, delivery_fee: 0 },
      ]);

      const coupon = {
        id: 79,
        code: "MULTI100",
        type: CouponType.FLAT,
        type_meta: {},
        global_usage_limit: 100,
        status: CouponStatus.ACTIVE,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });
      // Only 1 of 100 redeemed — not exhausted
      mockRedemptionRepo.count.mockResolvedValue(1);

      await service.redeemCoupon({
        reservation_token: "expired-token-no-revoke",
        order_id: 704,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      expect(mockCouponRepo.update).not.toHaveBeenCalled();
    });

    it("should NOT auto-revoke via DB fallback when global_usage_limit is null", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 883,
        coupon_id: 80,
        status: RedemptionStatus.RESERVED,
        reserved_token: "expired-token-unlimited",
        amount_applied: null,
        delivery_waived: false,
      });
      mockRedisService.getReservation.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([
        { id: 705, user_id: 123, discount_amount: 50, delivery_fee: 0 },
      ]);

      const coupon = {
        id: 80,
        code: "UNLIMITED",
        type: CouponType.FLAT,
        type_meta: {},
        global_usage_limit: undefined,
        status: CouponStatus.ACTIVE,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });

      await service.redeemCoupon({
        reservation_token: "expired-token-unlimited",
        order_id: 705,
        user_id: 123,
        payment_status: PaymentStatus.PAID,
      });

      // count should never be called for unlimited coupons
      expect(mockRedemptionRepo.count).not.toHaveBeenCalled();
      expect(mockCouponRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("getCouponStatus", () => {
    it("should return valid=false and correct message for a REVOKED coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        code: "REVOKED1",
        status: CouponStatus.REVOKED,
        start_at: undefined,
        end_at: undefined,
        campaign: { status: "active" },
      });

      const result = await service.getCouponStatus("REVOKED1");

      expect(result.valid).toBe(false);
      expect(result.status).toBe(CouponStatus.REVOKED);
      expect(result.message).toContain("revoked");
    });

    it("should return valid=false and correct message for an EXPIRED coupon (status-based)", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        code: "EXPIRED1",
        status: CouponStatus.EXPIRED,
        start_at: undefined,
        end_at: new Date("2025-01-01"), // also past, but status wins
        campaign: { status: "active" },
      });

      const result = await service.getCouponStatus("EXPIRED1");

      expect(result.valid).toBe(false);
      expect(result.status).toBe(CouponStatus.EXPIRED);
      expect(result.message).toContain("expired");
    });

    it("should return valid=false for ACTIVE coupon whose end_at passed (cron not yet run)", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        code: "PAST_END",
        status: CouponStatus.ACTIVE, // cron hasn't run yet
        start_at: undefined,
        end_at: new Date("2020-01-01"),
        campaign: { status: "active" },
      });

      const result = await service.getCouponStatus("PAST_END");

      expect(result.valid).toBe(false);
      expect(result.message).toContain("expired");
    });

    it("should return valid=false for INACTIVE coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        code: "INACTIVE1",
        status: CouponStatus.INACTIVE,
        start_at: undefined,
        end_at: undefined,
        campaign: { status: "active" },
      });

      const result = await service.getCouponStatus("INACTIVE1");

      expect(result.valid).toBe(false);
      expect(result.message).toContain("inactive");
    });

    it("should return valid=true for a fully active coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        code: "GOOD1",
        status: CouponStatus.ACTIVE,
        start_at: undefined,
        end_at: undefined,
        campaign: { status: "active" },
      });

      const result = await service.getCouponStatus("GOOD1");

      expect(result.valid).toBe(true);
      expect(result.message).toBe("Coupon is valid");
    });
  });

  describe("validateCoupon - free_delivery edge case (negative delivery_fee)", () => {
    it("should reject negative delivery_fee from client", async () => {
      const coupon: Partial<Coupon> = {
        id: 200,
        code: "FD_NEGATIVE_FEE",
        type: CouponType.FREE_DELIVERY,
        value: 0,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        min_cart_value: 0,
        type_meta: {
          delivery_fee_cap: 30,
        },
        campaign: {
          id: 1,
          status: "active" as any,
        } as any,
      };

      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockRedemptionRepo.count.mockResolvedValue(0);
      mockRedisService.getQuota.mockResolvedValue(10);

      // Pass negative delivery_fee (invalid from client, but should be guarded)
      const result = await service.validateCoupon({
        code: "FD_NEGATIVE_FEE",
        cart_total: 1000,
        pincode: "600001",
        delivery_fee: -50, // Invalid, but min validation in DTO should prevent this
      });

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("DELIVERY_FEE_REQUIRED");
    });
  });

  describe("rollbackCoupon - no restore policy", () => {
    it("should mark preorder placed reservation as rolled_back without restoring quota", async () => {
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 300,
      });

      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 999,
        coupon_id: 300,
        order_id: 456,
        status: RedemptionStatus.RESERVED,
        reserved_token: "placed-token-1",
      });

      mockCouponRepo.findOne.mockResolvedValue({
        id: 300,
        type: CouponType.PREORDER,
      });

      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });
      mockRedisService.deleteReservation.mockResolvedValue(true);

      const result = await service.rollbackCoupon({
        reservation_token: "placed-token-1",
        reason: "Order cancelled",
      });

      expect(result.success).toBe(true);
      expect(mockRedemptionRepo.update).toHaveBeenCalledWith(
        {
          id: 999,
          status: RedemptionStatus.RESERVED,
        },
        {
          status: RedemptionStatus.ROLLED_BACK,
        },
      );
      expect(mockRedisService.deleteReservation).toHaveBeenCalledWith(
        "placed-token-1",
      );
      expect(mockRedisService.releaseReservation).not.toHaveBeenCalled();
    });

    it("should not restore quota for already rolled back reservation", async () => {
      mockRedisService.getReservation.mockResolvedValue(null);
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 1001,
        coupon_id: 301,
        order_id: null,
        status: RedemptionStatus.ROLLED_BACK,
        reserved_token: "already-rolled-back-token",
      });
      mockRedisService.deleteReservation.mockResolvedValue(true);

      const result = await service.rollbackCoupon({
        reservation_token: "already-rolled-back-token",
        reason: "duplicate rollback",
      });

      expect(result.success).toBe(true);
      expect(mockRedemptionRepo.update).not.toHaveBeenCalled();
      expect(mockRedisService.releaseReservation).not.toHaveBeenCalled();
      expect(mockRedisService.deleteReservation).toHaveBeenCalledWith(
        "already-rolled-back-token",
      );
    });

    it("should restore quota only once across duplicate rollback calls", async () => {
      mockRedisService.getReservation
        .mockResolvedValueOnce({ coupon_id: 302 })
        .mockResolvedValueOnce(null);

      mockRedemptionRepo.findOne
        .mockResolvedValueOnce({
          id: 1002,
          coupon_id: 302,
          order_id: null,
          status: RedemptionStatus.RESERVED,
          reserved_token: "dup-rollback-token",
        })
        .mockResolvedValueOnce({
          id: 1002,
          coupon_id: 302,
          order_id: null,
          status: RedemptionStatus.ROLLED_BACK,
          reserved_token: "dup-rollback-token",
        });

      mockCouponRepo.findOne.mockResolvedValue({
        id: 302,
        type: CouponType.FLAT,
      });

      mockRedemptionRepo.update.mockResolvedValue({ affected: 1 });
      mockRedisService.releaseReservation.mockResolvedValue(true);
      mockRedisService.deleteReservation.mockResolvedValue(true);

      const first = await service.rollbackCoupon({
        reservation_token: "dup-rollback-token",
        reason: "first",
      });

      const second = await service.rollbackCoupon({
        reservation_token: "dup-rollback-token",
        reason: "second",
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(mockRedisService.releaseReservation).toHaveBeenCalledTimes(1);
    });

    it("should rollback Redis-only reservation when DB redemption row is missing", async () => {
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 450,
      });
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.releaseReservation.mockResolvedValue(true);

      const result = await service.rollbackCoupon({
        reservation_token: "redis-only-token",
        reason: "sync mismatch cleanup",
      });

      expect(result.success).toBe(true);
      expect(mockRedisService.releaseReservation).toHaveBeenCalledWith(
        450,
        "redis-only-token",
      );
      expect(mockRedemptionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("generateCodes - first/referral type_meta safety", () => {
    it("should reject first_order coupon with unknown type_meta keys", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.FIRST_ORDER,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            invalid_field: true,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject referral coupon with non-integer referrer_user_id", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.REFERRAL,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            referrer_user_id: "abc",
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject referral coupon without referral_code", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.REFERRAL,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            referrer_user_id: 456,
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject referral coupon without referrer_user_id", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.REFERRAL,
          value: 100,
          value_type: ValueType.RUPEES,
          type_meta: {
            referral_code: "REF123",
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("autoRollbackStaleReservations", () => {
    it("should process all stale rows and skip rows without token", async () => {
      mockRedemptionRepo.find.mockResolvedValue([
        {
          id: 1,
          reserved_token: "token-1",
          status: RedemptionStatus.RESERVED,
        },
        {
          id: 2,
          reserved_token: null,
          status: RedemptionStatus.RESERVED,
        },
        {
          id: 3,
          reserved_token: "token-3",
          status: RedemptionStatus.RESERVED,
        },
      ]);

      jest
        .spyOn(service, "rollbackCoupon")
        .mockResolvedValue({ success: true });

      await service.autoRollbackStaleReservations();

      expect(service.rollbackCoupon).toHaveBeenCalledTimes(2);
      expect(service.rollbackCoupon).toHaveBeenCalledWith(
        {
          reservation_token: "token-1",
          reason: "Auto-rollback after TTL expiry",
        },
        expect.any(String),
      );
      expect(service.rollbackCoupon).toHaveBeenCalledWith(
        {
          reservation_token: "token-3",
          reason: "Auto-rollback after TTL expiry",
        },
        expect.any(String),
      );
    });
  });

  describe("markExpiredCoupons", () => {
    it("should bulk-update active coupons whose end_at has passed to EXPIRED", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      mockCouponRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.markExpiredCoupons();

      expect(result.updated).toBe(3);
      expect(qb.update).toHaveBeenCalledWith(expect.anything());
      expect(qb.set).toHaveBeenCalledWith({ status: CouponStatus.EXPIRED });
      expect(qb.where).toHaveBeenCalledWith("status = :active", {
        active: CouponStatus.ACTIVE,
      });
    });

    it("should return 0 when no coupons match", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockCouponRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.markExpiredCoupons();

      expect(result.updated).toBe(0);
    });

    it("should swallow errors and return 0 when DB fails", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error("DB error")),
      };
      mockCouponRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.markExpiredCoupons();

      expect(result.updated).toBe(0);
    });
  });

  describe("updateCouponStatus", () => {
    it("should set status to INACTIVE for an active coupon", async () => {
      const coupon: Partial<Coupon> = {
        id: 1,
        code: "TEST",
        status: CouponStatus.ACTIVE,
        end_at: undefined,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockCouponRepo.save.mockImplementation(async (c: any) => c);

      const result = await service.updateCouponStatus(1, CouponStatus.INACTIVE);

      expect(result.status).toBe(CouponStatus.INACTIVE);
      expect(mockCouponRepo.save).toHaveBeenCalled();
    });

    it("should set status to ACTIVE for an inactive coupon with no end_at", async () => {
      const coupon: Partial<Coupon> = {
        id: 2,
        code: "TEST2",
        status: CouponStatus.INACTIVE,
        end_at: undefined,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);
      mockCouponRepo.save.mockImplementation(async (c: any) => c);

      const result = await service.updateCouponStatus(2, CouponStatus.ACTIVE);

      expect(result.status).toBe(CouponStatus.ACTIVE);
    });

    it("should throw BadRequestException when trying to change a REVOKED coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        id: 3,
        code: "REVOKED_CODE",
        status: CouponStatus.REVOKED,
      });

      await expect(
        service.updateCouponStatus(3, CouponStatus.INACTIVE),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when trying to change an EXPIRED coupon", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        id: 4,
        code: "EXPIRED_CODE",
        status: CouponStatus.EXPIRED,
      });

      await expect(
        service.updateCouponStatus(4, CouponStatus.ACTIVE),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when re-activating a coupon past end_at", async () => {
      mockCouponRepo.findOne.mockResolvedValue({
        id: 5,
        code: "PAST_CODE",
        status: CouponStatus.INACTIVE,
        end_at: new Date("2020-01-01"),
      });

      await expect(
        service.updateCouponStatus(5, CouponStatus.ACTIVE),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when coupon does not exist", async () => {
      mockCouponRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCouponStatus(999, CouponStatus.INACTIVE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("redeemCoupon - auto-revoke on quota exhaustion", () => {
    const makeQueryRunner = (
      redemptionRecord: any,
      redeemedCountAfterSave: number,
    ) => ({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockResolvedValue(redemptionRecord),
        save: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(redeemedCountAfterSave),
      },
    });

    it("should mark coupon REVOKED when multi-use quota is exhausted on redemption", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 10,
        cart_total: 500,
        eligible_item_subtotal: 500,
        delivery_fee: 0,
      });

      const coupon: Partial<Coupon> = {
        id: 10,
        code: "MULTI10",
        type: CouponType.FLAT,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        global_usage_limit: 5,
        min_cart_value: 0,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const reservedRedemption = {
        id: 201,
        status: RedemptionStatus.RESERVED,
        amount_applied: null,
        delivery_waived: false,
      };

      // After the save, redeemed count equals the limit (quota exhausted)
      const qr = makeQueryRunner(reservedRedemption, 5);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await service.redeemCoupon({
        reservation_token: "tok-multi",
        order_id: 300,
        user_id: 1,
        payment_status: PaymentStatus.PAID,
        idempotency_key: "key-multi",
      } as any);

      // The manager.save should have been called twice:
      // once for the redemption row, once for the coupon (REVOKED)
      const saveCalls = qr.manager.save.mock.calls;
      const couponSaveCall = saveCalls.find(
        (args: any[]) => args[0]?.status === CouponStatus.REVOKED,
      );
      expect(couponSaveCall).toBeDefined();
    });

    it("should NOT mark coupon REVOKED when quota is not yet exhausted", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 11,
        cart_total: 500,
        eligible_item_subtotal: 500,
        delivery_fee: 0,
      });

      const coupon: Partial<Coupon> = {
        id: 11,
        code: "MULTI100",
        type: CouponType.FLAT,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        global_usage_limit: 100,
        min_cart_value: 0,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const reservedRedemption = {
        id: 202,
        status: RedemptionStatus.RESERVED,
        amount_applied: null,
        delivery_waived: false,
      };

      // Only 1 redemption so far — not exhausted
      const qr = makeQueryRunner(reservedRedemption, 1);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await service.redeemCoupon({
        reservation_token: "tok-multi2",
        order_id: 301,
        user_id: 2,
        payment_status: PaymentStatus.PAID,
        idempotency_key: "key-multi2",
      } as any);

      const saveCalls = qr.manager.save.mock.calls;
      const revokedSaveCall = saveCalls.find(
        (args: any[]) => args[0]?.status === CouponStatus.REVOKED,
      );
      expect(revokedSaveCall).toBeUndefined();
    });

    it("should NOT auto-revoke when global_usage_limit is null (unlimited)", async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      mockRedisService.getReservation.mockResolvedValue({
        coupon_id: 12,
        cart_total: 500,
        eligible_item_subtotal: 500,
        delivery_fee: 0,
      });

      const coupon: Partial<Coupon> = {
        id: 12,
        code: "UNLIMITED",
        type: CouponType.FLAT,
        value: 50,
        value_type: ValueType.RUPEES,
        status: CouponStatus.ACTIVE,
        global_usage_limit: undefined,
        min_cart_value: 0,
      };
      mockCouponRepo.findOne.mockResolvedValue(coupon);

      const reservedRedemption = {
        id: 203,
        status: RedemptionStatus.RESERVED,
        amount_applied: null,
        delivery_waived: false,
      };

      const qr = makeQueryRunner(reservedRedemption, 999);
      // count should never be called for unlimited coupons
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await service.redeemCoupon({
        reservation_token: "tok-unlimited",
        order_id: 302,
        user_id: 3,
        payment_status: PaymentStatus.PAID,
        idempotency_key: "key-unlimited",
      } as any);

      expect(qr.manager.count).not.toHaveBeenCalled();
    });
  });

  describe("generateCodes - preorder type", () => {
    it("should reject preorder coupon when type_meta is missing", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject preorder coupon when store_reference_id cannot be resolved", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockStoreRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          type_meta: {
            store_reference_id: "STORE-MISSING",
            item_reference_id: "ITEM-REF-123",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject preorder coupon when item_reference_id cannot be resolved", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockStoreRepo.findOne.mockResolvedValue({ id: 44, reference_id: "STORE-REF-44" });
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "ITEM-MISSING",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject preorder coupon when delivery_date is in the past", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockStoreRepo.findOne.mockResolvedValue({ id: 44, reference_id: "STORE-REF-44" });
      mockItemRepo.findOne.mockResolvedValue({ id: 123, reference_id: "ITEM-REF-123" });

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "ITEM-REF-123",
            delivery_date: "2020-01-01T00:00:00Z",
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should resolve references, enrich type_meta, and set applicable_store_ids on generated coupons", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockCouponRepo.find.mockResolvedValue([]);
      mockCouponRepo.create.mockImplementation((v: any) => v);
      mockCouponRepo.save.mockResolvedValue([{ id: 200, code: "PREORDER1" }]);
      mockStoreRepo.findOne.mockResolvedValue({ id: 44, reference_id: "STORE-REF-44" });
      mockItemRepo.findOne.mockResolvedValue({ id: 123, reference_id: "ITEM-REF-123" });
      mockRedisService.initializeQuota.mockResolvedValue(undefined);

      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

      const result = await service.generateCodes(1, {
        count: 1,
        type: CouponType.PREORDER,
        value: 15,
        value_type: ValueType.PERCENT,
        max_discount_amount: 300,
        global_usage_limit: 100,
        type_meta: {
          store_reference_id: "STORE-REF-44",
          item_reference_id: "ITEM-REF-123",
          delivery_date: futureDate,
          title: "Special Preorder",
          free_delivery: true,
          delivery_fee_cap: 40,
        },
      } as any);

      expect(result.preview).toBe(false);
      expect(result.codes).toHaveLength(1);

      // Verify enriched type_meta was written onto each coupon
      const savedCoupons = mockCouponRepo.create.mock.calls[0][0];
      expect(savedCoupons.type_meta.internal_store_id).toBe(44);
      expect(savedCoupons.type_meta.internal_item_id).toBe(123);
      expect(savedCoupons.type_meta.store_reference_id).toBe("STORE-REF-44");
      expect(savedCoupons.type_meta.item_reference_id).toBe("ITEM-REF-123");
      expect(savedCoupons.applicable_store_ids).toEqual([44]);
    });

    it("should reject preorder coupon when store_reference_id is empty string", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          type_meta: {
            store_reference_id: "   ",
            item_reference_id: "ITEM-REF-123",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject preorder coupon when item_reference_id is empty string", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject preorder coupon when count > 1", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);

      await expect(
        service.generateCodes(1, {
          count: 2,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          global_usage_limit: 50,
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "ITEM-REF-123",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow("count must be 1");
    });

    it("should reject preorder coupon when global_usage_limit is missing", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockStoreRepo.findOne.mockResolvedValue({ id: 44, reference_id: "STORE-REF-44" });
      mockItemRepo.findOne.mockResolvedValue({ id: 123, reference_id: "ITEM-REF-123" });

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          // global_usage_limit intentionally omitted
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "ITEM-REF-123",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow("global_usage_limit is required");
    });

    it("should reject preorder coupon when an active campaign already exists for the same item", async () => {
      jest.spyOn(service, "getCampaign").mockResolvedValue({ id: 1 } as any);
      mockStoreRepo.findOne.mockResolvedValue({ id: 44, reference_id: "STORE-REF-44" });
      mockItemRepo.findOne.mockResolvedValue({ id: 123, reference_id: "ITEM-REF-123" });

      // Simulate existing active preorder coupon for the same item
      mockCouponRepo.createQueryBuilder.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 99, code: "EXISTING-PREORDER" }),
      });

      await expect(
        service.generateCodes(1, {
          count: 1,
          type: CouponType.PREORDER,
          value: 15,
          value_type: ValueType.PERCENT,
          max_discount_amount: 300,
          global_usage_limit: 50,
          type_meta: {
            store_reference_id: "STORE-REF-44",
            item_reference_id: "ITEM-REF-123",
            delivery_date: new Date(Date.now() + 86400000).toISOString(),
          },
        } as any),
      ).rejects.toThrow("active preorder campaign already exists");
    });
  });

  describe("validateCouponConfiguration - preorder", () => {
    it("should return INVALID_COUPON_CONFIG when preorder coupon is missing internal_item_id", async () => {
      const coupon = {
        id: 1,
        type: CouponType.PREORDER,
        status: CouponStatus.ACTIVE,
        value: 15,
        value_type: ValueType.RUPEES,
        type_meta: { internal_store_id: 44 }, // missing internal_item_id
      } as any;

      const result = (service as any).validateCouponConfiguration(coupon);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });

    it("should return INVALID_COUPON_CONFIG when preorder coupon is missing internal_store_id", async () => {
      const coupon = {
        id: 1,
        type: CouponType.PREORDER,
        status: CouponStatus.ACTIVE,
        value: 15,
        value_type: ValueType.RUPEES,
        type_meta: { internal_item_id: 123 }, // missing internal_store_id
      } as any;

      const result = (service as any).validateCouponConfiguration(coupon);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });

    it("should pass config validation when preorder coupon has both internal IDs", async () => {
      const coupon = {
        id: 1,
        type: CouponType.PREORDER,
        status: CouponStatus.ACTIVE,
        value: 15,
        value_type: ValueType.RUPEES,
        type_meta: { internal_store_id: 44, internal_item_id: 123 },
      } as any;

      const result = (service as any).validateCouponConfiguration(coupon);

      expect(result.valid).toBe(true);
    });
  });

  describe("runValidationChecks - preorder", () => {
    const makePreorderCoupon = (typeMeta: Record<string, any>) =>
      ({
        id: 1,
        type: CouponType.PREORDER,
        status: CouponStatus.ACTIVE,
        value: 15,
        value_type: ValueType.RUPEES,
        campaign: { status: "active" },
        type_meta: typeMeta,
      }) as any;

    it("should return INVALID_COUPON_CONFIG when stored preorder coupon has no internal_item_id", async () => {
      const coupon = makePreorderCoupon({ internal_store_id: 44 }); // no internal_item_id
      const dto = { user_id: 1, cart_total: 500, store_id: 44 } as any;

      const result = await (service as any).runValidationChecks(coupon, dto);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_COUPON_CONFIG");
    });

    it("should return INVALID_ITEM when cart item_id does not match coupon internal_item_id", async () => {
      const coupon = makePreorderCoupon({ internal_store_id: 44, internal_item_id: 123 });
      const dto = { user_id: 1, cart_total: 500, store_id: 44, item_id: 999 } as any;
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await (service as any).runValidationChecks(coupon, dto);

      expect(result.valid).toBe(false);
      expect(result.reason_code).toBe("INVALID_ITEM");
    });

    it("should pass validation when item_id matches internal_item_id", async () => {
      const coupon = makePreorderCoupon({ internal_store_id: 44, internal_item_id: 123 });
      const dto = { user_id: 1, cart_total: 500, store_id: 44, item_id: 123 } as any;
      mockRedisService.getQuota.mockResolvedValue(10);

      const result = await (service as any).runValidationChecks(coupon, dto);

      expect(result.valid).toBe(true);
    });
  });
});
