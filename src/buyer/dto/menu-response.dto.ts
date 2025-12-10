import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum } from "class-validator";
import { StoreDietaryPreference } from "../../shared/enums/store-dietary-preference.enum";

export class MenuItemPriceDto {
  @ApiProperty({
    description: "Base price of the item",
    example: 299.0,
    type: "number",
  })
  base_price: number;

  @ApiProperty({
    description: "Currency code",
    example: "INR",
  })
  currency: string;

  @ApiProperty({
    description: "Maximum price with all premium options",
    example: 399.0,
    type: "number",
    required: false,
  })
  maximum_price?: number;

  @ApiProperty({
    description: "Minimum possible price with customizations",
    example: 249.0,
    type: "number",
    required: false,
  })
  minimum_price_range?: number;

  @ApiProperty({
    description: "Maximum possible price with customizations",
    example: 449.0,
    type: "number",
    required: false,
  })
  maximum_price_range?: number;
}

export class MenuItemQuantityDto {
  @ApiProperty({
    description: "Unit type",
    example: "unit",
  })
  unit_type: string;

  @ApiProperty({
    description: "Unit value",
    example: 1,
    type: "number",
  })
  unit_value: number;

  @ApiProperty({
    description: "Available count",
    example: 50,
    type: "number",
  })
  available_count: number;

  @ApiProperty({
    description: "Maximum allowed quantity",
    example: 10,
    type: "number",
  })
  maximum_count: number;
}

export class MenuItemAttributeDto {
  @ApiProperty({
    description: "Attribute code",
    example: "veg_nonveg",
  })
  attribute_code: string;

  @ApiProperty({
    description: "Attribute name",
    example: "Veg Non-Veg",
  })
  attribute_name: string;

  @ApiProperty({
    description: "Attribute value",
    example: "veg",
  })
  attribute_value: string;

  @ApiProperty({
    description: "Attribute group",
    example: "dietary",
  })
  attribute_group: string;
}

export class MenuItemCustomizationDto {
  @ApiProperty({
    description: "Customization group ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Customization group name",
    example: "Crust",
  })
  name: string;

  @ApiProperty({
    description: "Customization group description",
    example: "Choose your pizza crust",
  })
  description: string;

  @ApiProperty({
    description: "Minimum selections required",
    example: 1,
    type: "number",
  })
  min_selections: number;

  @ApiProperty({
    description: "Maximum selections allowed",
    example: 1,
    type: "number",
  })
  max_selections: number;

  @ApiProperty({
    description: "Input type",
    example: "select",
    enum: ["select", "radio", "checkbox"],
  })
  input_type: string;

  @ApiProperty({
    description: "Is mandatory",
    example: true,
    type: "boolean",
  })
  is_mandatory: boolean;

  @ApiProperty({
    description: "Display sequence",
    example: 1,
    type: "number",
  })
  sequence: number;

  @ApiProperty({
    description: "Available options",
    type: [Object],
    example: [
      {
        id: 1,
        name: "Thin Crust",
        price: 0,
        is_default: true,
      },
      {
        id: 2,
        name: "Thick Crust",
        price: 50,
        is_default: false,
      },
    ],
  })
  options: Array<{
    id: number;
    name: string;
    price: number;
    is_default: boolean;
  }>;
}

export class MenuItemVariantDto {
  @ApiProperty({
    description: "Variant group ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Variant group name",
    example: "Size",
  })
  name: string;

  @ApiProperty({
    description: "Variant group description",
    example: "Choose your pizza size",
  })
  description: string;

  @ApiProperty({
    description: "Available variants",
    type: [Object],
    example: [
      {
        id: 1,
        name: "Small (8 inch)",
        price: 0,
        is_default: true,
      },
      {
        id: 2,
        name: "Medium (10 inch)",
        price: 100,
        is_default: false,
      },
      {
        id: 3,
        name: "Large (12 inch)",
        price: 200,
        is_default: false,
      },
    ],
  })
  variants: Array<{
    id: number;
    name: string;
    price: number;
    is_default: boolean;
  }>;
}

export class MenuItemDto {
  @ApiProperty({
    description: "Item ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Item name",
    example: "Margherita Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Item short description",
    example: "Classic margherita with fresh mozzarella",
  })
  short_desc: string;

  @ApiProperty({
    description: "Item long description",
    example:
      "Traditional Italian pizza with fresh mozzarella, tomato sauce, and basil",
  })
  long_desc: string;

  @ApiProperty({
    description: "Item images",
    type: [String],
    example: ["https://example.com/pizza.jpg"],
  })
  images: string[];

  @ApiProperty({
    description: "Item price information",
    type: MenuItemPriceDto,
  })
  price: MenuItemPriceDto;

  @ApiProperty({
    description: "Item quantity information",
    type: MenuItemQuantityDto,
  })
  quantity: MenuItemQuantityDto;

  @ApiProperty({
    description: "Item attributes",
    type: [MenuItemAttributeDto],
  })
  attributes: MenuItemAttributeDto[];

