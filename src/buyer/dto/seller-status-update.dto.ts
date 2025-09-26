import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SellerStatusUpdateDto {
  @ApiProperty({
    description: 'Order number from our system',
    example: 'ORD-20250102-001',
    type: 'string'
  })
  @IsNotEmpty()
  @IsString()
  order_number: string;

  @ApiProperty({
    description: 'New status from seller',
    example: 'packed',
    type: 'string',
    enum: ['billed', 'packed', 'agent-assigned', 'picked', 'out-of-delivery', 'delivered', 'cancelled']
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Optional message or notes from seller',
    example: 'Order packed and ready for pickup',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Optional delivery agent details',
    example: 'Agent: John Doe, Phone: +91-9876543210',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  agent_details?: string;

  @ApiProperty({
    description: 'Optional estimated delivery time',
    example: '2025-01-02T15:30:00Z',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  estimated_delivery_time?: string;
}
