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
import { Repository, DataSource, In, LessThan, Not, IsNull } from "typeorm";
import { CronJob } from "cron";
import { v4 as uuidv4 } from "uuid";
import {
  CouponCampaign,
  CampaignStatus,
} from "../entities/coupon-campaign.entity";
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
import { Store } from "../../store/entities/store.entity";
import { Cart } from "../../cart/entities/cart.entity";
import { CartItem } from "../../cart/entities/cart-item.entity";
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
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly redisCouponService: RedisCouponService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.registerAutoRollbackCron();
  }

  /**
   * Generate a process-safe correlation ID for logs across sync and async flows.
   */
  private createCorrelationId(prefix: string): string {
    return `${prefix}-${uuidv4()}`;
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

    if (
      dto.type === CouponType.PERCENT &&
      dto.value_type !== ValueType.PERCENT
    ) {
      throw new BadRequestException(
        "Percent coupon type must use value_type=percent",
      );
    }

    if (dto.type === CouponType.FLAT && dto.value_type !== ValueType.RUPEES) {
      throw new BadRequestException(
        "Flat coupon type must use value_type=rupees",
      );
    }

    if (dto.type === CouponType.FLAT && dto.value <= 0) {
      throw new BadRequestException("Flat coupon value must be greater than 0");
    }

    if (
      dto.type === CouponType.FREE_DELIVERY &&
      dto.value_type !== ValueType.RUPEES
    ) {
      throw new BadRequestException(
        "Free delivery coupon type must use value_type=rupees",
      );
    }

    if (dto.type === CouponType.FREE_DELIVERY && Number(dto.value || 0) !== 0) {
      throw new BadRequestException("Free delivery coupon value must be 0");
    }

    if (
      (dto.type === CouponType.PERCENT ||
        dto.value_type === ValueType.PERCENT) &&
      (dto.value <= 0 || dto.value > 100)
    ) {
      throw new BadRequestException(
        "Percent coupon value must be greater than 0 and less than or equal to 100",
      );
    }

    // Validate percent coupon has max_discount_amount
    if (
      dto.value_type === ValueType.PERCENT &&
      (!dto.max_discount_amount || dto.max_discount_amount <= 0)
    ) {
      throw new BadRequestException(
        "Percent coupons must have max_discount_amount > 0",
      );
    }

    if (dto.type === CouponType.PERCENT) {
      const metaValidation = this.validatePercentCouponTypeMeta(dto.type_meta);
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }

      dto.type_meta = await this.enrichPercentCouponTypeMeta(dto.type_meta);
    }

    if (dto.type === CouponType.FLAT) {
      const metaValidation = this.validateFlatCouponTypeMeta(dto.type_meta);
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }

      dto.type_meta = await this.enrichFlatCouponTypeMeta(dto.type_meta);
    }

    if (dto.type === CouponType.FREE_DELIVERY) {
      const metaValidation = this.validateFreeDeliveryCouponTypeMeta(
        dto.type_meta,
      );
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }

      dto.type_meta = await this.enrichFreeDeliveryCouponTypeMeta(
        dto.type_meta,
      );
    }

    if (dto.type === CouponType.NTH_ORDER) {
      const metaValidation = this.validateNthOrderCouponTypeMeta(dto.type_meta);
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }
    }

    if (dto.type === CouponType.FIRST_ORDER) {
      const metaValidation = this.validateFirstOrderCouponTypeMeta(dto.type_meta);
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }
    }

    if (dto.type === CouponType.REFERRAL) {
      const metaValidation = this.validateReferralCouponTypeMeta(dto.type_meta);
      if (!metaValidation.valid) {
        throw new BadRequestException(metaValidation.message);
      }
    }

    // NEW: Validate preorder coupon specific fields
    if (dto.type === CouponType.PREORDER) {
      const preorderTypeMeta = dto.type_meta as Record<string, any>;

      if (!dto.type_meta) {
        throw new BadRequestException(
          "type_meta is required for preorder coupons",
        );
      }

      // Validate item_id exists
      if (!preorderTypeMeta.item_id) {
        throw new BadRequestException(
          "item_id is required in type_meta for preorder coupons",
        );
      }

      const itemId = Number(preorderTypeMeta.item_id);
      if (isNaN(itemId) || itemId <= 0) {
        throw new BadRequestException(
          "item_id must be a valid positive number",
        );
      }

      const item = await this.itemRepository.findOne({
        where: { id: itemId },
      });

      if (!item) {
        throw new BadRequestException(`Item with ID ${itemId} not found`);
      }

      // Validate delivery_date exists
      if (!preorderTypeMeta.delivery_date) {
        throw new BadRequestException(
          "delivery_date is required in type_meta for preorder coupons",
        );
      }

      // Parse delivery_date
      const deliveryDate = new Date(preorderTypeMeta.delivery_date);
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
          `delivery_date (${preorderTypeMeta.delivery_date}) must be a future date`,
        );
      }

      // NOTE: We no longer require type_meta.final_price for preorder coupons.
      // Discount and effective final price are derived from coupon.value and value_type,
      // together with max_discount_amount, in the cart and order flows.

      this.logger.log(
        `✅ Preorder coupon validation passed: item_id=${itemId}, delivery_date=${preorderTypeMeta.delivery_date}`,
      );
    }

    const codeLength = dto.length || 8;
    const count = dto.preview ? Math.min(dto.count, 10) : dto.count;
    const codes: string[] = [];
    const existingCodes = new Set<string>();
    const normalizedPrefix = this.normalizeCouponPrefix(dto.prefix);
    const separator = dto.separator ?? "";

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
      const code = this.generateCode(normalizedPrefix, codeLength, separator);

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
    const defaultPriority =
      dto.priority !== undefined && dto.priority !== null ? dto.priority : 0;

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

    this.logger.log(
      `Generated ${codes.length} codes for campaign ${campaignId}`,
    );

    return { codes, preview: false };
  }

  /**
   * Generate a single unique code
   */
  private generateCode(
    prefix?: string,
    length: number = 8,
    separator: "" | "-" = "",
  ): string {
    let code = prefix ? `${prefix}${separator}` : "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * CODE_CHARSET.length);
      code += CODE_CHARSET[randomIndex];
    }

    return code;
  }

  private normalizeCouponPrefix(prefix?: string): string | undefined {
    if (prefix == null) {
      return undefined;
    }

    const normalized = String(prefix).trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    if (!/^[A-Z0-9]{1,12}$/.test(normalized)) {
      throw new BadRequestException(
        "prefix must be alphanumeric and up to 12 characters",
      );
    }

    return normalized;
  }

  private resolveRedemptionIdempotencyKey(dto: RedeemCouponDto): string {
    const provided = dto.idempotency_key?.trim();
    if (provided) {
      return provided;
    }

    return `coupon-redeem-${dto.order_id}-${dto.reservation_token}`;
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
  async validateCoupon(dto: ValidateCouponDto): Promise<{
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

    // Defensive guard for malformed persisted coupons.
    const configValidation = this.validateCouponConfiguration(coupon);
    if (!configValidation.valid) {
      return configValidation;
    }

    // Calculate discount
    const discountResult = await this.calculateDiscount(
      coupon,
      dto.cart_total,
      validation.eligible_item_subtotal,
      dto.delivery_fee,
    );

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
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
    eligible_item_subtotal?: number;
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
    if (coupon.applicable_store_ids && coupon.applicable_store_ids.length > 0) {
      if (
        !dto.store_id ||
        !coupon.applicable_store_ids.includes(dto.store_id)
      ) {
        return {
          valid: false,
          reason_code: "INVALID_STORE",
          message: "Coupon not valid for this store",
        };
      }
    }

    // Check per-user usage limit
    if (dto.user_id) {
      const userRedemptions =
        coupon.type === CouponType.PREORDER ||
        coupon.type === CouponType.NTH_ORDER ||
        coupon.type === CouponType.FIRST_ORDER
          ? await this.redemptionRepository.count({
              where: {
                coupon_id: coupon.id,
                user_id: dto.user_id,
                order_id: Not(IsNull()),
                status: In([
                  RedemptionStatus.RESERVED,
                  RedemptionStatus.REDEEMED,
                  RedemptionStatus.ROLLED_BACK,
                ]),
              },
            })
          : await this.redemptionRepository.count({
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
      let quota = await this.redisCouponService.getQuota(coupon.id);

      const consumedCount = await this.countConsumedQuotaSlots(coupon);

      // If Redis quota key is missing (restart/flush), reconstruct remaining safely once.
      if (quota === null) {
        const remaining = Math.max(0, limit - consumedCount);
        await this.redisCouponService.initializeQuotaIfAbsent(
          coupon.id,
          remaining,
        );
        quota = await this.redisCouponService.getQuota(coupon.id);
      }

      if (quota !== null && quota <= 0) {
        return {
          valid: false,
          reason_code: "QUOTA_EXCEEDED",
          message: "Coupon quota exhausted",
        };
      }

      // Source-of-truth safety check so reserves are blocked even when Redis drifts.
      if (consumedCount >= limit) {
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

      const nthValidation = this.validateNthOrderCouponTypeMeta(coupon.type_meta);
      if (!nthValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_META",
          message: "Invalid nth order configuration",
        };
      }

      const nth = coupon.type_meta!.nth;

      const paidOrdersCount = await this.countPaidOrders(dto.user_id);
      if (paidOrdersCount + 1 !== nth) {
        return {
          valid: false,
          reason_code: "NOT_NTH_ORDER",
          message: `This coupon is only valid for ${nth}${this.getOrdinalSuffix(nth)} order`,
        };
      }
    }

    if (coupon.type === CouponType.REFERRAL) {
      const referralValidation = await this.validateReferralCouponEligibility(
        coupon,
        dto,
      );

      if (!referralValidation.valid) {
        return referralValidation;
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

    if (coupon.type === CouponType.PERCENT) {
      const percentScopeValidation = await this.validatePercentCouponScope(
        coupon,
        dto,
      );

      if (!percentScopeValidation.valid) {
        return percentScopeValidation;
      }

      return {
        valid: true,
        eligible_item_subtotal: percentScopeValidation.eligible_item_subtotal,
      };
    }

    if (coupon.type === CouponType.FLAT) {
      const flatScopeValidation = await this.validateFlatCouponScope(
        coupon,
        dto,
      );

      if (!flatScopeValidation.valid) {
        return flatScopeValidation;
      }

      return {
        valid: true,
        eligible_item_subtotal: flatScopeValidation.eligible_item_subtotal,
      };
    }

    if (coupon.type === CouponType.FREE_DELIVERY) {
      if (
        typeof dto.delivery_fee !== "number" ||
        !Number.isFinite(dto.delivery_fee) ||
        dto.delivery_fee < 0
      ) {
        return {
          valid: false,
          reason_code: "DELIVERY_FEE_REQUIRED",
          message:
            "delivery_fee is required and must be a non-negative number for free_delivery coupons",
        };
      }

      const freeDeliveryScopeValidation =
        await this.validateFreeDeliveryCouponScope(coupon, dto);

      if (!freeDeliveryScopeValidation.valid) {
        return freeDeliveryScopeValidation;
      }

      return {
        valid: true,
        eligible_item_subtotal:
          freeDeliveryScopeValidation.eligible_item_subtotal,
      };
    }

    return { valid: true };
  }

  /**
   * Count consumed quota slots from DB as a safety source of truth.
   * RESERVED always consumes a slot until explicit rollback.
   * PREORDER/NTH_ORDER can intentionally retain consumed usage as ROLLED_BACK when linked to an order.
   */
  private async countConsumedQuotaSlots(coupon: Coupon): Promise<number> {
    if (coupon.type === CouponType.PREORDER || coupon.type === CouponType.NTH_ORDER) {
      return this.redemptionRepository.count({
        where: [
          {
            coupon_id: coupon.id,
            status: RedemptionStatus.RESERVED,
          },
          {
            coupon_id: coupon.id,
            status: RedemptionStatus.REDEEMED,
          },
          {
            coupon_id: coupon.id,
            status: RedemptionStatus.ROLLED_BACK,
            order_id: Not(IsNull()),
          },
        ],
      });
    }

    return this.redemptionRepository.count({
      where: {
        coupon_id: coupon.id,
        status: In([RedemptionStatus.RESERVED, RedemptionStatus.REDEEMED]),
      },
    });
  }

  private validateCouponConfiguration(coupon: Coupon): {
    valid: boolean;
    reason_code?: string;
    message?: string;
  } {
    if (
      coupon.type === CouponType.PERCENT &&
      coupon.value_type !== ValueType.PERCENT
    ) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (
      coupon.type === CouponType.FLAT &&
      coupon.value_type !== ValueType.RUPEES
    ) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (
      (coupon.type === CouponType.PERCENT ||
        coupon.value_type === ValueType.PERCENT) &&
      ((coupon.value || 0) <= 0 || (coupon.value || 0) > 100)
    ) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (coupon.type === CouponType.FLAT && (coupon.value || 0) <= 0) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (
      coupon.type === CouponType.FREE_DELIVERY &&
      coupon.value_type !== ValueType.RUPEES
    ) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (
      coupon.type === CouponType.FREE_DELIVERY &&
      Number(coupon.value || 0) !== 0
    ) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    if (coupon.type === CouponType.PERCENT) {
      const metaValidation = this.validatePercentCouponTypeMeta(
        coupon.type_meta,
      );
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    if (coupon.type === CouponType.FLAT) {
      const metaValidation = this.validateFlatCouponTypeMeta(coupon.type_meta);
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    if (coupon.type === CouponType.FREE_DELIVERY) {
      const metaValidation = this.validateFreeDeliveryCouponTypeMeta(
        coupon.type_meta,
      );
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    if (coupon.type === CouponType.NTH_ORDER) {
      const metaValidation = this.validateNthOrderCouponTypeMeta(
        coupon.type_meta,
      );
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    if (coupon.type === CouponType.FIRST_ORDER) {
      const metaValidation = this.validateFirstOrderCouponTypeMeta(
        coupon.type_meta,
      );
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    if (coupon.type === CouponType.REFERRAL) {
      const metaValidation = this.validateReferralCouponTypeMeta(
        coupon.type_meta,
      );
      if (!metaValidation.valid) {
        return {
          valid: false,
          reason_code: "INVALID_COUPON_CONFIG",
          message: "Invalid coupon configuration",
        };
      }
    }

    return { valid: true };
  }

  private validatePercentCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (!typeMeta) {
      return { valid: true };
    }

    const hasStoreReferenceId =
      typeof typeMeta.store_reference_id === "string" &&
      typeMeta.store_reference_id.trim().length > 0;

    const hasItemReferenceIds =
      Array.isArray(typeMeta.item_reference_ids) &&
      typeMeta.item_reference_ids.length > 0;

    // Global percent coupon is valid: no store + no item references.
    // If item references are present, store reference must also be present.
    if (hasItemReferenceIds && !hasStoreReferenceId) {
      return {
        valid: false,
        message:
          "store_reference_id is required when item_reference_ids is provided for percent coupons",
      };
    }

    if (typeMeta.store_reference_id !== undefined && !hasStoreReferenceId) {
      return {
        valid: false,
        message: "store_reference_id must be a non-empty string",
      };
    }

    if (typeMeta.item_reference_ids !== undefined) {
      if (!Array.isArray(typeMeta.item_reference_ids)) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }

      const hasInvalidItemReference = typeMeta.item_reference_ids.some(
        (value: unknown) =>
          typeof value !== "string" || value.trim().length === 0,
      );

      if (hasInvalidItemReference) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }
    }

    if (
      typeMeta.free_delivery !== undefined &&
      typeof typeMeta.free_delivery !== "boolean"
    ) {
      return {
        valid: false,
        message: "free_delivery must be a boolean",
      };
    }

    if (typeMeta.delivery_fee_cap !== undefined) {
      if (
        typeof typeMeta.delivery_fee_cap !== "number" ||
        Number.isNaN(typeMeta.delivery_fee_cap) ||
        typeMeta.delivery_fee_cap < 0
      ) {
        return {
          valid: false,
          message: "delivery_fee_cap must be a non-negative number",
        };
      }

      if (typeMeta.free_delivery !== true) {
        return {
          valid: false,
          message:
            "delivery_fee_cap can be used only when free_delivery is true",
        };
      }
    }

    const allowedKeys = new Set([
      "store_reference_id",
      "item_reference_ids",
      "free_delivery",
      "delivery_fee_cap",
      "internal_store_id",
      "internal_item_ids",
    ]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );
    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for percent coupons: ${unknownKeys.join(", ")}`,
      };
    }

    return { valid: true };
  }

  private validateFlatCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (!typeMeta) {
      return { valid: true };
    }

    const hasStoreReferenceId =
      typeof typeMeta.store_reference_id === "string" &&
      typeMeta.store_reference_id.trim().length > 0;

    const hasItemReferenceIds =
      Array.isArray(typeMeta.item_reference_ids) &&
      typeMeta.item_reference_ids.length > 0;

    if (hasItemReferenceIds && !hasStoreReferenceId) {
      return {
        valid: false,
        message:
          "store_reference_id is required when item_reference_ids is provided for flat coupons",
      };
    }

    if (typeMeta.store_reference_id !== undefined && !hasStoreReferenceId) {
      return {
        valid: false,
        message: "store_reference_id must be a non-empty string",
      };
    }

    if (typeMeta.item_reference_ids !== undefined) {
      if (!Array.isArray(typeMeta.item_reference_ids)) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }

      const hasInvalidItemReference = typeMeta.item_reference_ids.some(
        (value: unknown) =>
          typeof value !== "string" || value.trim().length === 0,
      );

      if (hasInvalidItemReference) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }
    }

    if (
      typeMeta.free_delivery !== undefined &&
      typeof typeMeta.free_delivery !== "boolean"
    ) {
      return {
        valid: false,
        message: "free_delivery must be a boolean",
      };
    }

    if (typeMeta.delivery_fee_cap !== undefined) {
      if (
        typeof typeMeta.delivery_fee_cap !== "number" ||
        Number.isNaN(typeMeta.delivery_fee_cap) ||
        typeMeta.delivery_fee_cap < 0
      ) {
        return {
          valid: false,
          message: "delivery_fee_cap must be a non-negative number",
        };
      }

      if (typeMeta.free_delivery !== true) {
        return {
          valid: false,
          message:
            "delivery_fee_cap can be used only when free_delivery is true",
        };
      }
    }

    const allowedKeys = new Set([
      "store_reference_id",
      "item_reference_ids",
      "free_delivery",
      "delivery_fee_cap",
      "internal_store_id",
      "internal_item_ids",
    ]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );
    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for flat coupons: ${unknownKeys.join(", ")}`,
      };
    }

    return { valid: true };
  }

  private validateFreeDeliveryCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (!typeMeta) {
      return { valid: true };
    }

    const hasStoreReferenceId =
      typeof typeMeta.store_reference_id === "string" &&
      typeMeta.store_reference_id.trim().length > 0;

    const hasItemReferenceIds =
      Array.isArray(typeMeta.item_reference_ids) &&
      typeMeta.item_reference_ids.length > 0;

    if (hasItemReferenceIds && !hasStoreReferenceId) {
      return {
        valid: false,
        message:
          "store_reference_id is required when item_reference_ids is provided for free_delivery coupons",
      };
    }

    if (typeMeta.store_reference_id !== undefined && !hasStoreReferenceId) {
      return {
        valid: false,
        message: "store_reference_id must be a non-empty string",
      };
    }

    if (typeMeta.item_reference_ids !== undefined) {
      if (!Array.isArray(typeMeta.item_reference_ids)) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }

      const hasInvalidItemReference = typeMeta.item_reference_ids.some(
        (value: unknown) =>
          typeof value !== "string" || value.trim().length === 0,
      );

      if (hasInvalidItemReference) {
        return {
          valid: false,
          message: "item_reference_ids must be an array of non-empty strings",
        };
      }
    }

    if (typeMeta.delivery_fee_cap !== undefined) {
      if (
        typeof typeMeta.delivery_fee_cap !== "number" ||
        Number.isNaN(typeMeta.delivery_fee_cap) ||
        typeMeta.delivery_fee_cap < 0
      ) {
        return {
          valid: false,
          message: "delivery_fee_cap must be a non-negative number",
        };
      }
    }

    const allowedKeys = new Set([
      "store_reference_id",
      "item_reference_ids",
      "delivery_fee_cap",
      "internal_store_id",
      "internal_item_ids",
    ]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );

    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for free_delivery coupons: ${unknownKeys.join(", ")}`,
      };
    }

    return { valid: true };
  }

  private validateNthOrderCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (!typeMeta || typeof typeMeta !== "object") {
      return {
        valid: false,
        message: "type_meta is required for nth_order coupons",
      };
    }

    const allowedKeys = new Set(["nth"]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );

    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for nth_order coupons: ${unknownKeys.join(", ")}`,
      };
    }

    if (!Number.isInteger(typeMeta.nth) || typeMeta.nth < 1) {
      return {
        valid: false,
        message: "type_meta.nth must be an integer greater than or equal to 1",
      };
    }

    return { valid: true };
  }

  private validateFirstOrderCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (typeMeta === undefined || typeMeta === null) {
      return { valid: true };
    }

    if (typeof typeMeta !== "object" || Array.isArray(typeMeta)) {
      return {
        valid: false,
        message: "type_meta must be an object for first_order coupons",
      };
    }

    const allowedKeys = new Set(["source", "notes"]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );

    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for first_order coupons: ${unknownKeys.join(", ")}`,
      };
    }

    if (
      typeMeta.source !== undefined &&
      (typeof typeMeta.source !== "string" || typeMeta.source.trim().length === 0)
    ) {
      return {
        valid: false,
        message: "type_meta.source must be a non-empty string",
      };
    }

    if (
      typeMeta.notes !== undefined &&
      (typeof typeMeta.notes !== "string" || typeMeta.notes.trim().length === 0)
    ) {
      return {
        valid: false,
        message: "type_meta.notes must be a non-empty string",
      };
    }

    return { valid: true };
  }

  private validateReferralCouponTypeMeta(typeMeta?: Record<string, any>): {
    valid: boolean;
    message?: string;
  } {
    if (typeMeta === undefined || typeMeta === null) {
      return { valid: true };
    }

    if (typeof typeMeta !== "object" || Array.isArray(typeMeta)) {
      return {
        valid: false,
        message: "type_meta must be an object for referral coupons",
      };
    }

    const allowedKeys = new Set([
      "source",
      "referrer_user_id",
      "referral_code",
      "notes",
      "reward_type",
    ]);
    const unknownKeys = Object.keys(typeMeta).filter(
      (key) => !allowedKeys.has(key),
    );

    if (unknownKeys.length > 0) {
      return {
        valid: false,
        message: `Unknown type_meta keys for referral coupons: ${unknownKeys.join(", ")}`,
      };
    }

    if (
      typeMeta.source !== undefined &&
      (typeof typeMeta.source !== "string" || typeMeta.source.trim().length === 0)
    ) {
      return {
        valid: false,
        message: "type_meta.source must be a non-empty string",
      };
    }

    if (
      typeMeta.referral_code !== undefined &&
      (typeof typeMeta.referral_code !== "string" ||
        typeMeta.referral_code.trim().length === 0)
    ) {
      return {
        valid: false,
        message: "type_meta.referral_code must be a non-empty string",
      };
    }

    if (
      typeMeta.referrer_user_id !== undefined &&
      (!Number.isInteger(typeMeta.referrer_user_id) ||
        typeMeta.referrer_user_id <= 0)
    ) {
      return {
        valid: false,
        message: "type_meta.referrer_user_id must be a positive integer",
      };
    }

    if (
      typeMeta.reward_type !== undefined &&
      typeMeta.reward_type !== "referee" &&
      typeMeta.reward_type !== "referrer"
    ) {
      return {
        valid: false,
        message: "type_meta.reward_type must be either 'referee' or 'referrer'",
      };
    }

    const normalizedRewardType =
      typeMeta.reward_type === "referrer" ? "referrer" : "referee";

    if (
      normalizedRewardType === "referee" &&
      (typeof typeMeta.referral_code !== "string" ||
        typeMeta.referral_code.trim().length === 0)
    ) {
      return {
        valid: false,
        message:
          "type_meta.referral_code is required when reward_type is 'referee'",
      };
    }

    if (
      normalizedRewardType === "referee" &&
      (!Number.isInteger(typeMeta.referrer_user_id) ||
        typeMeta.referrer_user_id <= 0)
    ) {
      return {
        valid: false,
        message:
          "type_meta.referrer_user_id is required when reward_type is 'referee'",
      };
    }

    if (
      normalizedRewardType === "referrer" &&
      (!Number.isInteger(typeMeta.referrer_user_id) ||
        typeMeta.referrer_user_id <= 0)
    ) {
      return {
        valid: false,
        message:
          "type_meta.referrer_user_id is required when reward_type is 'referrer'",
      };
    }

    if (
      typeMeta.notes !== undefined &&
      (typeof typeMeta.notes !== "string" || typeMeta.notes.trim().length === 0)
    ) {
      return {
        valid: false,
        message: "type_meta.notes must be a non-empty string",
      };
    }

    return { valid: true };
  }

  private async validateReferralCouponEligibility(
    coupon: Coupon,
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
  }> {
    if (!dto.user_id) {
      return {
        valid: false,
        reason_code: "USER_REQUIRED",
        message: "User ID required for referral coupon",
      };
    }

    const typeMeta = coupon.type_meta || {};
    const rewardType =
      typeMeta.reward_type === "referrer" ? "referrer" : "referee";

    const requestReferralCode =
      typeof (dto as any).referral_code === "string"
        ? String((dto as any).referral_code).trim()
        : "";
    const requestReferrerUserId = Number((dto as any).referrer_user_id);

    if (rewardType === "referee") {
      if (!requestReferralCode || !Number.isInteger(requestReferrerUserId)) {
        return {
          valid: false,
          reason_code: "REFERRAL_CONTEXT_REQUIRED",
          message:
            "referral_code and referrer_user_id are required for referral coupon",
        };
      }

      if (requestReferrerUserId === Number(dto.user_id)) {
        return {
          valid: false,
          reason_code: "INVALID_REFERRAL",
          message: "Self-referral is not allowed",
        };
      }

      if (
        typeMeta.referral_code &&
        String(typeMeta.referral_code).trim() !== requestReferralCode
      ) {
        return {
          valid: false,
          reason_code: "INVALID_REFERRAL",
          message: "Referral code does not match coupon context",
        };
      }

      if (
        typeMeta.referrer_user_id &&
        Number(typeMeta.referrer_user_id) !== requestReferrerUserId
      ) {
        return {
          valid: false,
          reason_code: "INVALID_REFERRAL",
          message: "Referrer user does not match coupon context",
        };
      }

      const paidOrdersCount = await this.countPaidOrders(dto.user_id);
      if (paidOrdersCount > 0) {
        return {
          valid: false,
          reason_code: "NOT_FIRST_ORDER",
          message:
            "Referral coupon is only valid for referee's first paid order",
        };
      }

      return { valid: true };
    }

    if (!Number.isInteger(requestReferrerUserId)) {
      return {
        valid: false,
        reason_code: "REFERRAL_CONTEXT_REQUIRED",
        message: "referrer_user_id is required for referrer reward coupon",
      };
    }

    if (Number(dto.user_id) !== requestReferrerUserId) {
      return {
        valid: false,
        reason_code: "INVALID_REFERRAL",
        message: "Referrer reward coupon can only be used by the referrer",
      };
    }

    if (
      typeMeta.referrer_user_id &&
      Number(typeMeta.referrer_user_id) !== requestReferrerUserId
    ) {
      return {
        valid: false,
        reason_code: "INVALID_REFERRAL",
        message: "Referrer user does not match coupon context",
      };
    }

    return { valid: true };
  }

  /**
   * Calculate discount amount based on coupon type
   */
  private async calculateDiscount(
    coupon: Coupon,
    cartTotal: number,
    eligibleItemSubtotal?: number,
    actualDeliveryFee?: number,
  ): Promise<{ discount_amount: number; delivery_waived: boolean }> {
    let discountAmount = 0;
    let deliveryWaived = false;
    const discountBase =
      (coupon.type === CouponType.PERCENT || coupon.type === CouponType.FLAT) &&
      eligibleItemSubtotal !== undefined
        ? Math.max(0, Math.min(eligibleItemSubtotal, cartTotal))
        : cartTotal;

    switch (coupon.type) {
      case CouponType.FLAT:
        discountAmount = Math.min(coupon.value || 0, discountBase);
        deliveryWaived = coupon.type_meta?.free_delivery === true;
        break;

      case CouponType.PERCENT:
        const percentDiscount = (discountBase * (coupon.value || 0)) / 100;
        discountAmount = Math.min(
          percentDiscount,
          coupon.max_discount_amount || Infinity,
          discountBase,
        );
        deliveryWaived = coupon.type_meta?.free_delivery === true;
        break;

      case CouponType.FREE_DELIVERY:
        const deliveryFeeFromContext =
          typeof actualDeliveryFee === "number" &&
          Number.isFinite(actualDeliveryFee) &&
          actualDeliveryFee >= 0
            ? Number(actualDeliveryFee)
            : 0;

        const deliveryCap =
          coupon.type_meta?.delivery_fee_cap !== undefined &&
          coupon.type_meta?.delivery_fee_cap !== null
            ? Number(coupon.type_meta.delivery_fee_cap)
            : deliveryFeeFromContext;

        discountAmount = Math.min(
          Math.max(deliveryFeeFromContext, 0),
          Math.max(deliveryCap, 0),
        );
        deliveryWaived = discountAmount > 0;
        break;

      case CouponType.FIRST_ORDER:
      case CouponType.NTH_ORDER:
        // These use value_type to determine discount
        if (coupon.value_type === ValueType.PERCENT) {
          const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
          discountAmount = Math.min(
            percentDiscount,
            coupon.max_discount_amount || Infinity,
            cartTotal,
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
            cartTotal,
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
            cartTotal,
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
   * Uses metrics read model first, then falls back to order table.
   */
  private async countPaidOrders(userId: number): Promise<number> {
    const correlationId = this.createCorrelationId("coupon-paid-orders");

    const metricsCount = await this.readPaidOrdersCountFromMetrics(
      userId,
      correlationId,
    );

    if (metricsCount !== null) {
      return metricsCount;
    }

    return this.countPaidOrdersFromOrdersTable(userId, correlationId);
  }

  private async readPaidOrdersCountFromMetrics(
    userId: number,
    correlationId: string,
  ): Promise<number | null> {
    const query = `
      SELECT paid_order_count::int as count
      FROM user_order_metrics
      WHERE user_id = $1
      LIMIT 1
    `;

    try {
      const result = await this.dataSource.query(query, [userId]);
      if (!Array.isArray(result) || result.length === 0) {
        this.logger.debug(
          `[${correlationId}] user_order_metrics missing row for user ${userId}, falling back to order table count`,
        );
        return null;
      }

      return parseInt(String(result[0]?.count ?? "0"), 10);
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] user_order_metrics unavailable for user ${userId}, falling back to order table count`,
      );
      this.logger.debug(
        `[${correlationId}] user_order_metrics read error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Idempotently record a paid-like order event and increment metrics once per order.
   * This keeps nth-order eligibility deterministic across retries and duplicate callbacks.
   */
  async recordPaidOrderEvent(
    orderId: number,
    userId: number,
    correlationId: string = this.createCorrelationId("coupon-paid-event"),
  ): Promise<{ processed: boolean; paid_order_count?: number }> {
    const query = `
      WITH inserted AS (
        INSERT INTO order_paid_events_dedupe(order_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (order_id) DO NOTHING
        RETURNING order_id
      )
      INSERT INTO user_order_metrics(user_id, paid_order_count, updated_at)
      SELECT $2, 1, now()
      FROM inserted
      ON CONFLICT (user_id)
      DO UPDATE SET
        paid_order_count = user_order_metrics.paid_order_count + 1,
        updated_at = now()
      RETURNING paid_order_count::int AS count
    `;

    try {
      const result = await this.dataSource.query(query, [orderId, userId]);
      if (!Array.isArray(result) || result.length === 0) {
        this.logger.debug(
          `[${correlationId}] Paid order event already processed for order ${orderId}, skipping metrics increment`,
        );
        return { processed: false };
      }

      const paidOrderCount = parseInt(String(result[0]?.count ?? "0"), 10);
      this.logger.log(
        `[${correlationId}] Updated paid order metrics for user ${userId} via order ${orderId}, count=${paidOrderCount}`,
      );
      return {
        processed: true,
        paid_order_count: paidOrderCount,
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to record paid order event for order ${orderId}, user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        "Failed to record paid order metrics event",
      );
    }
  }

  private async countPaidOrdersFromOrdersTable(
    userId: number,
    correlationId: string,
  ): Promise<number> {
    // Fallback path to keep eligibility correct while metrics model is warming up.
    // Uses payment_status column (not order.status) since 'paid' is only a payment_status value.
    // Excludes cancelled/refunded orders to stay consistent with metricEligibleStatuses in OrderService.
    const query = `
      SELECT COUNT(*)::int as count
      FROM "order"
      WHERE "userId" = $1
      AND payment_status = 'paid'
      AND status NOT IN ('cancelled', 'refunded')
    `;

    try {
      const result = await this.dataSource.query(query, [userId]);
      return parseInt(result[0]?.count || "0", 10);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error counting paid orders for user ${userId}: ${error.message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        "Failed to determine order eligibility for coupon validation",
      );
    }
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
      delivery_fee: dto.delivery_fee,
      pincode: dto.pincode,
      store_id: dto.store_id,
      item_ids: dto.item_ids,
      eligible_item_subtotal: dto.eligible_item_subtotal,
      referral_code: dto.referral_code,
      referrer_user_id: dto.referrer_user_id,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const configValidation = this.validateCouponConfiguration(coupon);
    if (!configValidation.valid) {
      throw new BadRequestException(configValidation.message);
    }

    const reservation = await this.createReservation(coupon, {
      code: dto.code,
      user_id: dto.user_id,
      cart_total: dto.cart_total,
      delivery_fee: dto.delivery_fee,
      pincode: dto.pincode,
      store_id: dto.store_id,
      item_ids: dto.item_ids,
      eligible_item_subtotal: validation.eligible_item_subtotal,
      referral_code: dto.referral_code,
      referrer_user_id: dto.referrer_user_id,
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
    correlationId: string = this.createCorrelationId("coupon-reservation"),
  ): Promise<{
    success: boolean;
    token?: string;
    ttl?: number;
    reason?: string;
  }> {
    const reservationToken = uuidv4();
    const ttlRaw = this.configService.get<string>("COUPON_RESERVATION_TTL");
    const ttl = ttlRaw ? Number(ttlRaw) || 900 : 900; // default: 15 minutes

    const metadata = {
      coupon_id: coupon.id,
      user_id: dto.user_id,
      cart_total: dto.cart_total,
      delivery_fee: dto.delivery_fee,
      pincode: dto.pincode,
      store_id: dto.store_id,
      item_ids: dto.item_ids,
      eligible_item_subtotal: dto.eligible_item_subtotal,
      referral_code: (dto as any).referral_code,
      referrer_user_id: (dto as any).referrer_user_id,
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

    try {
      await this.redemptionRepository.save(redemption);
    } catch (error) {
      // Compensate Redis reservation when DB persistence fails.
      try {
        await this.redisCouponService.releaseReservation(
          coupon.id,
          reservationToken,
        );
      } catch (releaseError) {
        this.logger.warn(
          `[${correlationId}] Failed to compensate reservation ${reservationToken} after DB save error: ${releaseError.message}`,
        );
      }

      this.logger.error(
        `[${correlationId}] Failed to persist reservation record for coupon ${coupon.code}: ${error.message}`,
      );
      return {
        success: false,
        reason: "RESERVATION_PERSIST_FAILED",
      };
    }

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
    const correlationId = this.createCorrelationId("coupon-redeem");
    const resolvedIdempotencyKey = this.resolveRedemptionIdempotencyKey(dto);

    // Check idempotency first so duplicate callbacks succeed even after reservation key is gone.
    const existing = await this.redemptionRepository.findOne({
      where: { idempotency_key: resolvedIdempotencyKey },
    });

    if (existing && existing.status === RedemptionStatus.REDEEMED) {
      return {
        success: true,
        discount_amount: existing.amount_applied || 0,
        delivery_waived: existing.delivery_waived,
      };
    }

    // Fallback idempotency path: if this reservation token was already redeemed,
    // return success even when Redis key has expired or was deleted.
    const existingByToken = await this.redemptionRepository.findOne({
      where: { reserved_token: dto.reservation_token },
    });
    if (existingByToken && existingByToken.status === RedemptionStatus.REDEEMED) {
      return {
        success: true,
        discount_amount: existingByToken.amount_applied || 0,
        delivery_waived: existingByToken.delivery_waived,
      };
    }

    // Get reservation
    const reservation = await this.redisCouponService.getReservation(
      dto.reservation_token,
    );

    if (!reservation) {
      if (existingByToken && existingByToken.status === RedemptionStatus.RESERVED) {
        return this.redeemWithoutActiveRedisReservation(
          dto,
          existingByToken,
          resolvedIdempotencyKey,
          correlationId,
        );
      }

      throw new NotFoundException("Reservation not found or expired");
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
      reservation.eligible_item_subtotal,
      reservation.delivery_fee,
    );

    // Use transaction for atomic operations
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update redemption record
      const redemption = await queryRunner.manager.findOne(CouponRedemption, {
        where: { reserved_token: dto.reservation_token },
      });

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
      redemption.idempotency_key = resolvedIdempotencyKey;

      await queryRunner.manager.save(redemption);

      // If single-use, update coupon status
      if (coupon.global_usage_limit === 1) {
        coupon.status = CouponStatus.REVOKED;
        await queryRunner.manager.save(coupon);
      }

      await queryRunner.commitTransaction();

      // Delete reservation from Redis
      await this.redisCouponService.deleteReservation(dto.reservation_token);

      this.logger.log(
        `[${correlationId}] Redeemed coupon ${coupon.code} for order ${dto.order_id} (user: ${dto.user_id}, discount: ₹${discountResult.discount_amount}, delivery_waived: ${discountResult.delivery_waived})`,
      );

      return {
        success: true,
        discount_amount: discountResult.discount_amount,
        delivery_waived: discountResult.delivery_waived,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.logger.error(
        `[${correlationId}] Error redeeming coupon for order ${dto.order_id} (token: ${dto.reservation_token}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException("Failed to redeem coupon");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Finalize redemption when Redis reservation expired but DB redemption row exists.
   * This keeps webhook/COD retries idempotent and prevents long-lived RESERVED rows.
   */
  private async redeemWithoutActiveRedisReservation(
    dto: RedeemCouponDto,
    redemptionRow: CouponRedemption,
    resolvedIdempotencyKey: string,
    correlationId: string,
  ): Promise<{ success: boolean; discount_amount?: number; delivery_waived?: boolean }> {
    if (dto.payment_status !== PaymentStatus.PAID) {
      throw new BadRequestException(
        "Coupon can only be redeemed on successful payment",
      );
    }

    const orderSnapshot = await this.dataSource.query(
      `
      SELECT id, user_id, discount_amount, delivery_fee
      FROM "order"
      WHERE id = $1
      LIMIT 1
      `,
      [dto.order_id],
    );

    const orderRow = Array.isArray(orderSnapshot) ? orderSnapshot[0] : null;

    if (!orderRow) {
      throw new NotFoundException("Order not found for coupon redemption");
    }

    const orderUserId = Number(orderRow.user_id);
    if (orderUserId !== Number(dto.user_id)) {
      throw new BadRequestException("Order does not belong to user");
    }

    const coupon = await this.couponRepository.findOne({
      where: { id: redemptionRow.coupon_id },
    });

    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    const orderDiscountAmount = Number(orderRow.discount_amount || 0);
    const resolvedDiscount =
      redemptionRow.amount_applied != null
        ? Number(redemptionRow.amount_applied)
        : Math.max(0, orderDiscountAmount);

    const resolvedDeliveryWaived =
      redemptionRow.delivery_waived === true ||
      coupon.type === CouponType.FREE_DELIVERY ||
      coupon.type_meta?.free_delivery === true;

    const updateResult = await this.redemptionRepository.update(
      {
        id: redemptionRow.id,
        status: RedemptionStatus.RESERVED,
      },
      {
        status: RedemptionStatus.REDEEMED,
        order_id: dto.order_id,
        user_id: dto.user_id,
        amount_applied: resolvedDiscount,
        delivery_waived: resolvedDeliveryWaived,
        idempotency_key: resolvedIdempotencyKey,
      },
    );

    if ((updateResult.affected || 0) === 0) {
      const latest = await this.redemptionRepository.findOne({
        where: { id: redemptionRow.id },
      });

      if (latest?.status === RedemptionStatus.REDEEMED) {
        return {
          success: true,
          discount_amount: Number(latest.amount_applied || 0),
          delivery_waived: latest.delivery_waived,
        };
      }

      throw new InternalServerErrorException("Failed to redeem coupon");
    }

    this.logger.log(
      `[${correlationId}] Redeemed coupon via DB fallback for token ${dto.reservation_token} and order ${dto.order_id} after Redis reservation expiry`,
    );

    return {
      success: true,
      discount_amount: resolvedDiscount,
      delivery_waived: resolvedDeliveryWaived,
    };
  }

  private async enrichPercentCouponTypeMeta(
    typeMeta?: Record<string, any>,
  ): Promise<Record<string, any>> {
    if (!typeMeta) {
      return {};
    }

    const enrichedMeta = { ...typeMeta };

    if (typeof enrichedMeta.store_reference_id === "string") {
      const store = await this.storeRepository.findOne({
        where: { reference_id: enrichedMeta.store_reference_id.trim() },
      });

      if (!store) {
        throw new BadRequestException(
          `Store with reference_id ${enrichedMeta.store_reference_id} not found`,
        );
      }

      enrichedMeta.internal_store_id = Number(store.id);
    }

    if (
      Array.isArray(enrichedMeta.item_reference_ids) &&
      enrichedMeta.item_reference_ids.length > 0
    ) {
      const itemWhere: any = {
        reference_id: In(enrichedMeta.item_reference_ids),
      };

      if (enrichedMeta.internal_store_id) {
        itemWhere.store = { id: enrichedMeta.internal_store_id };
      }

      const items = await this.itemRepository.find({
        where: itemWhere,
        relations: ["store"],
      });

      if (items.length !== enrichedMeta.item_reference_ids.length) {
        throw new BadRequestException(
          "One or more item_reference_ids could not be resolved for this store",
        );
      }

      enrichedMeta.internal_item_ids = items.map((item) => Number(item.id));
    }

    return enrichedMeta;
  }

  /**
   * Flat and percent coupons have identical type-meta enrichment logic:
   * - Both resolve store_reference_id to internal_store_id
   * - Both resolve item_reference_ids to internal_item_ids
   * - Both require store_reference_id when item_reference_ids is provided
   * INTENTIONAL DELEGATION: We reuse percent enrichment for flat coupons.
   */
  private async enrichFlatCouponTypeMeta(
    typeMeta?: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.enrichPercentCouponTypeMeta(typeMeta);
  }

  private async enrichFreeDeliveryCouponTypeMeta(
    typeMeta?: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.enrichPercentCouponTypeMeta(typeMeta);
  }

  private async validatePercentCouponScope(
    coupon: Coupon,
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
    eligible_item_subtotal?: number;
  }> {
    const typeMeta = coupon.type_meta || {};
    const hasStoreScope =
      typeof typeMeta.store_reference_id === "string" ||
      typeMeta.internal_store_id !== undefined;
    const hasProductScope =
      (Array.isArray(typeMeta.internal_item_ids) &&
        typeMeta.internal_item_ids.length > 0) ||
      (Array.isArray(typeMeta.item_reference_ids) &&
        typeMeta.item_reference_ids.length > 0);

    if (!hasStoreScope && !hasProductScope) {
      return { valid: true };
    }

    if (hasProductScope && !hasStoreScope) {
      return {
        valid: false,
        reason_code: "INVALID_COUPON_CONFIG",
        message: "Invalid coupon configuration",
      };
    }

    let scopedStoreId: number | undefined;
    if (hasStoreScope) {
      scopedStoreId = await this.resolveCouponStoreId(typeMeta);
      if (!dto.store_id) {
        return {
          valid: false,
          reason_code: "STORE_REQUIRED",
          message: "Store ID is required for this coupon",
        };
      }

      if (Number(dto.store_id) !== scopedStoreId) {
        return {
          valid: false,
          reason_code: "INVALID_STORE",
          message: "Coupon not valid for this store",
        };
      }
    }

    if (!hasProductScope) {
      return { valid: true };
    }

    const internalItemIds = await this.resolveCouponItemIds(
      typeMeta,
      scopedStoreId,
    );
    const serverCartContext = await this.resolveServerCartItemContext(
      dto,
      internalItemIds,
      scopedStoreId,
    );

    if (!serverCartContext) {
      return {
        valid: false,
        reason_code: "CART_CONTEXT_REQUIRED",
        message: "Server cart context is required for this coupon",
      };
    }

    const requestItemIds = serverCartContext.item_ids;

    const eligibleSet = new Set(internalItemIds.map((value) => Number(value)));
    const hasEligibleItem = requestItemIds.some((value) =>
      eligibleSet.has(Number(value)),
    );

    if (!hasEligibleItem) {
      return {
        valid: false,
        reason_code: "INVALID_ITEM",
        message: "Coupon not valid for the selected products",
      };
    }

    const eligibleItemSubtotal = serverCartContext.eligible_item_subtotal;

    if (!eligibleItemSubtotal || eligibleItemSubtotal <= 0) {
      return {
        valid: false,
        reason_code: "ELIGIBLE_SUBTOTAL_REQUIRED",
        message:
          "Eligible item subtotal could not be derived for product-scoped coupon",
      };
    }

    return {
      valid: true,
      eligible_item_subtotal: Number(eligibleItemSubtotal),
    };
  }

  /**
   * Flat and percent coupons have identical scope validation logic:
   * - Both support no scope restrictions (global coupon)
   * - Both support store-wide scope via store_reference_id or internal_store_id
   * - Both support product-scoped restrictions via item_reference_ids or internal_item_ids
   * - Both require store_reference_id/internal_store_id when product scope is used
   * - Both derive eligible_item_subtotal for product-scoped discount calculation
   * INTENTIONAL DELEGATION: We reuse percent scope validation for flat coupons.
   */
  private async validateFlatCouponScope(
    coupon: Coupon,
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
    eligible_item_subtotal?: number;
  }> {
    return this.validatePercentCouponScope(coupon, dto);
  }

  private async validateFreeDeliveryCouponScope(
    coupon: Coupon,
    dto: ValidateCouponDto | ReserveCouponDto,
  ): Promise<{
    valid: boolean;
    reason_code?: string;
    message?: string;
    eligible_item_subtotal?: number;
  }> {
    return this.validatePercentCouponScope(coupon, dto);
  }

  private async resolveServerCartItemContext(
    dto: ValidateCouponDto | ReserveCouponDto,
    eligibleItemIds: number[],
    scopedStoreId?: number,
  ): Promise<{
    item_ids: number[];
    eligible_item_subtotal: number;
  } | null> {
    if (!dto.user_id) {
      return null;
    }

    const cartWhere: any = {
      user: { id: dto.user_id },
      is_active: true,
    };

    const targetStoreId = scopedStoreId ?? dto.store_id;
    if (targetStoreId) {
      cartWhere.store = { id: targetStoreId };
    }

    const cart = await this.cartRepository.findOne({
      where: cartWhere,
    });

    if (!cart) {
      return null;
    }

    const cartItems = await this.cartItemRepository.find({
      where: { cart: { id: cart.id } },
      relations: ["item"],
    });

    if (!cartItems.length) {
      return null;
    }

    const itemIds = cartItems
      .map((cartItem) => Number(cartItem.item?.id))
      .filter((itemId) => Number.isFinite(itemId) && itemId > 0);

    const requestedItemIds = Array.isArray(dto.item_ids)
      ? new Set(dto.item_ids.map((itemId) => Number(itemId)))
      : null;
    const eligibleItemSet = new Set(
      eligibleItemIds.map((itemId) => Number(itemId)),
    );

    const eligibleSubtotal = cartItems.reduce((sum, cartItem) => {
      const itemId = Number(cartItem.item?.id);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        return sum;
      }

      if (requestedItemIds && !requestedItemIds.has(itemId)) {
        return sum;
      }

      if (!eligibleItemSet.has(itemId)) {
        return sum;
      }

      return sum + Number(cartItem.total_price || 0);
    }, 0);

    return {
      item_ids: itemIds,
      eligible_item_subtotal: Number(eligibleSubtotal.toFixed(2)),
    };
  }

  private async resolveCouponStoreId(
    typeMeta: Record<string, any>,
  ): Promise<number> {
    if (
      typeMeta.internal_store_id !== undefined &&
      typeMeta.internal_store_id !== null
    ) {
      return Number(typeMeta.internal_store_id);
    }

    if (typeof typeMeta.store_reference_id !== "string") {
      throw new BadRequestException("Invalid coupon configuration");
    }

    const store = await this.storeRepository.findOne({
      where: { reference_id: typeMeta.store_reference_id.trim() },
    });

    if (!store) {
      throw new BadRequestException("Invalid coupon configuration");
    }

    return Number(store.id);
  }

  private async resolveCouponItemIds(
    typeMeta: Record<string, any>,
    storeId?: number,
  ): Promise<number[]> {
    if (
      Array.isArray(typeMeta.internal_item_ids) &&
      typeMeta.internal_item_ids.length > 0
    ) {
      return typeMeta.internal_item_ids.map((value: number) => Number(value));
    }

    if (
      !Array.isArray(typeMeta.item_reference_ids) ||
      typeMeta.item_reference_ids.length === 0
    ) {
      return [];
    }

    const where: any = {
      reference_id: In(typeMeta.item_reference_ids),
    };

    if (storeId) {
      where.store = { id: storeId };
    }

    const items = await this.itemRepository.find({
      where,
      relations: ["store"],
    });

    return (items || []).map((item) => Number(item.id));
  }

  /**
   * Rollback reservation
   */
  async rollbackCoupon(
    dto: RollbackCouponDto,
    correlationId: string = this.createCorrelationId("coupon-rollback"),
  ): Promise<{ success: boolean }> {
    // Try to get reservation metadata from Redis (may have expired)
    const reservation = await this.redisCouponService.getReservation(
      dto.reservation_token,
    );

    // Update redemption status (DB is the source of truth even if Redis expired)
    const redemption = await this.redemptionRepository.findOne({
      where: { reserved_token: dto.reservation_token },
    });

    if (!reservation && !redemption) {
      throw new NotFoundException(
        "Reservation not found or already rolled back",
      );
    }

    // If already redeemed, treat rollback as a no-op (idempotent)
    if (redemption && redemption.status === RedemptionStatus.REDEEMED) {
      this.logger.log(
        `[${correlationId}] Rollback requested for already redeemed reservation ${dto.reservation_token}, skipping (idempotent).`,
      );
      return { success: true };
    }

    // Idempotent guard: never restore quota more than once for the same token.
    if (redemption && redemption.status === RedemptionStatus.ROLLED_BACK) {
      this.logger.log(
        `[${correlationId}] Rollback requested for already rolled back reservation ${dto.reservation_token}, skipping quota restore (idempotent).`,
      );

      // Best-effort Redis cleanup only; do not touch quota.
      await this.redisCouponService.deleteReservation(dto.reservation_token);
      return { success: true };
    }

    // Determine coupon_id for quota restoration
    const couponId = reservation?.coupon_id ?? redemption?.coupon_id;

    // Redis reservation can outlive/miss DB record under partial failures.
    // In that case, release directly from Redis to avoid quota leak.
    if (!redemption && couponId) {
      await this.redisCouponService.releaseReservation(
        couponId,
        dto.reservation_token,
      );
      this.logger.log(
        `[${correlationId}] Rolled back Redis-only reservation ${dto.reservation_token} (coupon_id: ${couponId}, reason: ${dto.reason || "unspecified"})`,
      );
      return { success: true };
    }

    let shouldRestoreQuota = true;

    if (redemption && couponId) {
      const coupon = await this.couponRepository.findOne({
        where: { id: Number(couponId) },
        select: ["id", "type"],
      });

      if (
        coupon &&
        (coupon.type === CouponType.PREORDER ||
          coupon.type === CouponType.NTH_ORDER) &&
        redemption.order_id != null
      ) {
        // Keep usage consumed for placed orders even if later cancelled.
        shouldRestoreQuota = false;
        this.logger.log(
          `[${correlationId}] Skipping quota restore for ${coupon.type} reservation ${dto.reservation_token} linked to order ${redemption.order_id}`,
        );
      }
    }

    let transitionedToRolledBack = false;

    if (redemption) {
      const updateResult = await this.redemptionRepository.update(
        {
          id: redemption.id,
          status: RedemptionStatus.RESERVED,
        },
        {
          status: RedemptionStatus.ROLLED_BACK,
        },
      );

      transitionedToRolledBack = (updateResult.affected || 0) > 0;

      if (!transitionedToRolledBack) {
        const latest = await this.redemptionRepository.findOne({
          where: { id: redemption.id },
        });

        if (latest?.status === RedemptionStatus.ROLLED_BACK) {
          this.logger.log(
            `[${correlationId}] Rollback race detected for ${dto.reservation_token}; another worker already rolled it back.`,
          );
          await this.redisCouponService.deleteReservation(dto.reservation_token);
          return { success: true };
        }

        if (latest?.status === RedemptionStatus.REDEEMED) {
          this.logger.log(
            `[${correlationId}] Rollback race detected for ${dto.reservation_token}; redemption already finalized.`,
          );
          return { success: true };
        }

        throw new BadRequestException(
          "Unable to rollback coupon reservation due to state transition conflict",
        );
      }
    }

    if (redemption && !shouldRestoreQuota) {
      await this.redisCouponService.deleteReservation(dto.reservation_token);
    }

    if (couponId && shouldRestoreQuota && transitionedToRolledBack) {
      // releaseReservation always restores quota even if the Redis key has already expired.
      await this.redisCouponService.releaseReservation(
        couponId,
        dto.reservation_token,
      );
    }

    this.logger.log(
      `[${correlationId}] Rolled back reservation ${dto.reservation_token} (coupon_id: ${couponId}, reason: ${dto.reason || "unspecified"})`,
    );

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
    const correlationId = this.createCorrelationId("coupon-cron");
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let skippedNoToken = 0;

    try {
      this.logger.log(
        `[${correlationId}] ⏰ Running autoRollbackStaleReservations cron to check for stale coupon reservations`,
      );
      const ttlRaw = this.configService.get<string>("COUPON_RESERVATION_TTL");
      const ttlSeconds = ttlRaw ? Number(ttlRaw) || 900 : 900;
      // Add a small safety buffer so we only touch clearly expired reservations
      const bufferSeconds = 60;
      const cutoff = new Date(Date.now() - (ttlSeconds + bufferSeconds) * 1000);

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
        `[${correlationId}] 🧹 Auto-rollback: found ${staleRedemptions.length} stale reservations older than TTL`,
      );

      for (const redemption of staleRedemptions) {
        if (!redemption.reserved_token) {
          skippedNoToken += 1;
          continue;
        }
        attempted += 1;
        try {
          await this.rollbackCoupon({
            reservation_token: redemption.reserved_token,
            reason: "Auto-rollback after TTL expiry",
          }, correlationId);
          succeeded += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `[${correlationId}] ⚠️ Failed auto-rollback for reservation ${redemption.reserved_token}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `[${correlationId}] Auto-rollback summary attempted=${attempted}, succeeded=${succeeded}, failed=${failed}, skipped_no_token=${skippedNoToken}`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] ❌ Error during auto-rollback of stale reservations: ${error.message}`,
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
    // Use coupon_redemptions as source of truth for redeemed_count so quota API
    // is never out of sync with actual redemption rows (coupon_counters can drift).
    const redeemedCount = await this.redemptionRepository.count({
      where: {
        coupon_id: couponId,
        status: RedemptionStatus.REDEEMED,
      },
    });
    const globalLimit =
      coupon.global_usage_limit != null
        ? Number(coupon.global_usage_limit)
        : null;
    const effectiveRemaining =
      globalLimit != null
        ? Math.max(0, globalLimit - redeemedCount)
        : (currentQuota ?? 0);
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
