import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsDateString,
  IsBoolean,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CouponType,
  ValueType,
  CouponStatus,
} from "../entities/coupon.entity";

export class GenerateCodesDto {
  @ApiProperty({
    description: "Number of codes to generate",
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10000)
  count: number;

  @ApiProperty({
    description: "Code prefix (optional)",
    example: "SUMMER",
    required: false,
  })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiProperty({
    description: "Code length (excluding prefix)",
    example: 8,
    minimum: 6,
    maximum: 16,
    default: 8,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(6)
  @Max(16)
  length?: number;

  @ApiProperty({
    description: "Coupon type",
    enum: CouponType,
    example: CouponType.PERCENT,
  })
  @IsNotEmpty()
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({
    description: "Discount value (rupees or percent)",
    example: 20,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({
    description: "Value type",
    enum: ValueType,
    example: ValueType.PERCENT,
  })
  @IsNotEmpty()
  @IsEnum(ValueType)
  value_type: ValueType;

  @ApiProperty({
    description: "Maximum discount amount (required for percent type)",
    example: 500,
    required: false,
  })
  @ValidateIf((o) => o.value_type === ValueType.PERCENT)
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_discount_amount?: number;

  @ApiProperty({
    description: "Minimum cart value",
    example: 500,
    default: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_cart_value?: number;

  @ApiProperty({
    description: "Expiration date (ISO 8601)",
    example: "2025-12-31T23:59:59Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiProperty({
    description: "Start date (ISO 8601)",
    example: "2025-01-01T00:00:00Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  start_at?: string;

  @ApiProperty({
    description: "User usage limit per code",
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  user_usage_limit?: number;

  @ApiProperty({
    description: "Global usage limit (null = unlimited)",
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  global_usage_limit?: number;

  @ApiProperty({
    description: "Preview mode (return first 10 codes only)",
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preview?: boolean;

  @ApiProperty({
    description: "Type-specific metadata (JSON)",
    example: { nth: 3 },
    required: false,
  })
  @IsOptional()
  type_meta?: Record<string, any>;
}


