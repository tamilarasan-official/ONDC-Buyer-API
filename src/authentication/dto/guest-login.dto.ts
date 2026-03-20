import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class GuestLoginDto {
  @ApiProperty({
    description: "Client platform (e.g., ios, android)",
    example: "ios",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @ApiProperty({
    description: "Device identifier from the app (optional, will be hashed)",
    example: "A1B2C3D4-E5F6-7890-ABCD-1234567890EF",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  device_id?: string;

  @ApiProperty({
    description: "App version string (optional)",
    example: "1.0.0",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  app_version?: string;

  @ApiProperty({
    description:
      "Long-lived guest identity token (opaque). Send it to keep the same guest identity for analytics across app restarts.",
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (opaque token - treat as string)",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  identity_token?: string;
}

