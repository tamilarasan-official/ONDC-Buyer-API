import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum } from "class-validator";
import { CampaignStatus } from "../entities/coupon-campaign.entity";

export class UpdateCampaignDto {
  @ApiProperty({
    description: "Campaign title",
    example: "Summer 2025 Sale - Updated",
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: "Campaign description",
    example: "Updated summer sale campaign",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Campaign status",
    enum: CampaignStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}


