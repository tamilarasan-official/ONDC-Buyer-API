import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from '@nestjs/swagger';

export class CreateBannerDto {
  @ApiProperty({
    description: 'Banner title',
    example: 'Craving Something Delicious?',
    maxLength: 255
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Banner subtitle',
    example: 'Get your favorite meals delivered hot & fast—right to your doorstep.',
    required: false
  })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({
    description: 'Call-to-action button text',
    example: 'Order Now!',
    required: false,
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_button?: string;

  @ApiProperty({
    description: 'Background color in hex format',
    example: '#14b8a6',
    required: false,
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  background_color?: string;

  @ApiProperty({
    description: 'Promotion type (restaurant_id, category_id, or url)',
    example: 'restaurant_id',
    enum: ['restaurant_id', 'category_id', 'url'],
    required: false
  })
  @IsOptional()
  @IsEnum(['restaurant_id', 'category_id', 'url'])
  promotion_type?: string;

  @ApiProperty({
    description: 'Promotion link (URL or ID based on promotion_type)',
    example: '1',
    required: false
  })
  @IsOptional()
  @IsString()
  promotion_link?: string;

  @ApiProperty({
    description: 'Sequence number for ordering (auto-assigned if not provided)',
    example: 1,
    required: false
  })
  @IsOptional()
  @IsInt()
  sequence?: number;

  @ApiProperty({
    description: 'Status of the banner (active/inactive)',
    example: true,
    required: false,
    default: true
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

