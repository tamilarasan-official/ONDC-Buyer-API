import { Type } from 'class-transformer';
import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Phone number for authentication',
    example: 9876543210,
    type: 'number',
    minimum: 1000000000,
    maximum: 9999999999
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  phone_number: number;

  @ApiProperty({
    description: 'One-time password (OTP) received via SMS',
    example: 123456,
    type: 'number',
    minimum: 100000,
    maximum: 999999
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  otp: number;
}