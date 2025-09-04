import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class CreateDishDto {
  @ApiProperty({
    description: 'Name of the dish',
    example: 'Pizza',
    maxLength: 255
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the dish',
    example: 'Delicious Italian pizza with fresh ingredients',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Icon URL for the dish',
    example: 'https://example.com/pizza-icon.png',
    required: false
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    description: 'Status of the dish (active/inactive)',
    example: true,
    required: false,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
