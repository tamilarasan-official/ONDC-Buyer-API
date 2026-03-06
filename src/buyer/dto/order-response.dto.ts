import { ApiProperty } from "@nestjs/swagger";

export class OrderItemResponseDto {
  @ApiProperty({
    description: "Order item ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Item ID",
    example: 1,
    type: "number",
  })
  item_id: number;

  @ApiProperty({
    description: "Item name",
    example: "Margherita Pizza",
  })
  item_name: string;

  @ApiProperty({
    description: "Item description",
    example: "Classic margherita with fresh mozzarella",
  })
  item_description: string;

  @ApiProperty({
    description: "Item images",
    type: [String],
    example: ["https://example.com/pizza.jpg"],
  })
  item_images: string[];

  @ApiProperty({
    description: "Quantity ordered",
    example: 2,
    type: "number",
  })
  quantity: number;

  @ApiProperty({
    description: "Unit price",
    example: 299.0,
    type: "number",
  })
  unit_price: number;

  @ApiProperty({
    description: "Total price for this item",
    example: 598.0,
    type: "number",
  })
  total_price: number;

  @ApiProperty({
    description: "Selected customizations",
    type: [Object],
    example: [
      {
        customization_group_id: 1,
        customization_group_name: "Crust",
        selected_options: [
          {
            id: 1,
            name: "Thin Crust",
            price: 0,
          },
        ],
      },
    ],
  })
  customizations: any[];

  @ApiProperty({
    description: "Selected variants",
    type: [Object],
    example: [
      {
        variant_group_id: 1,
        variant_group_name: "Size",
        selected_variant: {
          id: 2,
          name: "Medium (10 inch)",
          price: 100,
        },
      },
    ],
  })
  variants: any[];

  @ApiProperty({
    description: "Special instructions",
    example: "Extra spicy, no onions",
    required: false,
  })
  special_instructions?: string;

  @ApiProperty({
    description: "Is this a preorder item?",
    example: false,
    type: "boolean",
    required: false,
  })
  is_preorder?: boolean;

  @ApiProperty({
    description: "Preorder campaign details (only present if is_preorder is true)",
    example: {
      campaign_id: 2,
      title: "12 O Clock - Preorder Briyani",
      delivery_date: "2025-02-11",
      available_slots: 10,
      free_delivery: true,
    },
    required: false,
  })
  preorder_campaign?: {
    campaign_id: number;
    title: string;
    delivery_date: string;
    available_slots: number;
    free_delivery: boolean;
  };
}

export class OrderTrackingResponseDto {
  @ApiProperty({
    description: "Tracking ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Order status",
    example: "confirmed",
  })
  status: string;

  @ApiProperty({
    description: "Status message",
    example: "Order confirmed and will be prepared shortly",
  })
  message: string;

  @ApiProperty({
    description: "Status timestamp",
    example: "2025-01-02T10:30:00Z",
  })
  timestamp: string;

  @ApiProperty({
    description: "Agent name",
    example: "John Doe",
    required: false,
  })
  agent_name?: string;

  @ApiProperty({
    description: "Agent phone",
    example: "+91-9876543210",
    required: false,
  })
  agent_phone?: string;

  @ApiProperty({
    description: "Agent vehicle number",
    example: "KA-01-AB-1234",
    required: false,
  })
  agent_vehicle_number?: string;

  @ApiProperty({
    description: "Agent ETA",
    example: "15 minutes",
    required: false,
  })
  agent_eta?: string;

  @ApiProperty({
    description: "Agent photo URL",
    example: "https://example.com/agent-photo.jpg",
    required: false,
  })
  agent_photo_url?: string;

  @ApiProperty({
    description: "Cancel reason details (only present when status is 'cancelled')",
    example: {
      code: "004",
      reason: "Store is not accepting order",
      cancelled_by: "buyer",
    },
    required: false,
  })
  cancel_reason?: {
    code?: string;
    reason?: string;
    cancelled_by?: string;
  };
}

export class DeliveryAddressDto {
  @ApiProperty({
    description: "Address ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Address line 1",
    example: "123 Main Street",
  })
  address1: string;

  @ApiProperty({
    description: "Address line 2",
    example: "Apartment 4B",
    required: false,
  })
  address2?: string;

  @ApiProperty({
    description: "Address line 3",
    example: "Near City Mall",
    required: false,
  })
  address3?: string;

