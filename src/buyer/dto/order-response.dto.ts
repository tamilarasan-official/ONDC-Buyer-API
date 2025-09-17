import { ApiProperty } from '@nestjs/swagger';

export class OrderItemResponseDto {
  @ApiProperty({
    description: 'Order item ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Item ID',
    example: 1,
    type: 'number'
  })
  item_id: number;

  @ApiProperty({
    description: 'Item name',
    example: 'Margherita Pizza'
  })
  item_name: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Classic margherita with fresh mozzarella'
  })
  item_description: string;

  @ApiProperty({
    description: 'Item images',
    type: [String],
    example: ['https://example.com/pizza.jpg']
  })
  item_images: string[];

  @ApiProperty({
    description: 'Quantity ordered',
    example: 2,
    type: 'number'
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 299.00,
    type: 'number'
  })
  unit_price: number;

  @ApiProperty({
    description: 'Total price for this item',
    example: 598.00,
    type: 'number'
  })
  total_price: number;

  @ApiProperty({
    description: 'Selected customizations',
    type: [Object],
    example: [
      {
        customization_group_id: 1,
        customization_group_name: 'Crust',
        selected_options: [
          {
            id: 1,
            name: 'Thin Crust',
            price: 0
          }
        ]
      }
    ]
  })
  customizations: any[];

  @ApiProperty({
    description: 'Selected variants',
    type: [Object],
    example: [
      {
        variant_group_id: 1,
        variant_group_name: 'Size',
        selected_variant: {
          id: 2,
          name: 'Medium (10 inch)',
          price: 100
        }
      }
    ]
  })
  variants: any[];

  @ApiProperty({
    description: 'Special instructions',
    example: 'Extra spicy, no onions',
    required: false
  })
  special_instructions?: string;
}

export class OrderTrackingResponseDto {
  @ApiProperty({
    description: 'Tracking ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Order status',
    example: 'confirmed'
  })
  status: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Order confirmed and will be prepared shortly'
  })
  message: string;

  @ApiProperty({
    description: 'Status timestamp',
    example: '2025-01-02T10:30:00Z'
  })
  timestamp: string;
}

export class DeliveryAddressDto {
  @ApiProperty({
    description: 'Address ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Address line 1',
    example: '123 Main Street'
  })
  address1: string;

  @ApiProperty({
    description: 'Address line 2',
    example: 'Apartment 4B',
    required: false
  })
  address2?: string;

  @ApiProperty({
    description: 'Address line 3',
    example: 'Near City Mall',
    required: false
  })
  address3?: string;

  @ApiProperty({
    description: 'City',
    example: 'Bangalore'
  })
  city: string;

  @ApiProperty({
    description: 'State',
    example: 'Karnataka'
  })
  state: string;

  @ApiProperty({
    description: 'Pincode',
    example: '560001'
  })
  pincode: string;

  @ApiProperty({
    description: 'Latitude',
    example: 9.9352300,
    type: 'number'
  })
  latitude: number;

  @ApiProperty({
    description: 'Longitude',
    example: 78.1304040,
    type: 'number'
  })
  longitude: number;

  @ApiProperty({
    description: 'Address type',
    example: 'home'
  })
  type: string;

  @ApiProperty({
    description: 'Alternate phone number',
    example: '9876543210',
    required: false
  })
  alternate_phone_number?: string;
}

export class RestaurantInfoDto {
  @ApiProperty({
    description: 'Restaurant ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Restaurant name',
    example: 'Pizza Palace'
  })
  name: string;

  @ApiProperty({
    description: 'Restaurant description',
    example: 'Best pizza in town'
  })
  description: string;

  @ApiProperty({
    description: 'Restaurant logo URL',
    example: 'https://example.com/logo.jpg'
  })
  logo_url: string;

  @ApiProperty({
    description: 'FSSAI license number',
    example: '12345678901234'
  })
  fssai_license: string;

  @ApiProperty({
    description: 'GST number',
    example: '22AAAAA0000A1Z5'
  })
  gst_number: string;
}

