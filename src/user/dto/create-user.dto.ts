import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, IsEmail } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john@example.com',
    required: false
  })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: 9876543210,
    type: 'number',
    minimum: 1000000000,
    maximum: 9999999999
  })
  @IsNumber()
  @Type(() => Number)
  phone_number: number;

  @ApiProperty({
    description: 'User account status',
    example: true,
    required: false,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

export class CreateAddressDto {
  @ApiProperty({
    description: 'Primary address line',
    example: '123 Main Street'
  })
  @IsString()
  address1: string;

  @ApiProperty({
    description: 'Secondary address line (apartment, building, etc.)',
    example: 'Apartment 4B',
    required: false
  })
  @IsOptional()
  @IsString()
  address2?: string;

  @ApiProperty({
    description: 'Additional address information (landmark, etc.)',
    example: 'Near City Mall',
    required: false
  })
  @IsOptional()
  @IsString()
  address3?: string;

  @ApiProperty({
    description: 'City name',
    example: 'Bangalore'
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'State name',
    example: 'Karnataka'
  })
  @IsString()
  state: string;

  @ApiProperty({
    description: 'PIN code',
    example: '560001'
  })
  @IsString()
  pincode: string;

  @ApiProperty({
    description: 'Latitude coordinate',
    example: 12.9716,
    type: 'number'
  })
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 77.5946,
    type: 'number'
  })
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiProperty({
    description: 'Address type',
    example: 'home',
    enum: ['home', 'office', 'other']
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Alternate phone number for delivery',
    example: 9876543211,
    type: 'number',
    required: false,
    minimum: 1000000000,
    maximum: 9999999999
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  alternate_phone_number?: number;

  @ApiProperty({
    description: 'Set as default address',
    example: false,
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
