import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsEnum, IsNotEmpty } from "class-validator";

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

  @ApiProperty({
    description: "Unique device identifier (Android: ANDROID_ID, iOS: identifierForVendor)",
    example: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
    required: false,
  })
  @IsOptional()
  @IsString()
  device_id?: string;

  @ApiProperty({
    description: "Application version (e.g., 1.2.3)",
    example: "1.2.3",
    required: false,
  })
  @IsOptional()
  @IsString()
  app_version?: string;
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

export class BroadcastNotificationDto {
  @ApiProperty({
    description: "Notification title",
    example: "Important Announcement",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: "Notification message",
    example: "We have exciting new features available!",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    description: "Notification type",
    example: "promotion",
    enum: ["order", "promotion", "system", "review"],
    required: false,
    default: "system",
  })
  @IsOptional()
  @IsEnum(["order", "promotion", "system", "review"])
  type?: "order" | "promotion" | "system" | "review";

  @ApiProperty({
    description: "Image URL to display in the notification (for rich notifications)",
    example: "https://example.com/images/promotion-banner.jpg",
    required: false,
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiProperty({
    description: "Additional data to include in notification",
    example: { url: "https://example.com/offer" },
    required: false,
  })
  @IsOptional()
  data?: any;
}
