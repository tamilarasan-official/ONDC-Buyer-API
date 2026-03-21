import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsArray,
  Length,
  Matches,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";

export class ValidateCouponDto {
  @ApiProperty({
    description: "Coupon code",
    example: "SUMMER2025",
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: "User ID (optional for guest checkout)",
    example: 123,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  user_id?: number;

  @ApiProperty({
    description: "Cart total amount",
    example: 1000.0,
    minimum: 0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cart_total: number;

  @ApiProperty({
    description: "Delivery pincode",
    example: "600001",
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pincode: string;

  @ApiProperty({
    description: "Store ID",
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  store_id?: number;

  @ApiProperty({
    description: "Payment method",
    example: "online",
    required: false,
  })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiProperty({
    description: "Client IP address (for rate limiting)",
    example: "192.168.1.1",
    required: false,
  })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiProperty({
    description: "Reserve coupon immediately if valid",
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reserve?: boolean;

  @ApiProperty({
    description:
      "Optional item IDs present in the cart. Required for product-scoped percent coupon validation.",
    example: [101, 102],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  item_ids?: number[];

  @ApiProperty({
    description:
      "Optional eligible subtotal for matching products. Should be computed server-side by cart/order flow.",
    example: 450,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eligible_item_subtotal?: number;

  @ApiProperty({
    description:
      "Referral code context. Required when validating referral coupon type.",
    example: "REF123",
    required: false,
  })
  @IsOptional()
  @IsString()
  referral_code?: string;

  @ApiProperty({
    description:
      "Referrer user ID context. Required when validating referral coupon type.",
    example: 456,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  referrer_user_id?: number;

  // Internal server-side use only — not exposed via HTTP or Swagger.
  // Passed by cart.service.ts for free_delivery coupon discount calculation.
  delivery_fee?: number;
}


