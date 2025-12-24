import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class OrderCancelDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  order_id: number;

  @ApiProperty({ example: '004' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Store is not accepting order' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'buyer', enum: ['buyer', 'seller', 'system'] })
  @IsString()
  cancelled_by: 'buyer' | 'seller' | 'system';
}
