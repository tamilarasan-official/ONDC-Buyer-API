import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export enum PaymentMethod {
  COD = "cod",
  ONLINE = "online",
  WALLET = "wallet",
  UPI = "upi",
}

export class CreateOrderDto {
  @ApiProperty({
    description: "Delivery address ID",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  delivery_address_id: number;

  @ApiProperty({
    description: "Payment method",
    example: "online",
    enum: PaymentMethod,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({
    description: "Special instructions for the order",
    example: "Please call before delivery",
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: "Apply saved offer code",
    example: "PIZZA50",
    required: false,
  })
  @IsOptional()
  @IsString()
  offer_code?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: "New order status",
    example: "confirmed",
    enum: [
      "pending",
      "confirmed",
      "preparing",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ],
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    description: "Status update message",
    example: "Order confirmed and will be prepared shortly",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CancelOrderDto {
  @ApiProperty({
    description: "Cancellation reason",
    example: "Changed my mind",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePaymentDto {
  @ApiProperty({
    description: "Order ID for payment",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: "Payment method",
    example: "online",
    enum: PaymentMethod,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({
    description: "Payment amount in paise (e.g., 10000 for ₹100)",
    example: 68564,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(100) // Minimum ₹1
  amount: number;

  @ApiProperty({
    description: "Currency code",
    example: "INR",
    default: "INR",
  })
  @IsOptional()
  @IsString()
  currency?: string = "INR";

  @ApiProperty({
    description: "Customer name for payment",
    example: "John Doe",
  })
  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @ApiProperty({
    description: "Customer email for payment",
    example: "john@example.com",
  })
  @IsNotEmpty()
  @IsString()
  customer_email: string;

  @ApiProperty({
    description: "Customer phone for payment",
    example: "9876543210",
  })
  @IsNotEmpty()
  @IsString()
  customer_phone: string;
}

export class VerifyPaymentDto {
  @ApiProperty({
    description: "Razorpay payment ID",
    example: "pay_29QQoUBi66xm2f",
  })
  @IsNotEmpty()
  @IsString()
  razorpay_payment_id: string;

  @ApiProperty({
    description: "Razorpay order ID",
    example: "order_29QQoUBi66xm2f",
  })
  @IsNotEmpty()
  @IsString()
  razorpay_order_id: string;

  @ApiProperty({
    description: "Razorpay signature for verification",
    example: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d",
  })
  @IsNotEmpty()
  @IsString()
  razorpay_signature: string;
}

export class OrderTrackingDto {
  @ApiProperty({
    description: "Order ID to track",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  order_id: number;
}
