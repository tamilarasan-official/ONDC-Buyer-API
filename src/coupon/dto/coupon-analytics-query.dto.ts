import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class CouponAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: "Filter start datetime (ISO)",
    example: "2026-03-01T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: "Filter end datetime (ISO)",
    example: "2026-03-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
