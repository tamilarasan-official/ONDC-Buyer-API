import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { CouponService } from "./coupon.service";
import { RedisCouponService } from "./redis-coupon.service";
import { CouponCampaign } from "../entities/coupon-campaign.entity";
import { Coupon, CouponType, ValueType, CouponStatus } from "../entities/coupon.entity";
import { CouponRedemption, RedemptionStatus } from "../entities/coupon-redemption.entity";
import { CouponCounter } from "../entities/coupon-counter.entity";

describe("CouponService", () => {
  let service: CouponService;
  let mockCampaignRepo: any;
  let mockCouponRepo: any;
  let mockRedemptionRepo: any;
  let mockCounterRepo: any;
  let mockRedisService: any;
  let mockDataSource: any;

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
    };

    mockRedemptionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockCounterRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockRedisService = {
      initializeQuota: jest.fn(),
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
          provide: RedisCouponService,
          useValue: mockRedisService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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
  });
});


