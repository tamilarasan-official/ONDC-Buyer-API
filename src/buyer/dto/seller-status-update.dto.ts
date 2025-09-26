import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentDetailsDto {
  @ApiProperty({
    description: 'Agent name',
    example: 'John Doe',
    type: 'string'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Agent phone number',
    example: '+91-9876543210',
    type: 'string'
  })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Vehicle number or type',
    example: 'KA-01-AB-1234',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  vehicle_number?: string;

  @ApiProperty({
    description: 'Estimated time to reach customer location',
    example: '15 minutes',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  eta?: string;

  @ApiProperty({
    description: 'Agent photo URL',
    example: 'https://example.com/agent-photo.jpg',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  photo_url?: string;
}

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
    description: 'Delivery agent details',
    type: AgentDetailsDto,
    required: false,
    example: {
      name: 'John Doe',
      phone: '+91-9876543210',
      vehicle_number: 'KA-01-AB-1234',
      eta: '15 minutes',
      photo_url: 'https://example.com/agent-photo.jpg'
    }
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentDetailsDto)
  agent_details?: AgentDetailsDto;

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
