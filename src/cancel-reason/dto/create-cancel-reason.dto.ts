import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CreateCancelReasonDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_rto: boolean;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_part_cancel: boolean;

  @IsString()
  @IsNotEmpty()
  cancelled_by: string;
}
