import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsEnum } from "class-validator";

export class MarkNotificationReadDto {
  @ApiProperty({
    description: "Notification ID to mark as read",
    example: 1,
    type: "number",
  })
  @IsOptional()
  notification_id?: number;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: "Enable/disable order update notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  order_updates?: boolean;

  @ApiProperty({
    description: "Enable/disable promotional offer notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  promotional_offers?: boolean;

  @ApiProperty({
    description: "Enable/disable system alert notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  system_alerts?: boolean;

  @ApiProperty({
    description: "Enable/disable review reminder notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  review_reminders?: boolean;

  @ApiProperty({
    description: "Enable/disable push notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  push_notifications?: boolean;

  @ApiProperty({
    description: "Enable/disable email notifications",
    example: true,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @ApiProperty({
    description: "Enable/disable SMS notifications",
    example: false,
    type: "boolean",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sms_notifications?: boolean;
}

export class RegisterDeviceTokenDto {
  @ApiProperty({
    description: "Device token for push notifications",
    example: "fcm_token_here_123456789",
    required: true,
  })
  @IsString()
  device_token: string;

  @ApiProperty({
    description: "Device platform",
    example: "android",
    enum: ["android", "ios", "web"],
    required: true,
  })
  @IsEnum(["android", "ios", "web"])
  platform: "android" | "ios" | "web";
}

export class UnregisterDeviceTokenDto {
  @ApiProperty({
    description: "Device token to unregister",
    example: "fcm_token_here_123456789",
    required: true,
  })
  @IsString()
  device_token: string;
}
