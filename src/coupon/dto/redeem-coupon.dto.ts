import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";

export enum PaymentStatus {
  PAID = "paid",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export class RedeemCouponDto {
  @ApiProperty({
    description: "Reservation token from validate/reserve",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsNotEmpty()
  @IsUUID()
  reservation_token: string;

  @ApiProperty({
    description: "Order ID",
    example: 12345,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: "User ID",
    example: 123,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  user_id: number;

  @ApiProperty({
    description: "Payment status",
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsNotEmpty()
  @IsEnum(PaymentStatus)
  payment_status: PaymentStatus;

  @ApiProperty({
    description: "Idempotency key to prevent duplicate redemptions",
    example: "order-12345-payment-abc123",
    required: false,
  })
  // Optional for backward compatibility; service derives a deterministic fallback when omitted.
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}


