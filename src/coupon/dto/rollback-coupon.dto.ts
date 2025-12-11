import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, IsOptional } from "class-validator";

export class RollbackCouponDto {
  @ApiProperty({
    description: "Reservation token to rollback",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsNotEmpty()
  @IsUUID()
  reservation_token: string;

  @ApiProperty({
    description: "Reason for rollback",
    example: "Payment cancelled by user",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}


