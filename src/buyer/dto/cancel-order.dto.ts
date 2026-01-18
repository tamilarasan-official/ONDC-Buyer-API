import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class OrderCancelDto {
  @ApiProperty({
    description: 'Order number to cancel (e.g., "ORD-20250117-001")',
    example: 'ORD-20250117-001',
    type: String,
    required: true
  })
  @IsString()
  @IsNotEmpty()
  order_number: string;

  @ApiProperty({
    description: 'Cancel reason code from cancel-reason API (e.g., "100", "101", etc.)',
    example: '100',
    type: String,
    required: true
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Human-readable cancel reason description',
    example: 'Placed duplicate order',
    type: String,
    required: true
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: 'Who is cancelling the order',
    example: 'buyer',
    enum: ['buyer', 'seller', 'system'],
    required: false,
    default: 'buyer'
  })
  @IsString()
  @IsEnum(['buyer', 'seller', 'system'])
  @IsOptional()
  cancelled_by?: 'buyer' | 'seller' | 'system';
}
