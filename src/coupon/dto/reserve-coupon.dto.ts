import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class ReserveCouponDto {
  @ApiProperty({
    description: "Coupon code",
    example: "SUMMER2025",
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: "User ID",
    example: 123,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  user_id: number;

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
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  store_id: number;

  @ApiProperty({
    description: "Client IP address (for rate limiting)",
    example: "192.168.1.1",
    required: false,
  })
  @IsOptional()
  @IsString()
  ip?: string;
}


