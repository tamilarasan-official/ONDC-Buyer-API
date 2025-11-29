import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class TestNotificationDto {
  @ApiProperty({
    description: "Custom message for the test notification",
    example: "This is a test push notification",
    required: false,
    default: "This is a test push notification",
  })
  @IsString()
  @IsOptional()
  message?: string;
}

