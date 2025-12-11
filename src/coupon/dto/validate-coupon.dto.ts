import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
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
}


