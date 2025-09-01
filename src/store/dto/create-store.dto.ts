import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateStoreDto {
  @IsNotEmpty()
  @IsString()
  reference_id: string;

  @IsNotEmpty()
  @IsString()
  bpp_id: string;

  @IsNotEmpty()
  @IsString()
  bpp_uri: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  fssai_license_no?: string;

  @IsOptional()
  @IsString()
  ttl?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
