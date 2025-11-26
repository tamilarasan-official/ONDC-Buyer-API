import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
} from "class-validator";
import { CampaignStatus } from "../entities/coupon-campaign.entity";

export class CreateCampaignDto {
  @ApiProperty({
    description: "Unique campaign key (alphanumeric, hyphens, underscores)",
    example: "summer-2025-sale",
    maxLength: 80,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  campaign_key: string;

  @ApiProperty({
    description: "Campaign title",
    example: "Summer 2025 Sale",
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: "Campaign description",
    example: "Summer sale campaign with 20% off",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "User ID or username who created the campaign",
    example: "admin@example.com",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  created_by?: string;

  @ApiProperty({
    description: "Campaign status",
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}


