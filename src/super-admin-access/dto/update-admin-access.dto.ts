import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAdminAccessDto {
  @ApiPropertyOptional({ example: 'Admin Access Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: { scope: 'billing' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
