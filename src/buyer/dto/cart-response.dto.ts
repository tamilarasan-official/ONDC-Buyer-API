import { ApiProperty } from "@nestjs/swagger";

export class CartItemCustomizationResponseDto {
  @ApiProperty({
    description: "Customization group ID",
    example: 1,
    type: "number",
  })
  customization_group_id: number;

  @ApiProperty({
    description: "Customization group name",
    example: "Crust",
  })
  customization_group_name: string;

  @ApiProperty({
    description: "Selected options",
    type: [Object],
    example: [
      {
        id: 1,
        name: "Thin Crust",
        price: 0,
      },
    ],
  })
  selected_options: Array<{
    id: number;
    name: string;
    price: number;
  }>;
}

export class CartItemVariantResponseDto {
  @ApiProperty({
    description: "Variant group ID",
    example: 1,
    type: "number",
  })
  variant_group_id: number;

  @ApiProperty({
    description: "Variant group name",
    example: "Size",
  })
  variant_group_name: string;

  @ApiProperty({
    description: "Selected variant",
    example: {
      id: 2,
      name: "Medium (10 inch)",
      price: 100,
    },
  })
  selected_variant: {
    id: number;
    name: string;
    price: number;
  };
}

export class CartItemResponseDto {
  @ApiProperty({
    description: "Cart item ID",
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
    description: "Quantity",
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
    type: [CartItemCustomizationResponseDto],
    required: false,
  })
  customizations?: CartItemCustomizationResponseDto[];

  @ApiProperty({
    description: "Selected variants",
    type: [CartItemVariantResponseDto],
    required: false,
  })
  variants?: CartItemVariantResponseDto[];

  @ApiProperty({
    description: "Special instructions",
    example: "Extra spicy, no onions",
    required: false,
  })
  special_instructions?: string;

  @ApiProperty({
    description: "Is item available",
    example: true,
    type: "boolean",
  })
  is_available: boolean;

  @ApiProperty({ description: "Is this a preorder item?", required: false })
  is_preorder?: boolean;

  @ApiProperty({
    description:
      "Preorder campaign info (only present when is_preorder is true). final_price is the per-unit selling price for this preorder campaign.",
    required: false,
  })
  preorder_campaign?: {
    id: number;
    title: string;
    delivery_date: string;
    available_slots: number;
    free_delivery?: boolean;
    final_price?: number;
  };
}

export class CartSummaryDto {
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
    description: "Tax amount (item tax only)",
    example: 107.64,
    type: "number",
  })
  tax_amount: number;

  @ApiProperty({
    description:
      "Tax included in the payable total: item tax + delivery tax + platform fee tax only when include_platform_fee is true.",
    example: 115.54,
    type: "number",
    required: false,
  })
  total_tax_amount?: number;

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
    description: "Maximum tip amount allowed (constant: ₹100.00)",
    example: 100.0,
    type: "number",
    required: false,
  })
  max_tip_amount?: number;

  @ApiProperty({
    description:
      "Configured platform fee from app settings (always returned). When include_platform_fee is false, strike through in UI — not added to final_amount. When true, same value is included in the total.",
    example: 50.0,
    type: "number",
  })
  platform_fee: number;

  @ApiProperty({
    description:
      "When false, platform_fee and platform_fee_tax in the payload are for display/strikethrough only; final_amount and total_tax_amount exclude them.",
    example: true,
    type: "boolean",
  })
  include_platform_fee: boolean;

  @ApiProperty({
    description: "Final total amount",
    example: 735.64,
    type: "number",
  })
  final_amount: number;

  @ApiProperty({
    description: "Estimated delivery time",
    example: "11-17 minutes",
    required: false,
  })
  estimated_delivery_time?: string | null;

  @ApiProperty({
    description: "Applied offer details",
    example: {
      id: 1,
      name: "50% Off on Pizza",
      offer_code: "PIZZA50",
      discount_amount: 50.0,
    },
    required: false,
  })
  applied_offer?: {
    id: number;
    name: string;
    offer_code: string;
    discount_amount: number;
  };
}

export class CartDataDto {
  @ApiProperty({
    description: "Cart ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  restaurant_id: number;

  @ApiProperty({
    description: "Restaurant name",
    example: "Pizza Palace",
  })
  restaurant_name: number;

  @ApiProperty({
    description: "Restaurant logo URL",
    example: "https://example.com/logo.jpg",
  })
  restaurant_logo: string;

  @ApiProperty({
    description: "Cart items",
    type: [CartItemResponseDto],
  })
  items: CartItemResponseDto[];

  @ApiProperty({
    description: "Cart summary",
    type: CartSummaryDto,
  })
  summary: CartSummaryDto;

  @ApiProperty({
    description: "Total number of items",
    example: 3,
    type: "number",
  })
  total_items: number;

  @ApiProperty({
    description: "Is cart active",
    example: true,
    type: "boolean",
  })
  is_active: boolean;

  @ApiProperty({
    description: "Cart created at",
    example: "2025-01-02T10:30:00Z",
  })
  created_at: string;

  @ApiProperty({
    description: "Cart updated at",
    example: "2025-01-02T10:35:00Z",
  })
  updated_at: string;
}

export class CartResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Cart retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Cart data",
    type: CartDataDto,
  })
  data: CartDataDto;
}

export class AddToCartResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Item added to cart successfully",
  })
  message: string;

  @ApiProperty({
    description: "Cart ID",
    example: 1,
    type: "number",
  })
  cart_id: number;

  @ApiProperty({
    description: "Cart item ID",
    example: 1,
    type: "number",
  })
  cart_item_id: number;

  @ApiProperty({
    description: "Updated cart summary",
    type: CartSummaryDto,
  })
  cart_summary: CartSummaryDto;
}

export class UpdateCartResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Cart item updated successfully",
  })
  message: string;

  @ApiProperty({
    description: "Updated cart summary",
    type: CartSummaryDto,
  })
  cart_summary: CartSummaryDto;
}

export class RemoveFromCartResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Item removed from cart successfully",
  })
  message: string;

  @ApiProperty({
    description: "Updated cart summary",
    type: CartSummaryDto,
  })
  cart_summary: CartSummaryDto;
}

export class ApplyOfferResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Offer applied successfully",
  })
  message: string;

  @ApiProperty({
    description: "Applied offer details",
    example: {
      id: 1,
      name: "50% Off on Pizza",
      offer_code: "PIZZA50",
      discount_amount: 50.0,
    },
  })
  applied_offer: {
    id: number;
    name: string;
    offer_code: string;
    discount_amount: number;
  };

  @ApiProperty({
    description: "Updated cart summary",
    type: CartSummaryDto,
  })
  cart_summary: CartSummaryDto;
}
