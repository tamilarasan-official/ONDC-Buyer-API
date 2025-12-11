import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { CouponService } from "../services/coupon.service";
import { ValidateCouponDto } from "../dto/validate-coupon.dto";
import { ReserveCouponDto } from "../dto/reserve-coupon.dto";
import { RedeemCouponDto } from "../dto/redeem-coupon.dto";
import { RollbackCouponDto } from "../dto/rollback-coupon.dto";
// import { JwtAuthGuard } from "../../authentication/jwt-auth.guard"; // Uncomment when auth is ready
// import { Throttle } from "@nestjs/throttler"; // Uncomment when rate limiting is configured

@ApiTags("Coupons - Public API")
@Controller("coupons")
export class PublicCouponController {
  private readonly logger = new Logger(PublicCouponController.name);

  constructor(private readonly couponService: CouponService) {}

  @Post("validate")
  @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per IP
  @ApiOperation({
    summary: "Validate coupon code",
    description:
      "Validate a coupon code for a cart. Optionally reserve it immediately with reserve=true.",
  })
  @ApiBody({ type: ValidateCouponDto })
  @ApiResponse({
    status: 200,
    description: "Validation result",
    schema: {
      example: {
        valid: true,
        discount_amount: 100,
        delivery_waived: false,
        reservation_token: "550e8400-e29b-41d4-a716-446655440000",
        reservation_ttl: 900,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Validation failed",
    schema: {
      example: {
        valid: false,
        reason_code: "NOT_FOUND",
        message: "Coupon code not found",
      },
    },
  })
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.couponService.validateCoupon(dto);
  }

  @Post("reserve")
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute per IP
  @ApiOperation({
    summary: "Reserve coupon",
    description:
      "Explicitly reserve a coupon code. Creates a reservation token valid for 15 minutes.",
  })
  @ApiBody({ type: ReserveCouponDto })
  @ApiResponse({
    status: 201,
    description: "Coupon reserved successfully",
    schema: {
      example: {
        reservation_token: "550e8400-e29b-41d4-a716-446655440000",
        expires_in_seconds: 900,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed or quota exhausted",
  })
  @ApiResponse({
    status: 404,
    description: "Coupon not found",
  })
  async reserveCoupon(@Body() dto: ReserveCouponDto) {
    return this.couponService.reserveCoupon(dto);
  }

  @Post("redeem")
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard) // Uncomment when auth is ready
  // @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Redeem coupon",
    description:
      "Finalize coupon redemption on payment success. Must be idempotent using idempotency_key.",
  })
  @ApiBody({ type: RedeemCouponDto })
  @ApiResponse({
    status: 200,
    description: "Coupon redeemed successfully",
    schema: {
      example: {
        success: true,
        discount_amount: 100,
        delivery_waived: false,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid payment status or reservation expired",
  })
  @ApiResponse({
    status: 404,
    description: "Reservation not found",
  })
  async redeemCoupon(@Body() dto: RedeemCouponDto) {
    return this.couponService.redeemCoupon(dto);
  }

  @Post("rollback")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rollback coupon reservation",
    description:
      "Cancel a coupon reservation and release quota. Called on payment failure or cancellation.",
  })
  @ApiBody({ type: RollbackCouponDto })
  @ApiResponse({
    status: 200,
    description: "Reservation rolled back successfully",
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Reservation not found",
  })
  async rollbackCoupon(@Body() dto: RollbackCouponDto) {
    return this.couponService.rollbackCoupon(dto);
  }

  @Get(":code/status")
  @ApiOperation({
    summary: "Check coupon status",
    description: "Check if a coupon code is valid (for vendor scanning)",
  })
  @ApiParam({
    name: "code",
    type: String,
    description: "Coupon code",
    example: "SUMMER2025",
  })
  @ApiResponse({
    status: 200,
    description: "Coupon status",
    schema: {
      example: {
        code: "SUMMER2025",
        status: "active",
        valid: true,
        message: "Coupon is valid",
      },
    },
  })
  async getCouponStatus(@Param("code") code: string) {
    return this.couponService.getCouponStatus(code);
  }
}


