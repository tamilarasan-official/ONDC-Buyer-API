import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class GenerateOtpDto {
  @ApiProperty({
    description: 'Phone number for OTP generation',
    example: 9876543210,
    type: 'number',
    minimum: 1000000000,
    maximum: 9999999999
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  phone_number: number;
}