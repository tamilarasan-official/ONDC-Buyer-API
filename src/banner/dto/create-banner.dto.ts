import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BannerSessionDto {
  @ApiProperty({ description: "Start day (1=Mon ... 7=Sun)", example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  day_from: number;

  @ApiProperty({ description: "End day (1=Mon ... 7=Sun)", example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  day_to: number;

  @ApiProperty({ description: "Start time in HHMM format", example: 900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2359)
  start_hhmm: number;

  @ApiProperty({ description: "End time in HHMM format", example: 2200 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2359)
  end_hhmm: number;

  @ApiPropertyOptional({ description: "Optional session label", example: "Prime Time" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ description: "Session status", example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  status?: boolean;
}

export class CreateBannerDto {
  @ApiProperty({
    description: "Banner title",
    example: "Craving Something Delicious?",
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: "Banner subtitle",
    example:
      "Get your favorite meals delivered hot & fast—right to your doorstep.",
    required: false,
  })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({
    description: "Call-to-action button text",
    example: "Order Now!",
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_button?: string;

  @ApiProperty({
    description: "Background color in hex format",
    example: "#14b8a6",
    required: false,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  background_color?: string;

  @ApiProperty({
    description:
      "Promotion type - defines what happens when user clicks the banner: restaurant_id (navigates to restaurant detail page), category_id (navigates to category page), collection_id (navigates to collection page), url (opens external URL), organization (links to organization page)",
    example: "restaurant_id",
    enum: ["restaurant_id", "category_id", "collection_id", "url", "organization"],
    required: false,
  })
  @IsOptional()
  @IsIn(["restaurant_id", "category_id", "collection_id", "url", "organization"])
  promotion_type?: string;

  @ApiProperty({
    description:
      'Promotion link value - must correspond to promotion_type: numeric ID for restaurant_id/category_id, or full URL for url type (e.g., "123" for restaurant, "https://example.com" for url)',
    example: "1",
    required: false,
  })
  @IsOptional()
  @IsString()
  promotion_link?: string;

  @ApiProperty({
    description: "Status of the banner (active/inactive)",
    example: true,
    required: false,
    default: true,
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({
    description: "Enable schedule for banner visibility",
    example: false,
    default: false,
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsOptional()
  @IsBoolean()
  schedule_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      "Banner visibility sessions. Can be passed as JSON string in multipart requests.",
    type: [BannerSessionDto],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerSessionDto)
  sessions?: BannerSessionDto[];
}
