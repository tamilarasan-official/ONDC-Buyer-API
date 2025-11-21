import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class CartItemCustomizationDto {
  @ApiProperty({
    description: "Customization group ID",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  customization_group_id: number;

  @ApiProperty({
    description: "Selected customization option IDs",
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  selected_options: number[];
}

export class CartItemVariantDto {
  @ApiProperty({
    description: "Variant group ID",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  variant_group_id: number;

  @ApiProperty({
    description: "Selected variant option ID",
    example: 2,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  selected_variant: number;
}

export class AddToCartDto {
  @ApiProperty({
    description: "Restaurant ID where the item belongs",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  restaurant_id: number;

  @ApiProperty({
    description: "Item ID to add to cart",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  item_id: number;

  @ApiProperty({
    description: "Quantity to add",
    example: 2,
    type: "number",
    minimum: 1,
    maximum: 50,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  quantity: number;

  @ApiProperty({
    description: "Selected customizations",
    type: [CartItemCustomizationDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemCustomizationDto)
  customizations?: CartItemCustomizationDto[];

  @ApiProperty({
    description: "Selected variants",
    type: [CartItemVariantDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemVariantDto)
  variants?: CartItemVariantDto[];

  @ApiProperty({
    description: "Special instructions for this item",
    example: "Extra spicy, no onions",
    required: false,
  })
  @IsOptional()
  @IsString()
  special_instructions?: string;
}

export class UpdateCartItemDto {
  @ApiProperty({
    description: "Cart item ID to update",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  cart_item_id: number;

  @ApiProperty({
    description: "Restaurant ID (for validation)",
    example: 1,
    type: "number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  restaurant_id?: number;

  @ApiProperty({
    description: "New quantity",
    example: 3,
    type: "number",
    minimum: 1,
    maximum: 50,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  quantity: number;

  @ApiProperty({
    description: "Updated customizations",
    type: [CartItemCustomizationDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemCustomizationDto)
  customizations?: CartItemCustomizationDto[];

  @ApiProperty({
    description: "Updated variants",
    type: [CartItemVariantDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemVariantDto)
  variants?: CartItemVariantDto[];

  @ApiProperty({
    description: "Updated special instructions",
    example: "Medium spicy, extra cheese",
    required: false,
  })
  @IsOptional()
  @IsString()
  special_instructions?: string;
}

export class RemoveFromCartDto {
  @ApiProperty({
    description: "Cart item ID to remove",
    example: 1,
    type: "number",
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  cart_item_id: number;
}

export class ApplyOfferDto {
  @ApiProperty({
    description: "Offer code to apply",
    example: "PIZZA50",
    required: false,
  })
  @IsOptional()
  @IsString()
  offer_code?: string;

  @ApiProperty({
    description: "Offer ID to apply",
    example: 1,
    type: "number",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offer_id?: number;
}

export class UpdateTipDto {
  @ApiProperty({
    description: "Tip amount to add to cart",
    example: 50.00,
    type: "number",
    minimum: 0,
    required: true,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tip_amount: number;
}