  @ApiProperty({
    description: "City",
    example: "Bangalore",
  })
  city: string;

  @ApiProperty({
    description: "State",
    example: "Karnataka",
  })
  state: string;

  @ApiProperty({
    description: "Pincode",
    example: "560001",
  })
  pincode: string;

  @ApiProperty({
    description: "Latitude",
    example: 9.93523,
    type: "number",
  })
  latitude: number;

  @ApiProperty({
    description: "Longitude",
    example: 78.130404,
    type: "number",
  })
  longitude: number;

  @ApiProperty({
    description: "Address type",
    example: "home",
  })
  type: string;

  @ApiProperty({
    description: "Alternate phone number",
    example: "9876543210",
    required: false,
  })
  alternate_phone_number?: string;
}

export class PickupAddressDto {
  @ApiProperty({
    description: "Store location ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Pickup location latitude",
    example: 9.93523,
    type: "number",
  })
  latitude: number;

  @ApiProperty({
    description: "Pickup location longitude",
    example: 78.130404,
    type: "number",
  })
  longitude: number;

  @ApiProperty({
    description: "Locality",
    example: "Koramangala",
  })
  locality: string;

  @ApiProperty({
    description: "Street address",
    example: "5th Block",
  })
  street: string;

  @ApiProperty({
    description: "City",
    example: "Bangalore",
  })
  city: string;

  @ApiProperty({
    description: "Area code / pincode",
    example: "560034",
  })
  area_code: string;

  @ApiProperty({
    description: "State",
    example: "KA",
  })
  state: string;
}

export class RestaurantInfoDto {
  @ApiProperty({
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Restaurant name",
    example: "Pizza Palace",
  })
  name: string;

  @ApiProperty({
    description: "Restaurant description",
    example: "Best pizza in town",
  })
  description: string;

  @ApiProperty({
    description: "Restaurant logo URL",
    example: "https://example.com/logo.jpg",
  })
  logo_url: string;

  @ApiProperty({
    description: "FSSAI license number",
    example: "12345678901234",
  })
  fssai_license: string;

  @ApiProperty({
    description: "GST number",
    example: "22AAAAA0000A1Z5",
  })
  gst_number: string;
}

export class OrderSummaryDto {
  @ApiProperty({
    description: "Subtotal amount",
    example: 598.0,
    type: "number",
  })
  subtotal: number;

  @ApiProperty({
    description: "Delivery fee",
    example: 30.0,
    type: "number",
  })
  delivery_fee: number;

  @ApiProperty({
    description: "Delivery fee tax",
    example: 3.0,
    type: "number",
  })
  delivery_fee_tax: number;

  @ApiProperty({
    description: "Delivery percent",
    example: 18.00,
    type: "number",
  })
  delivery_percent: number;

  @ApiProperty({
    description: "Tax amount (item tax only)",
    example: 107.64,
    type: "number",
  })
  tax_amount: number;

  @ApiProperty({
    description: "Platform fee amount",
    example: 5.0,
    type: "number",
  })
  platform_fee: number;

  @ApiProperty({
    description: "Platform fee tax",
    example: 3.0,
    type: "number",
  })
  platform_fee_tax: number;

  @ApiProperty({
    description: "Platform percent",
    example: 18.00,
    type: "number",
  })
  platform_percent: number;

  @ApiProperty({
    description: "Total tax amount (includes item tax, delivery tax, and platform fee tax)",
    example: 115.54,
    type: "number",
  })
  total_tax_amount: number;

  @ApiProperty({
    description: "Discount amount",
    example: 50.0,
    type: "number",
  })
  discount_amount: number;

  @ApiProperty({
    description: "Tip amount",
    example: 50.0,
    type: "number",
  })
  tip_amount: number;

  @ApiProperty({
    description: "Final total amount",
    example: 735.64,
    type: "number",
  })
  total_amount: number;
}

export class OrderDataDto {
  @ApiProperty({
    description: "Order ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Order number",
    example: "ORD-20250102-001",
  })
  order_number: string;

  @ApiProperty({
    description: "Order status",
    example: "confirmed",
  })
  status: string;

  @ApiProperty({
    description: "Cancel reason details (only present when status is 'cancelled')",
    example: {
      code: "004",
      reason: "Store is not accepting order",
      cancelled_by: "buyer",
    },
    required: false,
  })
  cancel_reason?: {
    code?: string;
    reason?: string;
    cancelled_by?: string;
  };

