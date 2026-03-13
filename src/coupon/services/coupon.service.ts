import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, LessThan, MoreThan } from "typeorm";
import { CronJob } from "cron";
import { v4 as uuidv4 } from "uuid";
import { CouponCampaign, CampaignStatus } from "../entities/coupon-campaign.entity";
import {
  Coupon,
  CouponType,
  CouponStatus,
  ValueType,
} from "../entities/coupon.entity";
import {
  CouponRedemption,
  RedemptionStatus,
} from "../entities/coupon-redemption.entity";
import { CouponCounter } from "../entities/coupon-counter.entity";
import { Item } from "../../item/entities/item.entity";
import { RedisCouponService } from "./redis-coupon.service";
import { CreateCampaignDto } from "../dto/create-campaign.dto";
import { UpdateCampaignDto } from "../dto/update-campaign.dto";
import { GenerateCodesDto } from "../dto/generate-codes.dto";
import { ValidateCouponDto } from "../dto/validate-coupon.dto";
import { ReserveCouponDto } from "../dto/reserve-coupon.dto";
import { RedeemCouponDto, PaymentStatus } from "../dto/redeem-coupon.dto";
import { RollbackCouponDto } from "../dto/rollback-coupon.dto";
import { TimezoneUtil } from "../../shared/utils/timezone.util";

