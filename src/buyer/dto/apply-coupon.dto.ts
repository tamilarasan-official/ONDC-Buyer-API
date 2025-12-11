import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ApplyCouponDto {
  @ApiProperty({
    description: "Coupon code to apply",
    example: "SUMMER2025",
  })
  @IsNotEmpty()
  @IsString()
  coupon_code: string;
}

export class RemoveCouponDto {
  // No fields needed - just remove coupon from cart
}


