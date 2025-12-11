import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class IncrementQuotaDto {
  @ApiProperty({
    description: "Amount to increment quota by",
    example: 10,
    minimum: 1,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;
}

export class ResetQuotaDto {
  @ApiProperty({
    description: "New quota value to set",
    example: 100,
    minimum: 0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quota: number;
}