// Code generation charset (no ambiguous chars: 0, O, I, 1)
const CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    @InjectRepository(CouponCampaign)
    private readonly campaignRepository: Repository<CouponCampaign>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private readonly redemptionRepository: Repository<CouponRedemption>,
    @InjectRepository(CouponCounter)
    private readonly counterRepository: Repository<CouponCounter>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly redisCouponService: RedisCouponService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.registerAutoRollbackCron();
  }

  /**
   * Register the auto-rollback cron job with an expression from env.
   * Env: COUPON_RESERVATION_CRON_EXPRESSION (for example, a pattern that runs every 10 minutes).
   */
  private registerAutoRollbackCron() {
    const expr =
      this.configService.get<string>("COUPON_RESERVATION_CRON_EXPRESSION") ||
      "*/10 * * * *"; // default: every 10 minutes

    const job = new CronJob(
      expr,
      () => this.autoRollbackStaleReservations(),
      null,
      false,
      "Asia/Kolkata",
    );

    this.schedulerRegistry.addCronJob(
      "auto_rollback_stale_preorder_reservations",
      job,
    );
    job.start();

    this.logger.log(
      `Registered auto-rollback cron with expression "${expr}" (Asia/Kolkata)`,
    );
  }

  // ==================== Campaign Management ====================

  async createCampaign(dto: CreateCampaignDto): Promise<CouponCampaign> {
    // Check if campaign_key already exists
    const existing = await this.campaignRepository.findOne({
      where: { campaign_key: dto.campaign_key },
    });

    if (existing) {
      throw new ConflictException(
        `Campaign with key '${dto.campaign_key}' already exists`,
      );
    }

    const campaign = this.campaignRepository.create({
      campaign_key: dto.campaign_key,
      title: dto.title,
      description: dto.description,
      created_by: dto.created_by,
      status: dto.status || CampaignStatus.DRAFT,
    });

    return await this.campaignRepository.save(campaign);
  }

  async updateCampaign(
    id: number,
    dto: UpdateCampaignDto,
  ): Promise<CouponCampaign> {
    const campaign = await this.campaignRepository.findOne({ where: { id } });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    Object.assign(campaign, dto);
    return await this.campaignRepository.save(campaign);
  }

  async getCampaigns(
    status?: CampaignStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ campaigns: CouponCampaign[]; total: number }> {
    const queryBuilder = this.campaignRepository.createQueryBuilder("campaign");

    if (status) {
      queryBuilder.where("campaign.status = :status", { status });
    }

    const [campaigns, total] = await queryBuilder
      .orderBy("campaign.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { campaigns, total };
  }

  async getCampaign(id: number): Promise<CouponCampaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ["coupons"],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return campaign;
  }

  // ==================== Code Generation ====================

  /**
   * Generate unique coupon codes
   */
  async generateCodes(
    campaignId: number,
    dto: GenerateCodesDto,
  ): Promise<{ codes: string[]; preview: boolean }> {
    const campaign = await this.getCampaign(campaignId);

    // Validate percent coupon has max_discount_amount
    if (
      dto.value_type === ValueType.PERCENT &&
      (!dto.max_discount_amount || dto.max_discount_amount <= 0)
    ) {
      throw new BadRequestException(
        "Percent coupons must have max_discount_amount > 0",
      );
    }

    // NEW: Validate preorder coupon specific fields
    if (dto.type === CouponType.PREORDER) {
      if (!dto.type_meta) {
        throw new BadRequestException(
          "type_meta is required for preorder coupons",
        );
      }

      // Validate item_id exists
      if (!dto.type_meta.item_id) {
        throw new BadRequestException(
          "item_id is required in type_meta for preorder coupons",
        );
      }

      const itemId = Number(dto.type_meta.item_id);
      if (isNaN(itemId) || itemId <= 0) {
        throw new BadRequestException(
          "item_id must be a valid positive number",
        );
      }

      const item = await this.itemRepository.findOne({
        where: { id: itemId },
      });

      if (!item) {
        throw new BadRequestException(
          `Item with ID ${itemId} not found`,
        );
      }

      // Validate delivery_date exists
      if (!dto.type_meta.delivery_date) {
        throw new BadRequestException(
          "delivery_date is required in type_meta for preorder coupons",
        );
      }

      // Parse delivery_date
      const deliveryDate = new Date(dto.type_meta.delivery_date);
      if (isNaN(deliveryDate.getTime())) {
        throw new BadRequestException(
          "delivery_date must be a valid ISO datetime string",
        );
      }

      // For preorder coupons, delivery_date can be after expires_at
      // This is valid because:
      // - expires_at: When campaign ends (no new orders can be placed)
      // - delivery_date: When delivery happens (for orders already placed)
      // So we don't validate delivery_date against expires_at for preorder type
      // The delivery_date just needs to be a valid future date
      if (deliveryDate < new Date()) {
        throw new BadRequestException(
          `delivery_date (${dto.type_meta.delivery_date}) must be a future date`,
        );
      }

      // NOTE: We no longer require type_meta.final_price for preorder coupons.
      // Discount and effective final price are derived from coupon.value and value_type,
      // together with max_discount_amount, in the cart and order flows.

      this.logger.log(
        `✅ Preorder coupon validation passed: item_id=${itemId}, delivery_date=${dto.type_meta.delivery_date}`,
      );
    }

    const codeLength = dto.length || 8;
    const count = dto.preview ? Math.min(dto.count, 10) : dto.count;
    const codes: string[] = [];
    const existingCodes = new Set<string>();

    // Get existing codes to avoid duplicates
    const existing = await this.couponRepository.find({
      where: { campaign_id: campaignId },
      select: ["code"],
    });
    existing.forEach((c) => existingCodes.add(c.code));

    // Generate codes
    let attempts = 0;
    const maxAttempts = count * 100; // Prevent infinite loop

    while (codes.length < count && attempts < maxAttempts) {
      attempts++;
      const code = this.generateCode(dto.prefix, codeLength);

      if (!existingCodes.has(code) && !codes.includes(code)) {
        codes.push(code);
        existingCodes.add(code);
      }
    }

    if (codes.length < count) {
      throw new InternalServerErrorException(
        `Failed to generate ${count} unique codes after ${maxAttempts} attempts`,
      );
    }

    // If preview, return codes only
    if (dto.preview) {
      return { codes, preview: true };
    }

    // Create coupon records
    // Default priority is 0 if not provided (lower priority = selected last when multiple coupons match)
    const defaultPriority = dto.priority !== undefined && dto.priority !== null ? dto.priority : 0;
    
    const coupons = codes.map((code) => {
      const coupon = this.couponRepository.create({
        campaign_id: campaignId,
        code,
        type: dto.type,
        type_meta: dto.type_meta || {},
        value: dto.value,
        value_type: dto.value_type,
        max_discount_amount: dto.max_discount_amount,
        min_cart_value: dto.min_cart_value || 0,
        user_usage_limit: dto.user_usage_limit || 1,
        global_usage_limit: dto.global_usage_limit,
        priority: defaultPriority,
        status: CouponStatus.ACTIVE,
        start_at: dto.start_at ? new Date(dto.start_at) : undefined,
        end_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
      });

      return coupon;
    });

    await this.couponRepository.save(coupons);

    // Initialize Redis quota for coupons with global_usage_limit
    for (const coupon of coupons) {
      if (coupon.global_usage_limit) {
        await this.redisCouponService.initializeQuota(
          coupon.id,
          coupon.global_usage_limit,
        );
      }
    }

    // Initialize counters
    const counters = coupons.map((coupon) =>
      this.counterRepository.create({
        coupon_id: coupon.id,
        redeemed_count: 0,
      }),
    );
    await this.counterRepository.save(counters);

    this.logger.log(
      `Generated ${codes.length} codes for campaign ${campaignId}`,
    );

    return { codes, preview: false };
  }

  /**
   * Generate a single unique code
   */
  private generateCode(prefix?: string, length: number = 8): string {
    let code = prefix ? `${prefix}-` : "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * CODE_CHARSET.length);
      code += CODE_CHARSET[randomIndex];
    }

    return code;
  }

  async getCampaignCodes(
    campaignId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ codes: Coupon[]; total: number }> {
    const [codes, total] = await this.couponRepository.findAndCount({
      where: { campaign_id: campaignId },
      order: { created_at: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { codes, total };
  }

  // ==================== Validation Logic ====================

  /**
   * Validate coupon and optionally reserve it
   */
  async validateCoupon(
    dto: ValidateCouponDto,
  ): Promise<{
    valid: boolean;
    discount_amount?: number;
    delivery_waived?: boolean;
    reservation_token?: string;
    reservation_ttl?: number;
    reason_code?: string;
    message?: string;
  }> {
    // Find coupon
    const coupon = await this.couponRepository.findOne({
      where: { code: dto.code },
      relations: ["campaign"],
    });

    if (!coupon) {
      return {
        valid: false,
        reason_code: "NOT_FOUND",
        message: "Coupon code not found",
      };
    }

    // Run validation checks
    const validation = await this.runValidationChecks(coupon, dto);

    if (!validation.valid) {
      return validation;
    }

    // Calculate discount
    const discountResult = await this.calculateDiscount(coupon, dto.cart_total);

    // If reserve=true, create reservation
    let reservationToken: string | undefined;
    let reservationTtl: number | undefined;

    if (dto.reserve) {
      const reservation = await this.createReservation(coupon, dto);
      if (!reservation.success) {
        return {
          valid: false,
          reason_code: reservation.reason || "RESERVATION_FAILED",
          message: "Failed to reserve coupon",
        };
      }
      reservationToken = reservation.token;
      reservationTtl = reservation.ttl;
    }

    return {
      valid: true,
      discount_amount: discountResult.discount_amount,
      delivery_waived: discountResult.delivery_waived,
      reservation_token: reservationToken,
      reservation_ttl: reservationTtl,
    };
  }

  /**
   * Run all validation checks
   */
  private async runValidationChecks(
    coupon: Coupon,
    dto: ValidateCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
  }> {
    // Check coupon status
    if (coupon.status !== CouponStatus.ACTIVE) {
      return {
        valid: false,
        reason_code: "INACTIVE",
        message: "Coupon is not active",
      };
    }

    // Check campaign status
    // FIX: Add null check for campaign (defensive programming)
    if (!coupon.campaign) {
      return {
        valid: false,
        reason_code: "CAMPAIGN_NOT_FOUND",
        message: "Campaign not found for this coupon",
      };
    }
    
    if (coupon.campaign.status !== CampaignStatus.ACTIVE) {
      return {
        valid: false,
        reason_code: "CAMPAIGN_INACTIVE",
        message: "Campaign is not active",
      };
    }

    // Check time window
    // Use IST time to ensure consistent timezone comparison with database timestamps
    const now = TimezoneUtil.getCurrentISTTime();
    if (coupon.start_at && now < coupon.start_at) {
      return {
        valid: false,
        reason_code: "NOT_STARTED",
        message: "Coupon is not yet valid",
      };
    }

    if (coupon.end_at && now > coupon.end_at) {
      return {
        valid: false,
        reason_code: "EXPIRED",
        message: "Coupon has expired",
      };
    }

    // Check minimum cart value
    if (dto.cart_total < coupon.min_cart_value) {
      return {
        valid: false,
        reason_code: "MIN_CART_NOT_MET",
        message: `Minimum cart value of ₹${coupon.min_cart_value} required`,
      };
    }

    // Check pincode eligibility
    if (coupon.valid_pincodes && coupon.valid_pincodes.length > 0) {
      if (!coupon.valid_pincodes.includes(dto.pincode)) {
        return {
          valid: false,
          reason_code: "INVALID_PINCODE",
          message: "Coupon not valid for this pincode",
        };
      }
    }

    // Check store eligibility
    if (
      coupon.applicable_store_ids &&
      coupon.applicable_store_ids.length > 0
    ) {
      if (!dto.store_id || !coupon.applicable_store_ids.includes(dto.store_id)) {
        return {
          valid: false,
          reason_code: "INVALID_STORE",
          message: "Coupon not valid for this store",
        };
      }
    }

    // Check per-user usage limit
    if (dto.user_id) {
      const userRedemptions = await this.redemptionRepository.count({
        where: {
          coupon_id: coupon.id,
          user_id: dto.user_id,
          status: In([RedemptionStatus.REDEEMED]),
        },
      });

      if (userRedemptions >= coupon.user_usage_limit) {
        return {
          valid: false,
          reason_code: "USER_LIMIT_EXCEEDED",
          message: "You have already used this coupon",
        };
      }
    }

    // Check global quota: both Redis and DB (redeemed_count) so we never over-sell when Redis is out of sync
    if (coupon.global_usage_limit) {
      const limit = Number(coupon.global_usage_limit);
      const quota = await this.redisCouponService.getQuota(coupon.id);
      if (quota !== null && quota <= 0) {
        return {
          valid: false,
          reason_code: "QUOTA_EXCEEDED",
          message: "Coupon quota exhausted",
        };
      }
      // Enforce limit using redeemed_count so reserves are blocked even if Redis was reset incorrectly
      const counter = await this.counterRepository.findOne({
        where: { coupon_id: coupon.id },
        select: ["redeemed_count"],
      });
      const redeemedCount = counter?.redeemed_count ?? 0;
      if (redeemedCount >= limit) {
        return {
          valid: false,
          reason_code: "QUOTA_EXCEEDED",
          message: "Coupon quota exhausted",
        };
      }
    }

    // Type-specific validations
    if (coupon.type === CouponType.FIRST_ORDER) {
      if (!dto.user_id) {
        return {
          valid: false,
          reason_code: "USER_REQUIRED",
          message: "User ID required for first order coupon",
        };
      }

      const paidOrdersCount = await this.countPaidOrders(dto.user_id);
      if (paidOrdersCount > 0) {
        return {
          valid: false,
          reason_code: "NOT_FIRST_ORDER",
          message: "This coupon is only valid for first order",
        };
      }
    }

    if (coupon.type === CouponType.NTH_ORDER) {
      if (!dto.user_id) {
        return {
          valid: false,
          reason_code: "USER_REQUIRED",
          message: "User ID required for nth order coupon",
        };
      }

      const nth = coupon.type_meta?.nth;
      if (!nth || typeof nth !== "number") {
        return {
          valid: false,
          reason_code: "INVALID_META",
          message: "Invalid nth order configuration",
        };
      }

      const paidOrdersCount = await this.countPaidOrders(dto.user_id);
      if (paidOrdersCount + 1 !== nth) {
        return {
          valid: false,
          reason_code: "NOT_NTH_ORDER",
          message: `This coupon is only valid for ${nth}${this.getOrdinalSuffix(nth)} order`,
        };
      }
    }

    // PREORDER-specific validations
    if (coupon.type === CouponType.PREORDER) {
      // Validate item_id matches (if provided in DTO)
      if (coupon.type_meta?.item_id && (dto as any).item_id) {
        if (coupon.type_meta.item_id !== (dto as any).item_id) {
          return {
            valid: false,
            reason_code: "INVALID_ITEM",
            message: "This preorder is not for this item",
          };
        }
      }

      // NOTE: Cart can only contain preorder items OR regular items, not both
      // This validation is handled in CartService.addToCart()
      // Preorder coupon only applies when cart contains preorder items
    }

    return { valid: true };
  }

  /**
   * Calculate discount amount based on coupon type
   */
  private async calculateDiscount(
    coupon: Coupon,
    cartTotal: number,
  ): Promise<{ discount_amount: number; delivery_waived: boolean }> {
    let discountAmount = 0;
    let deliveryWaived = false;

    switch (coupon.type) {
      case CouponType.FLAT:
        discountAmount = Math.min(coupon.value || 0, cartTotal);
        break;

      case CouponType.PERCENT:
        const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
        discountAmount = Math.min(
          percentDiscount,
          coupon.max_discount_amount || Infinity,
        );
        break;

      case CouponType.FREE_DELIVERY:
        // Get delivery fee from config or type_meta
        const deliveryFee =
          coupon.type_meta?.delivery_fee_cap ||
          (await this.getPlatformDeliveryFee());
        discountAmount = deliveryFee;
        deliveryWaived = true;
        break;

      case CouponType.FIRST_ORDER:
      case CouponType.NTH_ORDER:
        // These use value_type to determine discount
        if (coupon.value_type === ValueType.PERCENT) {
          const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
          discountAmount = Math.min(
            percentDiscount,
            coupon.max_discount_amount || Infinity,
          );
        } else {
          discountAmount = Math.min(coupon.value || 0, cartTotal);
        }
        break;

      case CouponType.REFERRAL:
        // Referral discount from type_meta or value
        if (coupon.value_type === ValueType.PERCENT) {
          const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
          discountAmount = Math.min(
            percentDiscount,
            coupon.max_discount_amount || Infinity,
          );
        } else {
          discountAmount = Math.min(coupon.value || 0, cartTotal);
        }
        break;

      case CouponType.PREORDER:
        // Preorder supports both flat and percentage discounts
        if (coupon.value_type === ValueType.PERCENT) {
          // Percentage discount with optional max cap
          const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
          discountAmount = Math.min(
            percentDiscount,
            coupon.max_discount_amount || Infinity,
          );
        } else {
          // Flat discount (value_type === ValueType.RUPEES)
          // Fixed rupee amount off the item price
          discountAmount = Math.min(coupon.value || 0, cartTotal);
        }

        // Check if free delivery is included
        deliveryWaived = coupon.type_meta?.free_delivery === true;
        break;

      default:
        discountAmount = 0;
    }

    return {
      discount_amount: Math.max(0, discountAmount),
      delivery_waived: deliveryWaived,
    };
  }

  /**
   * Count paid orders for a user
   * Note: This queries the order table directly. In production, inject Order repository.
   */
  private async countPaidOrders(userId: number): Promise<number> {
    // Query order table - adjust table name and status values based on your schema
    const query = `
      SELECT COUNT(*)::int as count
      FROM "order"
      WHERE user_id = $1
      AND status IN ('paid', 'delivered', 'confirmed', 'completed')
    `;

    try {
      const result = await this.dataSource.query(query, [userId]);
      return parseInt(result[0]?.count || "0", 10);
    } catch (error) {
      this.logger.error(`Error counting paid orders: ${error.message}`);
      // Fallback: return 0 to allow coupon validation to proceed
      // In production, this should be properly handled
      return 0;
    }
  }

  /**
   * Get platform delivery fee (from config or default)
   */
  private async getPlatformDeliveryFee(): Promise<number> {
    // In real implementation, get from config service
    return 50; // Default delivery fee
  }

  /**
   * Get ordinal suffix (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(n: number): string {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }

  // ==================== Reservation ====================

  /**
   * Create reservation explicitly
   */
  async reserveCoupon(
    dto: ReserveCouponDto,
  ): Promise<{ reservation_token: string; expires_in_seconds: number }> {
    // FIX: Load campaign relation since runValidationChecks needs coupon.campaign.status
    const coupon = await this.couponRepository.findOne({
      where: { code: dto.code },
      relations: ["campaign"], // Load campaign relation
    });

    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    const validation = await this.runValidationChecks(coupon, {
      code: dto.code,
      user_id: dto.user_id,
      cart_total: dto.cart_total,
      pincode: dto.pincode,
      store_id: dto.store_id,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const reservation = await this.createReservation(coupon, {
      code: dto.code,
      user_id: dto.user_id,
      cart_total: dto.cart_total,
      pincode: dto.pincode,
      store_id: dto.store_id,
    });

    if (!reservation.success) {
      throw new BadRequestException(
        reservation.reason || "Failed to reserve coupon",
      );
    }

    return {
      reservation_token: reservation.token!,
      expires_in_seconds: reservation.ttl!,
    };
  }

  /**
   * Create reservation in Redis
   */
  private async createReservation(
    coupon: Coupon,
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    success: boolean;
    token?: string;
    ttl?: number;
    reason?: string;
  }> {
    const reservationToken = uuidv4();
    const ttl = 900; // 15 minutes default

    const metadata = {
      coupon_id: coupon.id,
      user_id: dto.user_id,
      cart_total: dto.cart_total,
      pincode: dto.pincode,
      store_id: dto.store_id,
      created_at: new Date().toISOString(),
    };

    const result = await this.redisCouponService.reserveCoupon(
      coupon.id,
      reservationToken,
      metadata,
      ttl,
    );

    if (!result.success) {
      return result;
    }

    // Create redemption record with status=reserved
    const redemption = this.redemptionRepository.create({
      coupon_id: coupon.id,
      campaign_id: coupon.campaign_id,
      user_id: dto.user_id,
      status: RedemptionStatus.RESERVED,
      reserved_token: reservationToken,
    });

    await this.redemptionRepository.save(redemption);

    return {
      success: true,
      token: reservationToken,
      ttl,
    };
  }

  // ==================== Redemption ====================

  /**
   * Redeem coupon (finalize on payment success)
   */
  async redeemCoupon(dto: RedeemCouponDto): Promise<{
    success: boolean;
    discount_amount?: number;
    delivery_waived?: boolean;
  }> {
    // Get reservation
    const reservation = await this.redisCouponService.getReservation(
      dto.reservation_token,
    );

    if (!reservation) {
      throw new NotFoundException("Reservation not found or expired");
    }

    // Check idempotency
    if (dto.idempotency_key) {
      const existing = await this.redemptionRepository.findOne({
        where: { idempotency_key: dto.idempotency_key },
      });

      if (existing && existing.status === RedemptionStatus.REDEEMED) {
        // Return existing redemption
        return {
          success: true,
          discount_amount: existing.amount_applied || 0,
          delivery_waived: existing.delivery_waived,
        };
      }
    }

    // Get coupon
    const coupon = await this.couponRepository.findOne({
      where: { id: reservation.coupon_id },
    });

    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    // Check payment status
    if (dto.payment_status !== PaymentStatus.PAID) {
      throw new BadRequestException(
        "Coupon can only be redeemed on successful payment",
      );
    }

    // Calculate discount
    const discountResult = await this.calculateDiscount(
      coupon,
      reservation.cart_total,
    );

    // Use transaction for atomic operations
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update redemption record
      const redemption = await queryRunner.manager.findOne(
        CouponRedemption,
        {
          where: { reserved_token: dto.reservation_token },
        },
      );

      if (!redemption) {
        throw new NotFoundException("Redemption record not found");
      }

      if (redemption.status === RedemptionStatus.REDEEMED) {
        // Already redeemed (idempotency)
        await queryRunner.rollbackTransaction();
        return {
          success: true,
          discount_amount: redemption.amount_applied || 0,
          delivery_waived: redemption.delivery_waived,
        };
      }

      redemption.status = RedemptionStatus.REDEEMED;
      redemption.order_id = dto.order_id;
      redemption.user_id = dto.user_id;
      redemption.amount_applied = discountResult.discount_amount;
      redemption.delivery_waived = discountResult.delivery_waived;
      redemption.idempotency_key = dto.idempotency_key;

      await queryRunner.manager.save(redemption);

      // Update counter
      let counter = await queryRunner.manager.findOne(CouponCounter, {
        where: { coupon_id: coupon.id },
      });

      if (!counter) {
        counter = queryRunner.manager.create(CouponCounter, {
          coupon_id: coupon.id,
          redeemed_count: 1,
        });
      } else {
        counter.redeemed_count += 1;
      }

      await queryRunner.manager.save(counter);

      // If single-use, update coupon status
      if (coupon.global_usage_limit === 1) {
        coupon.status = CouponStatus.REVOKED;
        await queryRunner.manager.save(coupon);
      }

      await queryRunner.commitTransaction();

      // Delete reservation from Redis
      await this.redisCouponService.deleteReservation(dto.reservation_token);

      this.logger.log(
        `Redeemed coupon ${coupon.code} for order ${dto.order_id}`,
      );

      return {
        success: true,
        discount_amount: discountResult.discount_amount,
        delivery_waived: discountResult.delivery_waived,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Compensating increment in Redis (schedule retry)
      await this.redisCouponService.incrementQuota(coupon.id, 1);

      this.logger.error(
        `Error redeeming coupon: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to redeem coupon");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rollback reservation
   */
  async rollbackCoupon(dto: RollbackCouponDto): Promise<{ success: boolean }> {
    // Try to get reservation metadata from Redis (may have expired)
    const reservation = await this.redisCouponService.getReservation(
      dto.reservation_token,
    );

    // Update redemption status (DB is the source of truth even if Redis expired)
    const redemption = await this.redemptionRepository.findOne({
      where: { reserved_token: dto.reservation_token },
    });

    if (!reservation && !redemption) {
      throw new NotFoundException("Reservation not found or already rolled back");
    }

    // If already redeemed, treat rollback as a no-op (idempotent)
    if (redemption && redemption.status === RedemptionStatus.REDEEMED) {
      this.logger.log(
        `Rollback requested for already redeemed reservation ${dto.reservation_token}, skipping.`,
      );
      return { success: true };
    }

    if (redemption) {
      redemption.status = RedemptionStatus.ROLLED_BACK;
      await this.redemptionRepository.save(redemption);
    }

    // Determine coupon_id for quota restoration
    const couponId =
      reservation?.coupon_id ?? redemption?.coupon_id;

    if (couponId) {
      // releaseReservation always restores quota even if the Redis key has already expired.
      await this.redisCouponService.releaseReservation(
        couponId,
        dto.reservation_token,
      );
    }

    this.logger.log(`Rolled back reservation ${dto.reservation_token}`);

    return { success: true };
  }

  /**
   * Check if a reservation token is still valid in Redis.
   * Used by cart service to decide whether to reuse an existing reservation.
   */
  async isReservationValid(reservationToken: string): Promise<boolean> {
    const reservation =
      await this.redisCouponService.getReservation(reservationToken);
    return reservation != null;
  }

  async autoRollbackStaleReservations() {
    try {
      const ttlSeconds =
        this.configService.get<number>("COUPON_RESERVATION_TTL") || 900;
      // Add a small safety buffer so we only touch clearly expired reservations
      const bufferSeconds = 60;
      const cutoff = new Date(
        Date.now() - (ttlSeconds + bufferSeconds) * 1000,
      );

      const staleRedemptions = await this.redemptionRepository.find({
        where: {
          status: RedemptionStatus.RESERVED,
          created_at: LessThan(cutoff),
        },
      });

      if (!staleRedemptions.length) {
        return;
      }

      this.logger.log(
        `🧹 Auto-rollback: found ${staleRedemptions.length} stale reservations older than TTL`,
      );

      for (const redemption of staleRedemptions) {
        if (!redemption.reserved_token) {
          continue;
        }
        try {
          await this.rollbackCoupon({
            reservation_token: redemption.reserved_token,
            reason: "Auto-rollback after TTL expiry",
          });
        } catch (error) {
          this.logger.warn(
            `⚠️ Failed auto-rollback for reservation ${redemption.reserved_token}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Error during auto-rollback of stale reservations: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get coupon status
   */
  async getCouponStatus(code: string): Promise<{
    code: string;
    status: string;
    valid: boolean;
    message?: string;
  }> {
    const coupon = await this.couponRepository.findOne({
      where: { code },
      relations: ["campaign"],
    });

    if (!coupon) {
      return {
        code,
        status: "NOT_FOUND",
        valid: false,
        message: "Coupon code not found",
      };
    }

    // Use IST time to ensure consistent timezone comparison with database timestamps
    const now = TimezoneUtil.getCurrentISTTime();
    let valid = coupon.status === CouponStatus.ACTIVE;
    let message = "";

    if (coupon.start_at && now < coupon.start_at) {
      valid = false;
      message = "Coupon not yet valid";
    } else if (coupon.end_at && now > coupon.end_at) {
      valid = false;
      message = "Coupon expired";
    } else if (coupon.status !== CouponStatus.ACTIVE) {
      valid = false;
      message = "Coupon is inactive";
    } else if (coupon.campaign.status !== CampaignStatus.ACTIVE) {
      valid = false;
      message = "Campaign is inactive";
    }

    return {
      code,
      status: coupon.status,
      valid,
      message: message || "Coupon is valid",
    };
  }

  // ==================== Quota Management ====================

  /**
   * Get current quota for a coupon
   * - current_quota: remaining slots from Redis (used by reserve/release; can be stale if Redis was reset)
   * - global_usage_limit: max limit from DB (coupon config)
   * - redeemed_count: number of successful redemptions from DB (paid uses)
   * - effective_remaining: max(0, global_usage_limit - redeemed_count); true remaining slots by config
   * - quota_out_of_sync: true when Redis current_quota disagrees with effective_remaining (e.g. Redis reset without accounting for redeemed_count)
   */
  async getCouponQuota(couponId: number): Promise<{
    coupon_id: number;
    current_quota: number | null;
    global_usage_limit: number | null;
    redeemed_count: number;
    effective_remaining: number;
    quota_out_of_sync: boolean;
  }> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
      select: ["id", "global_usage_limit"],
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${couponId} not found`);
    }

    const currentQuota = await this.redisCouponService.getQuota(couponId);
    const counter = await this.counterRepository.findOne({
      where: { coupon_id: couponId },
      select: ["redeemed_count"],
    });

    const redeemedCount = counter?.redeemed_count ?? 0;
    const globalLimit =
      coupon.global_usage_limit != null
        ? Number(coupon.global_usage_limit)
        : null;
    const effectiveRemaining =
      globalLimit != null
        ? Math.max(0, globalLimit - redeemedCount)
        : currentQuota ?? 0;
    const outOfSync =
      globalLimit != null &&
      (currentQuota === null || currentQuota !== effectiveRemaining);

    return {
      coupon_id: couponId,
      current_quota: currentQuota,
      global_usage_limit: coupon.global_usage_limit ?? null,
      redeemed_count: redeemedCount,
      effective_remaining: effectiveRemaining,
      quota_out_of_sync: outOfSync,
    };
  }

  /**
   * Increment quota for a coupon
   */
  async incrementCouponQuota(
    couponId: number,
    amount: number,
  ): Promise<{
    coupon_id: number;
    previous_quota: number | null;
    new_quota: number | null;
    amount_added: number;
  }> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
      select: ["id", "global_usage_limit"],
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${couponId} not found`);
    }

    const previousQuota = await this.redisCouponService.getQuota(couponId);
    await this.redisCouponService.incrementQuota(couponId, amount);
    const newQuota = await this.redisCouponService.getQuota(couponId);

    this.logger.log(
      `✅ Incremented quota for coupon ${couponId}: ${previousQuota} → ${newQuota} (+${amount})`,
    );

    return {
      coupon_id: couponId,
      previous_quota: previousQuota,
      new_quota: newQuota,
      amount_added: amount,
    };
  }

  /**
   * Reset quota for a coupon to a specific value.
   * Overwrites Redis quota only; DB global_usage_limit is unchanged.
   */
  async resetCouponQuota(
    couponId: number,
    newQuota: number,
  ): Promise<{
    coupon_id: number;
    previous_quota: number | null;
    new_quota: number;
    global_usage_limit: number | null;
  }> {
    if (newQuota < 0) {
      throw new BadRequestException("quota must not be less than 0");
    }

    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
      select: ["id", "global_usage_limit"],
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${couponId} not found`);
    }

    const previousQuota = await this.redisCouponService.getQuota(couponId);
    await this.redisCouponService.initializeQuota(couponId, newQuota);

    if (
      coupon.global_usage_limit != null &&
      newQuota > Number(coupon.global_usage_limit)
    ) {
      this.logger.warn(
        `⚠️ Reset quota ${newQuota} for coupon ${couponId} exceeds DB global_usage_limit (${coupon.global_usage_limit}). Redis updated; DB limit unchanged.`,
      );
    }

    this.logger.log(
      `✅ Reset quota for coupon ${couponId}: ${previousQuota} → ${newQuota}`,
    );

    return {
      coupon_id: couponId,
      previous_quota: previousQuota,
      new_quota: newQuota,
      global_usage_limit: coupon.global_usage_limit ?? null,
    };
  }
}

