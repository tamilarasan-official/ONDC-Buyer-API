import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum } from "class-validator";

export enum InvoiceFormat {
  PDF = "pdf",
  JSON = "json",
}

export class GenerateInvoiceDto {
  @ApiProperty({
    description: "Invoice format",
    enum: InvoiceFormat,
    default: InvoiceFormat.PDF,
    example: "pdf",
  })
  @IsOptional()
  @IsEnum(InvoiceFormat)
  format?: InvoiceFormat = InvoiceFormat.PDF;

  @ApiProperty({
    description: "Additional notes for the invoice",
    required: false,
    example: "Thank you for your order!",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InvoiceItemDto {
  @ApiProperty({
    description: "Item name",
    example: "Margherita Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Item description",
    example: "Classic pizza with tomato and mozzarella",
  })
  description: string;

  @ApiProperty({
    description: "Quantity ordered",
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: "Unit price",
    example: 299.99,
  })
  unit_price: number;

  @ApiProperty({
    description: "Total price for this item",
    example: 599.98,
  })
  total_price: number;

  @ApiProperty({
    description: "Customizations applied",
    example: ["Extra Cheese", "Thin Crust"],
    required: false,
  })
  customizations?: string[];

  @ApiProperty({
    description: "Special instructions",
    example: "No onions please",
    required: false,
  })
  special_instructions?: string;
}

export class InvoiceResponseDto {
  @ApiProperty({
    description: "Invoice number",
    example: "INV-20250102-001",
  })
  invoice_number: string;

  @ApiProperty({
    description: "Order number",
    example: "ORD-20250102-001",
  })
  order_number: string;

  @ApiProperty({
    description: "Invoice date",
    example: "2025-01-02T10:30:00Z",
  })
  invoice_date: string;

  @ApiProperty({
    description: "Order date",
    example: "2025-01-02T10:00:00Z",
  })
  order_date: string;

  @ApiProperty({
    description: "Customer information",
  })
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };

  @ApiProperty({
    description: "Store information",
  })
  store: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
    gst_number?: string;
    license_number?: string;
  };

  @ApiProperty({
    description: "Order items",
    type: [InvoiceItemDto],
  })
  items: InvoiceItemDto[];

  @ApiProperty({
    description: "Pricing breakdown",
  })
  pricing: {
    subtotal: number;
    delivery_fee: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
  };

  @ApiProperty({
    description: "Payment information",
  })
  payment: {
    method: string;
    status: string;
    transaction_id?: string;
  };

  @ApiProperty({
    description: "Delivery information",
  })
  delivery: {
    estimated_time?: string;
    delivered_at?: string;
    agent_name?: string;
    agent_phone?: string;
  };

  @ApiProperty({
    description: "Additional notes",
    required: false,
  })
  notes?: string;
}

export class InvoiceUrlResponseDto {
  @ApiProperty({ description: "Invoice number", example: "T-20261010-10001" })
  invoice_no: string;

  @ApiProperty({ description: "Order number", example: "ORD-20261010-0001" })
  order_number: string;

  @ApiProperty({
    description: "S3 URL of the PDF invoice",
    example: "https://cdn.example.com/invoices/ORD-20261010-0001.pdf",
  })
  invoice_url: string;
}