  @ApiProperty({
    description: "Payment method",
    example: "online",
  })
  payment_method: string;

  @ApiProperty({
    description: "Payment status",
    example: "paid",
  })
  payment_status: string;

  @ApiProperty({
    description: "Restaurant information",
    type: RestaurantInfoDto,
  })
  restaurant: RestaurantInfoDto;

  @ApiProperty({
    description: "Store pickup address (location with lat/long). Null if store has no active location.",
    type: PickupAddressDto,
    nullable: true,
    required: false,
  })
  pickup_address: PickupAddressDto | null;

  @ApiProperty({
    description: "Delivery address",
    type: DeliveryAddressDto,
  })
  delivery_address: DeliveryAddressDto;

  @ApiProperty({
    description: "Order items",
    type: [OrderItemResponseDto],
  })
  items: OrderItemResponseDto[];

  @ApiProperty({
    description: "Order summary",
    type: OrderSummaryDto,
  })
  summary: OrderSummaryDto;

  @ApiProperty({
    description: "Order notes",
    example: "Please call before delivery",
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: "Estimated delivery time",
    example: "2025-01-02T11:30:00Z",
  })
  estimated_delivery_time: string;

  @ApiProperty({
    description: "Order tracking history",
    type: [OrderTrackingResponseDto],
  })
  tracking: OrderTrackingResponseDto[];

  @ApiProperty({
    description: "Order created at",
    example: "2025-01-02T10:30:00Z",
  })
  created_at: string;

  @ApiProperty({
    description: "Order updated at",
    example: "2025-01-02T10:35:00Z",
  })
  updated_at: string;

  @ApiProperty({
    description: "Invoice information",
    example: {
      available: true,
      download_url: "/api/buyer/invoice/download/123",
      data_url: "/api/buyer/invoice/data/123",
    },
  })
  invoice: {
    available: boolean;
    download_url: string | null;
    data_url: string | null;
  };

  @ApiProperty({
    description: "Does this order contain preorder items?",
    example: false,
    type: "boolean",
    required: false,
  })
  has_preorder_items?: boolean;

  @ApiProperty({
    description: "Preorder delivery date (only present if has_preorder_items is true)",
    example: "2025-02-11",
    required: false,
  })
  preorder_delivery_date?: string;
}

export class CreateOrderResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Order created successfully",
  })
  message: string;

  @ApiProperty({
    description: "Order data",
    type: OrderDataDto,
  })
  order: OrderDataDto;

  @ApiProperty({
    description: "Payment details (for online payments)",
    example: {
      razorpay_order_id: "order_29QQoUBi66xm2f",
      amount: 68564,
      currency: "INR",
      key: "rzp_test_1DP5mmOlF5G5ag",
      name: "Restaurant Name",
      description: "Order #ORD-20250102-001",
      prefill: {
        name: "User Name",
        email: "user@example.com",
        contact: "+91-9876543210"
      }
    },
    required: false,
  })
  payment_details?: {
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key: string;
    name?: string;
    description?: string;
    prefill?: {
      name: string;
      email: string;
      contact: string;
    };
  };
}

export class OrderResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Order retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Order data",
    type: OrderDataDto,
  })
  data: OrderDataDto;
}

export class OrderListResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Orders retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "List of orders",
    type: [OrderDataDto],
  })
  data: OrderDataDto[];

  @ApiProperty({
    description: "Pagination metadata",
    example: {
      page: 1,
      limit: 10,
      total: 25,
      total_pages: 3,
      has_next: true,
      has_prev: false,
    },
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
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Payment initiated successfully",
  })
  message: string;

  @ApiProperty({
    description: "Payment details",
    example: {
      razorpay_order_id: "order_29QQoUBi66xm2f",
      amount: 68564,
      currency: "INR",
      key: "rzp_test_1DP5mmOlF5G5ag",
      name: "Pizza Palace",
      description: "Order #ORD-20250102-001",
      prefill: {
        name: "John Doe",
        email: "john@example.com",
        contact: "9876543210",
      },
    },
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
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Payment verified successfully",
  })
  message: string;

  @ApiProperty({
    description: "Payment ID",
    example: "pay_29QQoUBi66xm2f",
  })
  payment_id: string;

  @ApiProperty({
    description: "Order status after payment",
    example: "confirmed",
  })
  order_status: string;
}
