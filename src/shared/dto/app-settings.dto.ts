import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateAppSettingDto {
  @ApiProperty({ example: "PLATFORM_FEE" })
  @IsString()
  key: string;

  @ApiProperty({ example: "50" })
  @IsString()
  value: string;

  @ApiProperty({ example: "app_config", required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    example: "Platform fee charged per order",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAppSettingDto {
  @ApiProperty({ example: "50" })
  @IsString()
  value: string;
}

export class BulkCreateAppSettingsDto {
  @ApiProperty({
    type: [CreateAppSettingDto],
    example: [
      {
        key: "PLATFORM_FEE",
        value: "50",
        category: "app_config",
        description: "Platform fee charged per order",
      },
    ],
  })
  settings: CreateAppSettingDto[];
}
