import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class LoginDto {
  @IsNumber()
  @Type(() => Number)
  phone_number: number;

  @IsNumber()
  @Type(() => Number)
  otp: number;
}