  @ApiProperty({
    description: "Item customization groups",
    type: [MenuItemCustomizationDto],
    required: false,
  })
  customizations?: MenuItemCustomizationDto[];

  @ApiProperty({
    description: "Item variant groups",
    type: [MenuItemVariantDto],
    required: false,
  })
  variants?: MenuItemVariantDto[];

  @ApiProperty({
    description: "Item rating",
    example: 4.2,
    type: "number",
  })
  rating: number;

  @ApiProperty({
    description: "Is item available",
    example: true,
    type: "boolean",
  })
  is_available: boolean;

  @ApiProperty({
    description: "Is item recommended",
    example: true,
    type: "boolean",
  })
  is_recommended: boolean;

  @ApiProperty({
    description: "Tax rate percentage",
    example: 18.0,
    type: "number",
    required: false,
  })
  tax_rate?: number;

  @ApiProperty({
    description: "Tax type",
    example: "GST",
    required: false,
  })
  tax_type?: string;

  @ApiProperty({
    description: "HSN code for tax classification",
    example: "1905",
    required: false,
  })
  hsn_code?: string;

  @ApiProperty({
    description: "Is item marked as favorite by the logged-in user",
    example: false,
    type: "boolean",
  })
  is_favorite: boolean;

  @ApiProperty({ 
    description: "Is preorder available for this item?", 
    required: false 
  })
  is_preorder_available?: boolean;

  @ApiProperty({ 
    description: "Preorder campaign info (if available)", 
    required: false 
  })
  preorder_campaign?: {
    id: number;
    title: string;
    available_slots: number;
    delivery_date: string;
    discount_amount: number;
    free_delivery: boolean;
  };
}

export class MenuCategoryDto {
  @ApiProperty({
    description: "Category ID",
    example: 1,
    type: "number",
  })
  id: number;

  @ApiProperty({
    description: "Category name",
    example: "Pizza",
  })
  name: string;

  @ApiProperty({
    description: "Category description",
    example: "Delicious pizzas",
  })
  description: string;

  @ApiProperty({
    description: "Category icon URL",
    example: "https://example.com/pizza-icon.jpg",
  })
  icon: string;

  @ApiProperty({
    description: "Display rank",
    example: 1,
    type: "number",
  })
  display_rank: number;

  @ApiProperty({
    description: "Number of items in this category",
    example: 15,
    type: "number",
  })
  item_count: number;

  @ApiProperty({
    description: "Menu items in this category",
    type: [MenuItemDto],
  })
  items: MenuItemDto[];
}

export class MenuDataDto {
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
  restaurant_name: string;

  @ApiProperty({
    description: "Food type: pure-veg, veg, non-veg, egg, veg-and-non-veg",
    example: "veg",
    enum: StoreDietaryPreference,
    enumName: "StoreDietaryPreference",
    required: false,
  })
  @IsOptional()
  @IsEnum(StoreDietaryPreference)
  food_type?: StoreDietaryPreference;

  @ApiProperty({
    description: "Cuisine tags",
    example: "South Indian, North Indian, Chinese",
    required: false,
  })
  cuisine_tags?: string;

  @ApiProperty({
    description: "Menu categories with items",
    type: [MenuCategoryDto],
  })
  categories: MenuCategoryDto[];

  @ApiProperty({
    description: "Total number of items",
    example: 45,
    type: "number",
  })
  total_items: number;

  @ApiProperty({
    description: "Total number of categories",
    example: 8,
    type: "number",
  })
  total_categories: number;

  @ApiProperty({
    description: "Applied filters",
    example: {
      category_id: 1,
      search: "pizza",
      min_price: 100,
      max_price: 500,
      dietary_preference: "veg",
    },
  })
  applied_filters: {
    category_id?: number;
    search?: string;
    min_price?: number;
    max_price?: number;
    dietary_preference?: string;
  };

  @ApiProperty({
    description: "App operation hours status (indicates if app is currently accepting orders)",
    type: "object",
    properties: {
      is_open: {
        type: "boolean",
        example: true,
        description: "Whether the app is currently accepting orders",
      },
      reason: {
        type: "string",
        example: "OPEN",
        description: "Status reason: OPEN, OUTSIDE_OPERATING_HOURS, HOURS_NOT_ENABLED, etc.",
      },
      message: {
        type: "string",
        example: "App is currently accepting orders",
        description: "User-friendly status message",
      },
      next_open_time: {
        type: "string",
        example: "0800",
        nullable: true,
        description: "Next opening time in HHMM format (null if app is open or hours not configured)",
      },
    },
  })
  app_operation_status: {
    is_open: boolean;
    reason?: string;
    message?: string;
    next_open_time?: string | null;
  };
}

export class MenuResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
    type: "boolean",
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Menu retrieved successfully",
  })
  message: string;

  @ApiProperty({
    description: "Menu data",
    type: MenuDataDto,
  })
  data: MenuDataDto;
}
