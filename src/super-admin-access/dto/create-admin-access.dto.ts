import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAdminAccessDto {
  @ApiProperty({
    example: 'Super Admin',
    description: 'Display name for the admin access',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'super-admin',
    description: 'Unique slug identifier',
  })
  @IsString()
  slug: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether the API key is active',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    example: { scope: 'settings' },
    required: false,
    description: 'Optional metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
