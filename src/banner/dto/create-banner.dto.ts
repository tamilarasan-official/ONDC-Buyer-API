import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

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
      "Promotion type - defines what happens when user clicks the banner: restaurant_id (navigates to restaurant detail page), category_id (navigates to category page), url (opens external URL), organization (links to organization page)",
    example: "restaurant_id",
    enum: ["restaurant_id", "category_id", "url", "organization"],
    required: false,
  })
  @IsOptional()
  @IsIn(["restaurant_id", "category_id", "url", "organization"])
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
}