export class OrderSummaryDto {
  @ApiProperty({
    description: 'Subtotal amount',
    example: 598.00,
    type: 'number'
  })
  subtotal: number;

  @ApiProperty({
    description: 'Delivery fee',
    example: 30.00,
    type: 'number'
  })
  delivery_fee: number;

  @ApiProperty({
    description: 'Tax amount',
    example: 107.64,
    type: 'number'
  })
  tax_amount: number;

  @ApiProperty({
    description: 'Discount amount',
    example: 50.00,
    type: 'number'
  })
  discount_amount: number;

  @ApiProperty({
    description: 'Final total amount',
    example: 685.64,
    type: 'number'
  })
  total_amount: number;
}

export class OrderDataDto {
  @ApiProperty({
    description: 'Order ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Order number',
    example: 'ORD-20250102-001'
  })
  order_number: string;

  @ApiProperty({
    description: 'Order status',
    example: 'confirmed'
  })
  status: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'online'
  })
  payment_method: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'paid'
  })
  payment_status: string;

  @ApiProperty({
    description: 'Restaurant information',
    type: RestaurantInfoDto
  })
  restaurant: RestaurantInfoDto;

  @ApiProperty({
    description: 'Delivery address',
    type: DeliveryAddressDto
  })
  delivery_address: DeliveryAddressDto;

  @ApiProperty({
    description: 'Order items',
    type: [OrderItemResponseDto]
  })
  items: OrderItemResponseDto[];

  @ApiProperty({
    description: 'Order summary',
    type: OrderSummaryDto
  })
  summary: OrderSummaryDto;

  @ApiProperty({
    description: 'Order notes',
    example: 'Please call before delivery',
    required: false
  })
  notes?: string;

  @ApiProperty({
    description: 'Estimated delivery time',
    example: '2025-01-02T11:30:00Z'
  })
  estimated_delivery_time: string;

  @ApiProperty({
    description: 'Order tracking history',
    type: [OrderTrackingResponseDto]
  })
  tracking: OrderTrackingResponseDto[];

  @ApiProperty({
    description: 'Order created at',
    example: '2025-01-02T10:30:00Z'
  })
  created_at: string;

  @ApiProperty({
    description: 'Order updated at',
    example: '2025-01-02T10:35:00Z'
  })
  updated_at: string;
}

export class CreateOrderResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Order created successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Order data',
    type: OrderDataDto
  })
  order: OrderDataDto;

  @ApiProperty({
    description: 'Payment details (for online payments)',
    example: {
      razorpay_order_id: 'order_29QQoUBi66xm2f',
      amount: 68564,
      currency: 'INR',
      key: 'rzp_test_1DP5mmOlF5G5ag'
    },
    required: false
  })
  payment_details?: {
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key: string;
  };
}

export class OrderResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Order retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Order data',
    type: OrderDataDto
  })
  data: OrderDataDto;
}

export class OrderListResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Orders retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'List of orders',
    type: [OrderDataDto]
  })
  data: OrderDataDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      page: 1,
      limit: 10,
      total: 25,
      total_pages: 3,
      has_next: true,
      has_prev: false
    }
  })
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Payment initiated successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Payment details',
    example: {
      razorpay_order_id: 'order_29QQoUBi66xm2f',
      amount: 68564,
      currency: 'INR',
      key: 'rzp_test_1DP5mmOlF5G5ag',
      name: 'Pizza Palace',
      description: 'Order #ORD-20250102-001',
      prefill: {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '9876543210'
      }
    }
  })
  payment_details: {
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key: string;
    name: string;
    description: string;
    prefill: {
      name: string;
      email: string;
      contact: string;
    };
  };
}

export class VerifyPaymentResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Payment verified successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_29QQoUBi66xm2f'
  })
  payment_id: string;

  @ApiProperty({
    description: 'Order status after payment',
    example: 'confirmed'
  })
  order_status: string;
}
