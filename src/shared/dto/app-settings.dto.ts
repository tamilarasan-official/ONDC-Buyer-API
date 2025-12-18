import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateAppSettingDto {
  @ApiProperty({
    example: "PLATFORM_FEE",
    description: "Unique key identifier for the setting (must be uppercase with underscores)",
    pattern: "^[A-Z_]+$",
  })
  @IsString()
  key: string;

  @ApiProperty({
    example: "50",
    description: "Setting value (stored as string, can represent numbers, booleans, or text)",
  })
  @IsString()
  value: string;

  @ApiProperty({
    example: "app_config",
    description: "Category grouping (e.g., 'app_config', 'payment', 'support'). Optional but recommended for organization.",
    required: false,
    enum: ["app_config", "payment", "support", "notification"],
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    example: "Platform fee charged per order",
    description: "Human-readable description explaining what the setting controls",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAppSettingDto {
  @ApiProperty({
    example: "75",
    description: "New value for the setting (stored as string, can represent numbers, booleans, or text)",
  })
  @IsString()
  value: string;
}

export class BulkCreateAppSettingsDto {
  @ApiProperty({
    type: [CreateAppSettingDto],
    description: "Array of settings to create or update in bulk",
    example: [
      {
        key: "PLATFORM_FEE",
        value: "50",
        category: "app_config",
        description: "Platform fee charged per order",
      },
      {
        key: "INCLUDE_PLATFORM_FEE",
        value: "true",
        category: "app_config",
        description: "Whether to include platform fee in orders",
      },
    ],
  })
  settings: CreateAppSettingDto[];
}
