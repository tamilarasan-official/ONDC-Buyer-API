# Preorder Booking System - Coupon-Based Implementation Guide

## 📋 Overview

This document outlines the implementation of a preorder booking system using the existing **Coupon System** infrastructure. This approach reuses the proven Redis quota management, reservation system, and validation logic while adding preorder-specific functionality.

## 🎯 Requirements

1. **Store-level preorder**: Enable preorder for specific items in specific stores
2. **User limit**: Maximum 100 users per preorder campaign
3. **One preorder item per cart**: Each user can only have one preorder item in cart at a time (regardless of campaign)
4. **Reservation system**: Atomic reservation with TTL (reuse coupon system)
5. **Order conversion**: Convert preorder to actual order upon payment
6. **Discount support**: Preorder campaigns can include:
   - **Flat discount**: Fixed rupee amount (e.g., ₹30 off)
   - **Percentage discount**: Percentage of item price with optional max cap (e.g., 20% off, max ₹50)
   - **Free delivery**: Can be combined with either discount type
7. **Auto-apply coupon**: Preorder coupon is automatically applied when preorder item is added to cart
8. **Cart restriction**: Cart can contain either preorder items OR regular items, not both (no multiple deliveries support)
9. **Order tracking**: Preorder orders are tracked same as regular orders

## 🏗️ System Architecture

### Reusing Coupon System Infrastructure

The coupon system already provides:
- ✅ `global_usage_limit` - Set to 100 for preorder campaigns
- ✅ `user_usage_limit` - Set to 1 for one per user
- ✅ `applicable_store_ids` - Store restriction
- ✅ Redis quota management with atomic LUA scripts
- ✅ Reservation system with TTL
- ✅ Time-based validity (`start_at`, `end_at`)

### What We Need to Add

1. **PREORDER coupon type** - New coupon type for preorders
2. **Item validation** - Validate item_id in `type_meta`
3. **Order creation flow** - Modify redemption to create orders
4. **Enhance existing item APIs** - Include preorder info in restaurant menu, restaurant details, and search APIs

## 📁 Database Changes

### 1. Add PREORDER to CouponType Enum

**File**: `src/coupon/entities/coupon.entity.ts`

```typescript
export enum CouponType {
  FLAT = "flat",
  PERCENT = "percent",
  FREE_DELIVERY = "free_delivery",
  FIRST_ORDER = "first_order",
  NTH_ORDER = "nth_order",
  REFERRAL = "referral",
  PREORDER = "preorder", // ← NEW
}
```

### 2. Add Preorder Fields to CartItem Entity

**File**: `src/cart/entities/cart-item.entity.ts`

**Migration**: `XXXXX-AddPreorderFieldsToCartItem.ts`

```typescript
// src/migrations/XXXXX-AddPreorderFieldsToCartItem.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderFieldsToCartItemXXXXX implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_preorder column
    await queryRunner.query(`
      ALTER TABLE "cart_items" 
      ADD COLUMN "is_preorder" boolean NOT NULL DEFAULT false;
    `);

    // Add preorder_campaign_id column
    await queryRunner.query(`
      ALTER TABLE "cart_items" 
      ADD COLUMN "preorder_campaign_id" bigint;
    `);

    // Add preorder_reservation_token column
    await queryRunner.query(`
      ALTER TABLE "cart_items" 
      ADD COLUMN "preorder_reservation_token" uuid;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cart_items" DROP COLUMN "preorder_reservation_token";
    `);
    await queryRunner.query(`
      ALTER TABLE "cart_items" DROP COLUMN "preorder_campaign_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "cart_items" DROP COLUMN "is_preorder";
    `);
  }
}
```

### 3. Add Preorder Fields to OrderItem Entity

**File**: `src/order/entities/order-item.entity.ts`

**Migration**: `XXXXX-AddPreorderFieldsToOrderItem.ts`

```typescript
// src/migrations/XXXXX-AddPreorderFieldsToOrderItem.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderFieldsToOrderItemXXXXX implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_preorder column
    await queryRunner.query(`
      ALTER TABLE "order_items" 
      ADD COLUMN "is_preorder" boolean NOT NULL DEFAULT false;
    `);

    // Add preorder_campaign_id column
    await queryRunner.query(`
      ALTER TABLE "order_items" 
      ADD COLUMN "preorder_campaign_id" bigint;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items" DROP COLUMN "preorder_campaign_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items" DROP COLUMN "is_preorder";
    `);
  }
}
```

### 4. Add PREORDER to CouponType Enum

**File**: `src/coupon/entities/coupon.entity.ts`

**Migration**: `XXXXX-AddPreorderCouponType.ts`

```typescript
// src/migrations/XXXXX-AddPreorderCouponType.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderCouponTypeXXXXX implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add PREORDER to enum
    await queryRunner.query(`
      ALTER TYPE "coupons_type_enum" ADD VALUE IF NOT EXISTS 'preorder';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum
    this.logger.warn('Cannot remove enum value. Manual intervention required.');
  }
}
```

## 🔄 Workflow

### 1. Admin Creates Preorder Campaign

**API**: `POST /api/admin/coupons/generate` (existing endpoint)

**Example 1: Preorder with Flat Discount + Free Delivery**

```json
{
  "campaign_id": 1,
  "count": 1,
  "type": "preorder",
  "type_meta": {
    "item_id": 653,
    "store_id": 87,
    "preorder": true,
    "delivery_date": "2025-12-15T00:00:00Z",
    "title": "Chamomile Herbal Tea - Preorder",
    "description": "Preorder now, delivery on Dec 15",
    "free_delivery": true
  },
  "value": 30,
  "value_type": "rupees",  // Flat discount in rupees
  "min_cart_value": 0,
  "global_usage_limit": 100,
  "user_usage_limit": 1,
  "applicable_store_ids": [87],
  "start_at": "2025-12-10T00:00:00Z",
  "end_at": "2025-12-12T23:59:59Z"
}
```

**Example 2: Preorder with Percentage Discount**

```json
{
  "campaign_id": 2,
  "count": 1,
  "type": "preorder",
  "type_meta": {
    "item_id": 653,
    "store_id": 87,
    "preorder": true,
    "delivery_date": "2025-12-15T00:00:00Z",
    "title": "Chamomile Herbal Tea - Preorder",
    "description": "Preorder now, delivery on Dec 15",
    "free_delivery": true
  },
  "value": 20,
  "value_type": "percent",
  "max_discount_amount": 50,
  "min_cart_value": 0,
  "global_usage_limit": 100,
  "user_usage_limit": 1,
  "applicable_store_ids": [87],
  "start_at": "2025-12-10T00:00:00Z",
  "end_at": "2025-12-12T23:59:59Z"
}
```

**Campaign Details:**

**Example 1 (Flat Discount):**
- **Item Price**: ₹150 (Chamomile Herbal Tea)
- **Discount**: ₹30 (flat discount)
- **Free Delivery**: Yes (via `type_meta.free_delivery: true`)
- **Final Price**: ₹150 - ₹30 = ₹120 + Tax (delivery free)

**Example 2 (Percentage Discount):**
- **Item Price**: ₹150 (Chamomile Herbal Tea)
- **Discount**: 20% (max ₹50 cap)
- **Free Delivery**: Yes (via `type_meta.free_delivery: true`)
- **Discount Amount**: ₹150 × 20% = ₹30 (within ₹50 cap)
- **Final Price**: ₹150 - ₹30 = ₹120 + Tax (delivery free)

**Discount Types Supported:**
- ✅ **Flat Discount**: Fixed rupee amount (e.g., ₹30 off)
- ✅ **Percentage Discount**: Percentage of item price with optional max cap (e.g., 20% off, max ₹50)
- ✅ **Free Delivery**: Can be combined with either discount type

**Process:**
1. Create coupon with type `PREORDER`
2. Store item_id in `type_meta`
3. Set `global_usage_limit: 100`
4. Set `user_usage_limit: 1`
5. Set `applicable_store_ids` to specific store
6. Initialize Redis quota: `SET coupon:quota:<coupon_id> 100`

### 2. User Adds Preorder Item to Cart

**API**: `POST /api/buyer/cart/add` (existing endpoint with preorder validation)

```json
{
  "restaurant_id": 87,
  "item_id": 653,
  "quantity": 1,
  "customizations": [...],
  "variants": [...],
  "is_preorder": true,  // NEW flag
  "campaign_id": 1      // NEW - optional, can be auto-detected
}
```

**Cart Service Validation:**
1. Check if item has active preorder campaign
2. Validate user hasn't already reserved (check coupon user_usage_limit)
3. Validate quantity = 1 (preorder restriction)
4. Validate slots available
5. **Auto-apply preorder coupon** to cart
6. Add to cart with `is_preorder: true` flag

**Auto-Apply Coupon Logic:**
- When preorder item is added, automatically find and apply the PREORDER coupon
- Store coupon_id in cart.coupon_id
- Calculate discount immediately and update cart totals
- User does NOT need to enter coupon code manually

### 3. User Checks Out Cart with Preorder Items

**API**: `POST /api/buyer/orders` (existing endpoint with preorder handling)

```json
{
  "delivery_address_id": 123,
  "payment_method": "online"
}
```

**Internal Flow:**
1. Get user's cart
2. **Check for preorder items in cart**
3. **For each preorder item:**
   - Find active PREORDER coupon (already applied)
   - Reserve coupon (get reservation_token)
   - Store reservation_token in cart metadata
4. **Calculate final order amount:**
   - If cart has preorder items: Item price - discount + tax (delivery free if applicable)
   - If cart has regular items: Item price + delivery fee + tax
5. Create Order from cart items
6. **For preorder items:**
   - Link order to coupon reservation
   - Call `POST /coupons/redeem` to finalize
7. Initiate payment flow

**Cart Restriction:**
- Cart can contain EITHER preorder items OR regular items, NOT both
- This restriction is enforced because multiple deliveries are not supported
- If user tries to add regular item to cart with preorder items (or vice versa), validation will reject

### 4. Reservation Expiry

**Existing**: Coupon system already handles expiry via Redis TTL
- Reservation expires after 15 minutes (default)
- Quota automatically restored when reservation expires
- Background job can clean up expired reservations

## 📝 Implementation Details

### 1. Add Preorder Support to Cart

#### A. Update CartItem Entity

**File**: `src/cart/entities/cart-item.entity.ts`

```typescript
@Entity()
export class CartItem {
  // ... existing fields ...

  @Column({ type: "boolean", default: false })
  is_preorder: boolean; // NEW - Mark as preorder item

  @Column({ type: "bigint", nullable: true })
  preorder_campaign_id?: number; // NEW - Link to campaign

  @Column({ type: "uuid", nullable: true })
  preorder_reservation_token?: string; // NEW - Reservation token (set on checkout)
}
```

#### B. Update AddToCartDto

**File**: `src/buyer/dto/cart-request.dto.ts`

```typescript
export class AddToCartDto {
  // ... existing fields ...

  @ApiProperty({ description: "Is this a preorder item?", required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_preorder?: boolean;

  @ApiProperty({ description: "Preorder campaign ID", required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  campaign_id?: number;
}
```

#### C. Enhance Cart Service - Add Preorder Validation

**File**: `src/buyer/cart.service.ts`

Add to `addToCart()` method:

```typescript
async addToCart(userId: number, addToCartDto: AddToCartDto) {
  // ... existing validation ...

  // NEW: Preorder validation and auto-apply coupon
  if (addToCartDto.is_preorder) {
    // Validate preorder requirements
    const coupon = await this.validatePreorderItem(
      addToCartDto.item_id,
      addToCartDto.campaign_id,
      userId,
      addToCartDto.quantity,
    );

    // Auto-apply preorder coupon to cart
    if (coupon && cart) {
      // Check if cart already has a preorder item (only one allowed)
      const existingPreorderItem = cart.cart_items?.find(ci => ci.is_preorder);
      if (existingPreorderItem) {
        throw new BadRequestException(
          "Only one preorder item is allowed per cart. Please remove existing preorder item first."
        );
      }

      // Check if cart already has a coupon
      if (cart.coupon_id && cart.coupon_id !== coupon.id) {
        // If cart has different coupon, remove it (preorder takes priority)
        await this.removeCoupon(userId);
      }

      // Apply preorder coupon
      await this.applyCoupon(userId, { code: coupon.code });
    }
  }

  // ... rest of addToCart logic ...

  // When creating cart item, set preorder flag
  const cartItem = this.cartItemRepository.create({
    cart: { id: cart.id },
    item: { id: addToCartDto.item_id },
    quantity: addToCartDto.quantity,
    unit_price: itemPrice,
    total_price: itemPrice * addToCartDto.quantity,
    customizations: addToCartDto.customizations || null,
    variants: addToCartDto.variants || null,
    special_instructions: addToCartDto.special_instructions || null,
    is_preorder: addToCartDto.is_preorder || false, // NEW
    preorder_campaign_id: addToCartDto.campaign_id || null, // NEW
  });

  // ... save cart item ...
}

/**
 * Validate preorder item before adding to cart
 * Returns the coupon if valid
 */
private async validatePreorderItem(
  itemId: number,
  campaignId: number | undefined,
  userId: number,
  quantity: number,
): Promise<Coupon> {
  // Quantity must be 1 for preorders
  if (quantity !== 1) {
    throw new BadRequestException(
      "Preorder items can only be added with quantity 1",
    );
  }

  // Find active PREORDER coupon for this item
  const coupon = await this.couponRepository.findOne({
    where: {
      type: CouponType.PREORDER,
      status: CouponStatus.ACTIVE,
      type_meta: { item_id: itemId }, // JSONB query
      ...(campaignId && { campaign_id: campaignId }),
    },
  });

  if (!coupon) {
    throw new BadRequestException(
      "No active preorder campaign found for this item",
    );
  }

  // Check campaign is active (time-based)
  const now = new Date();
  if (coupon.start_at && now < coupon.start_at) {
    throw new BadRequestException("Preorder campaign has not started yet");
  }
  if (coupon.end_at && now > coupon.end_at) {
    throw new BadRequestException("Preorder campaign has ended");
  }

  // Check quota available
  const quota = await this.redisCouponService.getQuota(coupon.id);
  if (quota !== null && quota <= 0) {
    throw new BadRequestException("All preorder slots are taken");
  }

  // Check user hasn't already reserved (via coupon user_usage_limit validation)
  // This will be checked again during checkout

  return coupon; // Return coupon for auto-apply
}
```

#### D. Update BuyerModule - Register Coupon Entities

**File**: `src/buyer/buyer.module.ts`

**IMPORTANT**: Before injecting CouponRepository and CouponRedemptionRepository in services, these entities must be registered in TypeOrmModule.forFeature().

```typescript
import { Coupon } from "../coupon/entities/coupon.entity";
import { CouponRedemption } from "../coupon/entities/coupon-redemption.entity";

@Module({
  imports: [
    // ... existing imports ...
    CouponModule, // Already imported ✅
  ],
  // ...
  TypeOrmModule.forFeature([
    // ... existing entities ...
    Coupon, // NEW - Required for CouponRepository injection
    CouponRedemption, // NEW - Required for CouponRedemptionRepository injection
  ]),
})
export class BuyerModule {}
```

**Note**: CouponModule is already imported, which provides CouponService and RedisCouponService. However, to inject repositories directly, the entities must be registered in TypeOrmModule.forFeature().

#### E. Enhance Order Service - Add Required Dependencies

**File**: `src/buyer/order.service.ts`

Add required imports and inject dependencies:

```typescript
import { Coupon } from "../coupon/entities/coupon.entity";
import { CouponRedemption } from "../coupon/entities/coupon-redemption.entity";
import { CouponService } from "../coupon/services/coupon.service";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { CouponType } from "../coupon/entities/coupon.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class OrderService {
  constructor(
    // ... existing repositories ...
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>, // Already exists
    
    // NEW: Add these for preorder support
    @InjectRepository(CouponRedemption)
    private readonly couponRedemptionRepository: Repository<CouponRedemption>,
    
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    
    private readonly couponService: CouponService,
    private readonly redisCouponService: RedisCouponService,
  ) {}
}
```

#### F. Enhance Order Service - Handle Preorder Items in Cart

**File**: `src/buyer/order.service.ts`

Modify `createOrder()` method:

```typescript
async createOrder(userId: number, createOrderDto: CreateOrderDto) {
  // ... existing cart retrieval ...
  
  // Get delivery address (needed for pincode in reservation)
  const deliveryAddress = await this.userAddressRepository.findOne({
    where: { id: createOrderDto.delivery_address_id, user: { id: userId } },
  });

  if (!deliveryAddress) {
    throw new NotFoundException("Delivery address not found");
  }

  // NEW: Re-validate preorder campaigns before checkout
  const preorderItems = cart.cart_items.filter(ci => ci.is_preorder);
  
  if (preorderItems.length > 0) {
    if (preorderItems.length > 1) {
      throw new BadRequestException(
        "Multiple preorder items found in cart. Only one preorder item is allowed."
      );
    }

    // Re-validate campaign status and quota
    const cartItem = preorderItems[0];
    const coupon = await this.couponRepository.findOne({
      where: {
        type: CouponType.PREORDER,
        id: cartItem.preorder_campaign_id,
        type_meta: { item_id: cartItem.item.id },
      },
    });

    if (!coupon) {
      throw new BadRequestException(
        `Preorder campaign not found for item ${cartItem.item.id}`
      );
    }

    // Re-validate campaign is active (time-based)
    const now = new Date();
    if (coupon.start_at && now < coupon.start_at) {
      throw new BadRequestException("Preorder campaign has not started yet");
    }
    if (coupon.end_at && now > coupon.end_at) {
      throw new BadRequestException("Preorder campaign has ended");
    }

    // Re-validate quota
    const quota = await this.redisCouponService.getQuota(coupon.id);
    if (quota !== null && quota <= 0) {
      throw new BadRequestException("All preorder slots are taken");
    }

    // Reserve the single preorder item before creating order
    const reservationToken = await this.reservePreorderFromCart(
      userId,
      cartItem,
      deliveryAddress.pincode,
    );
    
    // Update cart item with reservation token
    cartItem.preorder_reservation_token = reservationToken;
    await this.cartItemRepository.save(cartItem);
  }

  // ... continue with order creation ...
}

/**
 * Reserve preorder item from cart
 */
private async reservePreorderFromCart(
  userId: number,
  cartItem: CartItem,
  pincode: string,
): Promise<string> {
  // Find PREORDER coupon
  const coupon = await this.couponRepository.findOne({
    where: {
      type: CouponType.PREORDER,
      id: cartItem.preorder_campaign_id || undefined,
      type_meta: { item_id: cartItem.item.id },
    },
  });

  if (!coupon) {
    throw new BadRequestException(
      `Preorder campaign not found for item ${cartItem.item.id}`,
    );
  }

  // Reserve coupon using correct DTO structure
  const reservation = await this.couponService.reserveCoupon({
    code: coupon.code,
    user_id: userId,
    store_id: cartItem.cart.store.id,
    cart_total: cartItem.total_price,
    pincode: pincode, // Required field
  });

  // reserveCoupon returns { reservation_token, expires_in_seconds }
  return reservation.reservation_token;
}
```

#### G. Update OrderItem Entity

**File**: `src/order/entities/order-item.entity.ts`

```typescript
@Entity()
export class OrderItem {
  // ... existing fields ...

  @Column({ type: "boolean", default: false })
  is_preorder: boolean; // NEW - Mark as preorder item

  @Column({ type: "bigint", nullable: true })
  preorder_campaign_id?: number; // NEW - Link to campaign
}
```

#### H. Update Order Creation to Handle Preorders

**File**: `src/buyer/order.service.ts`

In `createOrder()`, after creating order, update order items creation to include preorder fields:

```typescript
// Create order items from cart items
const orderItems = cart.cart_items.map((cartItem) =>
  this.orderItemRepository.create({
    order: { id: savedOrder.id },
    item: { id: cartItem.item.id },
    quantity: cartItem.quantity,
    unit_price: cartItem.unit_price,
    total_price: cartItem.total_price,
    customizations: cartItem.customizations,
    variants: cartItem.variants,
    special_instructions: cartItem.special_instructions, // Include special instructions
    is_preorder: cartItem.is_preorder || false, // NEW
    preorder_campaign_id: cartItem.preorder_campaign_id || null, // NEW
  }),
);

await this.orderItemRepository.save(orderItems);

// NEW: If preorder, redeem coupon after order is created
const preorderItems = cart.cart_items.filter(ci => ci.is_preorder && ci.preorder_reservation_token);

for (const cartItem of preorderItems) {
  await this.couponService.redeemCoupon({
    reservation_token: cartItem.preorder_reservation_token,
    order_id: savedOrder.id,
    user_id: userId,
    payment_status: createOrderDto.payment_method === "cod" 
      ? PaymentStatus.PAID 
      : PaymentStatus.PENDING, // Will be updated on payment success
    // Note: idempotency_key is optional but recommended for idempotency
  });
}
```

### 2. Auto-Apply Preorder Coupon in Cart

**File**: `src/buyer/cart.service.ts`

When a preorder item is added to cart, automatically apply the PREORDER coupon:

```typescript
async addToCart(userId: number, addToCartDto: AddToCartDto) {
  // ... existing validation ...

  if (addToCartDto.is_preorder) {
    // Validate and get coupon
    const coupon = await this.validatePreorderItem(...);

    // Auto-apply coupon
    if (coupon && cart) {
      // Remove existing coupon if different
      if (cart.coupon_id && cart.coupon_id !== coupon.id) {
        await this.removeCoupon(userId);
      }

      // Apply preorder coupon
      await this.applyCoupon(userId, { code: coupon.code });
    }
  }

  // ... rest of logic ...
}
```

**Key Points:**
- ✅ Coupon is **automatically applied** - user doesn't need to enter code
- ✅ If cart already has a different coupon, it's removed (preorder takes priority)
- ✅ Discount is calculated immediately and reflected in cart totals
- ✅ Cart response includes applied coupon details

### 3. Cart Validation - Prevent Mixing Preorder and Regular Items

**File**: `src/buyer/cart.service.ts`

Add validation in `addToCart()` to prevent mixing preorder and regular items:

```typescript
async addToCart(userId: number, addToCartDto: AddToCartDto) {
  // ... existing validation ...

  // Get or create active cart
  let cart = await this.cartRepository
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.cart_items", "ci")
    .leftJoinAndSelect("c.store", "s")
    .leftJoin("c.user", "u")
    .where("u.id = :userId", { userId })
    .andWhere("c.is_active = :isActive", { isActive: true })
    .getOne();

  // NEW: Validate cart restrictions
  if (cart && cart.cart_items && cart.cart_items.length > 0) {
    const hasPreorderItems = cart.cart_items.some(ci => ci.is_preorder);
    const isAddingPreorder = addToCartDto.is_preorder === true;

    // Prevent mixing preorder and regular items
    if (hasPreorderItems && !isAddingPreorder) {
      throw new BadRequestException(
        "Cannot add regular items to cart with preorder items. Please clear your cart first."
      );
    }

    if (!hasPreorderItems && isAddingPreorder) {
      throw new BadRequestException(
        "Cannot add preorder items to cart with regular items. Please clear your cart first."
      );
    }

    // Prevent multiple preorder items (only one preorder item allowed per cart)
    if (hasPreorderItems && isAddingPreorder) {
      throw new BadRequestException(
        "Only one preorder item is allowed per cart. Please remove existing preorder item first."
      );
    }
  }

  // ... rest of addToCart logic ...
}
```

### 4. Enhance Cart Operations - Remove, Update, Clear

#### A. Remove Preorder Item - Coupon Cleanup

**File**: `src/buyer/cart.service.ts`

Update `removeFromCart()` method to handle preorder items:

```typescript
async removeFromCart(userId: number, removeFromCartDto: RemoveFromCartDto) {
  // ... existing code to fetch and remove cartItem ...

  const cartId = cartItem.cart.id;
  
  // NEW: Release reservation if preorder item has reservation token
  if (cartItem.is_preorder && cartItem.preorder_reservation_token) {
    // Release reservation and restore quota
    await this.redisCouponService.releaseReservation(
      cartItem.preorder_campaign_id,
      cartItem.preorder_reservation_token
    );
  }

  await this.cartItemRepository.remove(cartItem);

  // Check if cart is empty
  const remainingItems = await this.cartItemRepository.count({
    where: { cart: { id: cartId } },
  });

  if (remainingItems === 0) {
    // Deactivate empty cart
    await this.cartRepository.update(cartId, { is_active: false });
    // Remove coupon if exists
    if (cart.coupon_id) {
      await this.removeCoupon(userId);
    }
  } else {
    // NEW: Check if any preorder items remain
    const remainingPreorderItems = await this.cartItemRepository.count({
      where: { 
        cart: { id: cartId },
        is_preorder: true 
      },
    });

    // If no preorder items remain, remove coupon
    if (remainingPreorderItems === 0 && cart.coupon_id) {
      const coupon = await this.couponRepository.findOne({
        where: { id: cart.coupon_id },
      });
      
      if (coupon && coupon.type === CouponType.PREORDER) {
        await this.removeCoupon(userId);
      }
    }

    // Update cart totals
    await this.updateCartTotals(cartId);
  }

  // ... rest of method ...
}
```

#### B. Update Cart Item - Preorder Quantity Validation

**File**: `src/buyer/cart.service.ts`

Update `updateCartItem()` method to prevent quantity changes for preorder items:

```typescript
async updateCartItem(userId: number, updateCartItemDto: UpdateCartItemDto) {
  // ... existing code to fetch cartItem ...

  // NEW: Prevent quantity changes for preorder items
  if (cartItem.is_preorder && updateCartItemDto.quantity !== 1) {
    throw new BadRequestException(
      "Preorder items cannot have quantity changed. Quantity must be 1."
    );
  }

  // If preorder item, force quantity to 1
  if (cartItem.is_preorder) {
    updateCartItemDto.quantity = 1;
  }

  // ... rest of update logic ...
}
```

#### C. Clear Cart - Coupon Cleanup

**File**: `src/buyer/cart.service.ts`

Update `clearCart()` method to remove coupon:

```typescript
async clearCart(userId: number) {
  // ... existing code to fetch cart ...

  if (cart) {
    // NEW: Release reservations for preorder items
    const preorderItems = cart.cart_items?.filter(ci => 
      ci.is_preorder && ci.preorder_reservation_token
    ) || [];

    for (const cartItem of preorderItems) {
      // Release reservation and restore quota
      await this.redisCouponService.releaseReservation(
        cartItem.preorder_campaign_id,
        cartItem.preorder_reservation_token
      );
    }

    // Remove all cart items
    await this.cartItemRepository.delete({ cart: { id: cart.id } });

    // NEW: Remove coupon if exists
    if (cart.coupon_id) {
      await this.removeCoupon(userId);
    }

    // Deactivate cart
    await this.cartRepository.update(cart.id, { is_active: false });
  }

  // ... rest of method ...
}
```

### 5. Simplified Cart Calculation

**File**: `src/buyer/cart.service.ts`

Since cart can only have one type (preorder OR regular), calculation is simplified:

```typescript
private async calculateCartSummary(cart: Cart): Promise<CartSummary> {
  const cartItems = cart.cart_items || [];
  
  // Calculate subtotal
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.total_price),
    0,
  );

  // Get applied coupon (should be preorder coupon if cart has preorder items)
  let discountAmount = 0;
  let deliveryWaived = false;
  
  if (cart.coupon_id) {
    const coupon = await this.couponRepository.findOne({
      where: { id: cart.coupon_id },
    });

    if (coupon && coupon.type === CouponType.PREORDER) {
      // Calculate discount for preorder items
      const { discount_amount, delivery_waived } = 
        await this.couponService.calculateDiscount(
          coupon,
          subtotal,
        );
      
      discountAmount = discount_amount;
      deliveryWaived = delivery_waived || coupon.type_meta?.free_delivery === true;
    }
  }

  // Calculate delivery fee (only if not waived by preorder)
  let deliveryFee = 0;
  if (!deliveryWaived) {
    deliveryFee = await this.calculateDeliveryFee(cart.store, cart.user);
  }

  // Calculate tax
  const finalSubtotal = subtotal - discountAmount;
  const taxAmount = this.calculateTax(finalSubtotal, cart.store);

  // Final amount
  const finalAmount = finalSubtotal + deliveryFee + taxAmount + (cart.tip_amount || 0);

  return {
    subtotal: subtotal,
    delivery_fee: deliveryFee,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    tip_amount: cart.tip_amount || 0,
    final_amount: finalAmount,
    // ... other fields
  };
}
```

**Calculation Example (Single Preorder Item with Flat Discount):**

Cart contains one preorder item:
- Preorder item: ₹150 (Chamomile Herbal Tea)
- Preorder discount: ₹30 (flat discount)
- Preorder free delivery: Yes
- Tax: 5%

**Calculation:**
```
Subtotal: ₹150
Discount: ₹30 (flat discount)
After discount: ₹150 - ₹30 = ₹120
Delivery: ₹0 (free delivery)
Tax: ₹120 × 5% = ₹6
Final: ₹120 + ₹0 + ₹6 = ₹126
```

**Calculation Example (Single Preorder Item with Percentage Discount):**

Cart contains one preorder item:
- Preorder item: ₹150 (Chamomile Herbal Tea)
- Preorder discount: 20% (max ₹50 cap)
- Preorder free delivery: Yes
- Tax: 5%

**Calculation:**
```
Subtotal: ₹150
Discount: ₹150 × 20% = ₹30 (within ₹50 cap)
After discount: ₹150 - ₹30 = ₹120
Delivery: ₹0 (free delivery)
Tax: ₹120 × 5% = ₹6
Final: ₹120 + ₹0 + ₹6 = ₹126
```

**Note:** Only one preorder item is allowed per cart. If user tries to add a second preorder item, validation will reject with error: "Only one preorder item is allowed per cart. Please remove existing preorder item first."

### 4. Enhanced Coupon Validation

**File**: `src/coupon/services/coupon.service.ts`

Add to `runValidationChecks()` method:

```typescript
// After existing validations, add PREORDER-specific checks
if (coupon.type === CouponType.PREORDER) {
  // Validate item_id matches (if provided in DTO)
  if (coupon.type_meta?.item_id && dto.item_id) {
    if (coupon.type_meta.item_id !== dto.item_id) {
      return {
        valid: false,
        reason_code: "INVALID_ITEM",
        message: "This preorder is not for this item",
      };
    }
  }

  // NOTE: Cart can only contain preorder items OR regular items, not both
  // This validation is handled in CartService.addToCart()
  // Preorder coupon only applies when cart contains preorder items
}
```

**Update `calculateDiscount()` method to handle PREORDER type:**

```typescript
private async calculateDiscount(
  coupon: Coupon,
  cartTotal: number,
): Promise<{ discount_amount: number; delivery_waived: boolean }> {
  let discountAmount = 0;
  let deliveryWaived = false;

  switch (coupon.type) {
    // ... existing cases ...

    case CouponType.PREORDER:
      // Preorder supports both flat and percentage discounts
      if (coupon.value_type === ValueType.PERCENT) {
        // Percentage discount with optional max cap
        const percentDiscount = (cartTotal * (coupon.value || 0)) / 100;
        discountAmount = Math.min(
          percentDiscount,
          coupon.max_discount_amount || Infinity,
        );
      } else {
        // Flat discount (value_type === ValueType.RUPEES)
        // Fixed rupee amount off the item price
        discountAmount = Math.min(coupon.value || 0, cartTotal);
      }

      // Check if free delivery is included
      deliveryWaived = coupon.type_meta?.free_delivery === true;
      break;

    // ... other cases ...
  }

  return {
    discount_amount: Math.max(0, discountAmount),
    delivery_waived: deliveryWaived,
  };
}
```

### 2. Enhanced Reservation Metadata

**File**: `src/coupon/services/coupon.service.ts`

Modify `reserveCoupon()` to store item-specific data:

```typescript
// In createReservation() method, enhance metadata:
const metadata = {
  coupon_id: coupon.id,
  user_id: dto.user_id,
  item_id: coupon.type_meta?.item_id,
  store_id: dto.store_id || coupon.applicable_store_ids?.[0],
  cart_total: dto.cart_total,
  customizations: dto.customizations || [],
  variants: dto.variants || [],
  preorder: true,
  delivery_date: coupon.type_meta?.delivery_date,
};
```

### 3. Reservation Release Methods

**Note**: The coupon service already has methods for releasing reservations. Use them as follows:

**File**: `src/coupon/services/redis-coupon.service.ts`

**Existing Method**: `releaseReservation(couponId: number, reservationToken: string)`
- Releases reservation and increments quota
- Already implemented ✅

**Existing Method**: `incrementQuota(couponId: number, amount: number = 1)`
- Increments quota for a coupon
- Already implemented ✅

**Usage in CartService and OrderService**:

```typescript
// To release reservation and restore quota:
await this.redisCouponService.releaseReservation(
  cartItem.preorder_campaign_id,
  cartItem.preorder_reservation_token
);

// Or to just increment quota:
await this.redisCouponService.incrementQuota(couponId, 1);
```

**File**: `src/coupon/services/coupon.service.ts`

**Existing Method**: `rollbackCoupon(dto: RollbackCouponDto)`
- Can be used for rolling back reservations
- Already implemented ✅

### 4. Modify Redemption for Preorders

**File**: `src/coupon/services/coupon.service.ts`

**Note**: For cart-based flow, preorder coupons are redeemed during order creation in `OrderService.createOrder()`. The redemption happens after the order is created, not as a separate step.

The existing `redeemCoupon()` method can handle PREORDER type coupons by:
1. Validating the reservation token
2. Updating coupon counters
3. Creating CouponRedemption record
4. Returning success (order is already created by OrderService)

```typescript
async redeemCoupon(dto: RedeemCouponDto): Promise<{
  success: boolean;
  discount_amount?: number;
  delivery_waived?: boolean;
}> {
  // ... existing validation code ...

  // For PREORDER type, order is already created by OrderService
  // This method just finalizes the coupon redemption
  if (coupon.type === CouponType.PREORDER) {
    // Order already exists (created in OrderService.createOrder())
    // Just update counters and create redemption record
    // ... existing redemption logic ...
    
    return {
      success: true,
      discount_amount: 0, // Discount already applied in cart
      delivery_waived: coupon.type_meta?.free_delivery === true,
    };
  }

  // ... existing discount logic for other coupon types ...
}
```

### 3. Enhance Item DTOs with Preorder Info

**Files to Update:**
- `src/buyer/dto/menu-response.dto.ts` - MenuItemDto
- `src/buyer/dto/restaurant-details.dto.ts` - RestaurantItemDto
- `src/buyer/dto/search-response.dto.ts` - SearchItemDto

**Add to each item DTO:**

```typescript
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
```

### 4. Cart Response with Preorder Info

**File**: `src/buyer/dto/cart-response.dto.ts`

Update `CartItemResponseDto`:

```typescript
export class CartItemResponseDto {
  // ... existing fields ...

  @ApiProperty({ description: "Is this a preorder item?", required: false })
  is_preorder?: boolean;

  @ApiProperty({ description: "Preorder campaign info", required: false })
  preorder_campaign?: {
    id: number;
    title: string;
    delivery_date: string;
    available_slots: number;
  };
}
```

### 5. Update BuyerModule for BuyerService Dependencies

**File**: `src/buyer/buyer.module.ts`

**Note**: Coupon and CouponRedemption entities should already be added in Section D above. If not, add them to TypeOrmModule.forFeature().

### 6. Enhance Item Services to Include Preorder Info

**File**: `src/buyer/buyer.service.ts`

**First, add required dependencies to BuyerService constructor:**

```typescript
import { Coupon } from "../coupon/entities/coupon.entity";
import { CouponService } from "../coupon/services/coupon.service";
import { RedisCouponService } from "../coupon/services/redis-coupon.service";
import { CouponType } from "../coupon/entities/coupon.entity";
import { CouponStatus } from "../coupon/entities/coupon.entity";

@Injectable()
export class BuyerService {
  constructor(
    // ... existing repositories ...
    
    // NEW: Add these for preorder support
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    
    private readonly redisCouponService: RedisCouponService,
  ) {}
}
```

**Update methods that return items:**
- `getRestaurantMenu()` - Add preorder info to menu items
- `getRestaurantDetails()` - Add preorder info to restaurant items
- `searchItems()` - Add preorder info to search results

**Helper Method:**
```typescript
private async enrichItemWithPreorderInfo(
  item: any,
  storeId: number
): Promise<void> {
  // Find active PREORDER coupon for this item
  // Note: TypeORM JSONB query syntax may vary - adjust based on your setup
  const preorderCoupon = await this.couponRepository
    .createQueryBuilder("coupon")
    .where("coupon.type = :type", { type: CouponType.PREORDER })
    .andWhere("coupon.status = :status", { status: CouponStatus.ACTIVE })
    .andWhere("coupon.type_meta->>'item_id' = :itemId", { itemId: item.id.toString() })
    .andWhere(":storeId = ANY(coupon.applicable_store_ids)", { storeId })
    .getOne();

  if (!preorderCoupon) return;

  // Check if campaign is active (time-based)
  const now = new Date();
  const isActive = 
    (!preorderCoupon.start_at || now >= preorderCoupon.start_at) &&
    (!preorderCoupon.end_at || now <= preorderCoupon.end_at);

  if (!isActive) return;

  // Get available slots
  const quota = await this.redisCouponService.getQuota(preorderCoupon.id);
  const availableSlots = quota !== null ? quota : preorderCoupon.global_usage_limit || 0;

  if (availableSlots > 0) {
    item.is_preorder_available = true;
    item.preorder_campaign = {
      id: preorderCoupon.campaign_id,
      title: preorderCoupon.type_meta?.title || "Preorder",
      available_slots: availableSlots,
      delivery_date: preorderCoupon.type_meta?.delivery_date,
      discount_amount: preorderCoupon.value || 0,
      free_delivery: preorderCoupon.type_meta?.free_delivery === true,
    };
  }
}
```

**Usage in each method:**
```typescript
// In getRestaurantMenu(), getRestaurantDetails(), searchItems():
for (const item of items) {
  await this.enrichItemWithPreorderInfo(item, storeId);
}
```

### 6. Update RedeemCouponDto

**File**: `src/coupon/dto/redeem-coupon.dto.ts`

Add fields for preorder:

```typescript
export class RedeemCouponDto {
  // ... existing fields ...

  @ApiProperty({ description: "Delivery address ID (for preorders)", required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  delivery_address_id?: number;

  @ApiProperty({ description: "Payment method (for preorders)", required: false })
  @IsOptional()
  @IsString()
  payment_method?: string;
}
```


## 🔐 Validation Rules

### Campaign Validation (Reuse Coupon Validation)
- ✅ Coupon exists and is active
- ✅ Campaign is active
- ✅ Current time is within start_at and end_at
- ✅ Quota available (global_usage_limit)
- ✅ Per-user limit not exceeded (user_usage_limit: 1)
- ✅ Store eligibility (applicable_store_ids)

### Preorder-Specific Validation (NEW)
- ✅ Coupon type is PREORDER
- ✅ Item ID matches type_meta.item_id
- ✅ Cart can only contain preorder items OR regular items, not both
- ✅ Preorder coupon only applies when cart contains preorder items
- ✅ User hasn't already reserved (enforced by user_usage_limit)

## 🚀 API Endpoints

### Buyer APIs

#### Cart APIs (Enhanced)

##### 1. Add Preorder Item to Cart
```
POST /api/buyer/cart/add
Body: {
  "restaurant_id": 87,
  "item_id": 653,
  "quantity": 1,
  "is_preorder": true,
  "campaign_id": 1,
  "customizations": [],
  "variants": []
}
```

**Validation:**
- Quantity must be 1
- Preorder campaign must be active
- Slots must be available
- User hasn't already reserved

##### 2. Get Cart (Shows Preorder Info)
```
GET /api/buyer/cart
```

**Response includes:**
```json
{
  "cart_items": [
    {
      "id": 123,
      "item": {...},
      "quantity": 1,
      "is_preorder": true,
      "preorder_campaign": {
        "id": 1,
        "title": "Chamomile Herbal Tea - Preorder",
        "delivery_date": "2025-12-15T00:00:00Z",
        "available_slots": 55
      },
      "reservation_status": "pending"
    }
  ]
}
```

##### 3. Checkout Cart with Preorders
```
POST /api/buyer/orders
Body: {
  "delivery_address_id": 123,
  "payment_method": "online"
}
```

**Process:**
1. Validates cart
2. Reserves preorder items (if not already reserved)
3. Creates order
4. Redeems preorder coupons
5. Initiates payment

### Admin APIs (Use Existing)

#### 1. Create Preorder Campaign
```
POST /api/admin/coupons/generate
```
(With PREORDER type and type_meta)

#### 2. Get Campaign Stats
```
GET /api/admin/coupons/:id/stats
```

## 🔄 Integration Points

### 1. Order Service
- Handle preorder items in cart during checkout
- Reserve preorder coupons during order creation
- Redeem preorder coupons after order creation
- Link orders to coupon via metadata

### 2. Coupon Service
- Add PREORDER type handling
- Enhance validation for item_id
- Modify redemption for order creation

### 3. Payment Service
- Same payment flow as regular orders
- On payment success, coupon redemption happens automatically

### 4. Notification Service
- Send notification on reservation success
- Send reminder before expiry
- Send notification on campaign start/end

## 📊 Monitoring & Analytics

### Metrics to Track
- Total reservations per campaign (via coupon counters)
- Conversion rate (reserved → confirmed)
- Expiry rate
- Average time to confirm
- Campaign performance by store/item

### Using Existing Coupon Counters
- `CouponCounter` table tracks usage
- Redis quota tracks available slots
- `CouponRedemption` tracks confirmed preorders

## ⚠️ Edge Cases & Error Handling

### 1. Concurrent Reservations
- **Handled by**: Redis LUA script (atomic) ✅
- **Implementation**: Coupon service uses atomic operations

### 2. Reservation Expiry
- **Handled by**: Redis TTL ✅
- **Default TTL**: 15 minutes
- **Behavior**: Quota automatically restored when reservation expires

### 3. Payment Failure
- **Handling**: Release reservation and restore quota on payment failure
- **Implementation**: In payment failure handler, check for preorder items and release reservations

**File**: `src/buyer/order.service.ts`

**Option 1: If payment fails after order creation:**

```typescript
// In payment failure handler (e.g., in verifyPayment() or payment failure callback):
// Get the order that failed payment
const order = await this.orderRepository.findOne({
  where: { id: orderId },
  relations: ['order_items'],
});

if (order) {
  // Check if order has preorder items
  const preorderOrderItems = order.order_items.filter(oi => oi.is_preorder);
  
  for (const orderItem of preorderOrderItems) {
    // Find coupon redemption to get reservation token
    const couponRedemption = await this.couponRedemptionRepository.findOne({
      where: { order_id: orderId },
      relations: ['coupon'],
    });

    if (couponRedemption && couponRedemption.reserved_token) {
      // Release reservation and restore quota
      await this.redisCouponService.releaseReservation(
        couponRedemption.coupon_id,
        couponRedemption.reserved_token
      );
    }
  }
}
```

**Option 2: If payment fails before order creation (from cart):**

```typescript
// If payment fails before order creation, release from cart:
const cart = await this.cartRepository.findOne({
  where: { user: { id: userId }, is_active: true },
  relations: ['cart_items'],
});

if (cart) {
  const preorderItems = cart.cart_items.filter(ci => 
    ci.is_preorder && ci.preorder_reservation_token
  );

  for (const cartItem of preorderItems) {
    await this.redisCouponService.releaseReservation(
      cartItem.preorder_campaign_id,
      cartItem.preorder_reservation_token
    );
  }
}
```

### 4. Campaign End During Checkout
- **Handling**: Re-validate campaign status during checkout
- **Implementation**: Before reserving, check if campaign is still active (see Section F in Order Creation)

### 5. Quota Exhaustion During Checkout
- **Handling**: Re-validate quota availability during checkout
- **Implementation**: Before reserving, check if quota is still available (see Section F in Order Creation)

### 6. User Already Reserved
- **Enforced by**: `user_usage_limit: 1` ✅
- **Validation**: Checked during coupon reservation

### 7. Order Cancellation - Quota Restoration

**File**: `src/buyer/order.service.ts`

Update `cancelOrder()` method to restore quota for preorder orders:

```typescript
async cancelOrder(
  userId: number,
  orderId: number,
  cancelOrderDto: CancelOrderDto,
) {
  // ... existing cancellation logic ...

  // NEW: Restore quota for preorder items
  const orderItems = await this.orderItemRepository.find({
    where: { order: { id: orderId } },
    relations: ['item'],
  });

  for (const orderItem of orderItems) {
    if (orderItem.is_preorder) {
      // Find the coupon redemption for this order
      const couponRedemption = await this.couponRedemptionRepository.findOne({
        where: { order_id: orderId },
        relations: ['coupon'],
      });

      if (couponRedemption && couponRedemption.coupon.type === CouponType.PREORDER) {
        // Restore quota in Redis
        await this.redisCouponService.incrementQuota(couponRedemption.coupon.id, 1);
        
        // Note: Optionally decrement coupon counter if needed
        // This depends on your counter logic
        // You may want to update CouponCounter.redeemed_count if tracking is needed
      }
    }
  }

  // ... rest of cancellation logic ...
}
```

**Note**: Make sure to import `CouponType` and inject `CouponRedemptionRepository` and `RedisCouponService` in OrderService constructor (see Section D above).

### 8. Cart Expiry - Reservation Cleanup

**File**: `src/buyer/cart.service.ts`

When cart is deactivated (expired), clean up reservations:

```typescript
// In cart deactivation logic (if exists):
const preorderItems = cart.cart_items.filter(ci => 
  ci.is_preorder && ci.preorder_reservation_token
);

for (const cartItem of preorderItems) {
  // Release reservation and restore quota
  await this.redisCouponService.releaseReservation(
    cartItem.preorder_campaign_id,
    cartItem.preorder_reservation_token
  );
}
```

## 🧪 Testing Strategy

1. **Unit Tests**: 
   - Preorder validation logic
   - Order creation from preorder
   - Coupon redemption for preorders

2. **Integration Tests**: 
   - API endpoints
   - Redis operations
   - Order creation flow

3. **Load Tests**: 
   - Concurrent reservation attempts (already tested in coupon system)

4. **Edge Case Tests**: 
   - Expiry, quota exhaustion, user limits

## 📝 Migration Plan

### Phase 1: Database Changes
1. ✅ Add PREORDER to CouponType enum
2. ✅ Create migration
3. ✅ Run migration

### Phase 2: Database Migrations
1. ✅ Create migration for PREORDER coupon type
2. ✅ Create migration for CartItem preorder fields
3. ✅ Create migration for OrderItem preorder fields
4. ✅ Run all migrations

### Phase 3: Core Services
1. ✅ Update BuyerModule - Register Coupon and CouponRedemption entities in TypeOrmModule.forFeature()
2. ✅ Update CouponService validation
3. ✅ Update CouponService discount calculation for PREORDER type
4. ✅ Add preorder fields to CartItem entity
5. ✅ Add preorder fields to OrderItem entity
6. ✅ Add required dependencies to OrderService (CouponRedemptionRepository, CouponRepository, CouponService, RedisCouponService)
7. ✅ Add required dependencies to BuyerService (CouponRepository, RedisCouponService)
7. ✅ Enhance CartService with preorder validation and auto-apply coupon
8. ✅ Enhance CartService with cart validation (prevent mixing preorder and regular items)
9. ✅ Enhance CartService removeFromCart() - coupon cleanup and reservation release
10. ✅ Enhance CartService updateCartItem() - prevent quantity changes for preorders
11. ✅ Enhance CartService clearCart() - coupon cleanup and reservation release
12. ✅ Enhance OrderService createOrder() - preorder reservation with correct DTO (pincode)
13. ✅ Enhance OrderService createOrder() - re-validate campaign status and quota
14. ✅ Enhance OrderService createOrder() - include preorder fields in OrderItem creation
15. ✅ Enhance OrderService createOrder() - redeem preorder coupon after order creation
16. ✅ Enhance OrderService cancelOrder() - restore quota for preorder orders
17. ✅ Enhance OrderService payment failure handler - release reservations
18. ✅ Enhance BuyerService enrichItemWithPreorderInfo() - helper method for preorder info
19. ✅ Enhance BuyerService to include preorder info in item APIs (menu, details, search)
20. ✅ Update item DTOs to include preorder_campaign field

### Phase 4: Testing & Validation
1. ✅ Test cart-based flow end-to-end
2. ✅ Test cart restriction (prevent mixing preorder and regular items)
3. ✅ Test auto-apply coupon logic
4. ✅ Test checkout with preorder items
5. ✅ Test remove preorder item - coupon cleanup
6. ✅ Test update preorder item - quantity validation
7. ✅ Test clear cart - coupon cleanup
8. ✅ Test order cancellation - quota restoration
9. ✅ Test payment failure - reservation release
10. ✅ Test checkout validation - campaign re-check
11. ✅ Test reservation token cleanup

### Phase 5: Testing
1. ✅ Unit tests
2. ✅ Integration tests
3. ✅ End-to-end testing
4. ✅ Edge case testing
5. ✅ Concurrency testing

### Phase 5: Deployment
1. ✅ Deploy to staging
2. ✅ Test with real data
3. ✅ Deploy to production

## ✅ Advantages of Coupon-Based Approach

1. **Reuse Existing Infrastructure**
   - Redis quota management ✅
   - Atomic reservation scripts ✅
   - Validation framework ✅
   - Counter tracking ✅

2. **Proven System**
   - Already tested and working
   - Handles edge cases
   - Scalable architecture

3. **Faster Implementation**
   - Less code to write
   - Reuse existing patterns
   - Faster time to market

4. **Unified Management**
   - Single admin interface for campaigns
   - Consistent API patterns
   - Shared monitoring

## ⚠️ Considerations

1. **Code Complexity**: Mixed concerns (discounts + preorders)
2. **API Design**: Wrapper APIs needed for better UX
3. **Future Extensions**: May need dedicated system later for complex features

### Complete User Flow

```
1. User browses items → Sees preorder badge on item
2. User taps "Add to Cart" (with is_preorder: true)
3. Backend validates preorder → Auto-applies coupon → Item added to cart
4. User views cart → Sees:
   - Preorder item with badge
   - Applied discount (e.g., "₹30 off")
   - Free delivery indicator
   - Campaign info (delivery date, slots available)
5. User proceeds to checkout
6. System reserves preorder items (if not already reserved)
7. Order created with:
   - Preorder items (with discount)
   - Calculated totals
9. Coupons redeemed for preorder items
10. Payment processed
11. Order confirmed → User can track order
```

### Detailed Step-by-Step

#### Step 1: User Adds Preorder to Cart

**Frontend:**
```typescript
POST /api/buyer/cart/add
{
  "restaurant_id": 87,
  "item_id": 653,
  "quantity": 1,
  "is_preorder": true,
  "campaign_id": 1
}
```

**Backend:**
1. Validates preorder campaign exists and is active
2. Validates slots available
3. Validates user hasn't already reserved
4. **Auto-applies PREORDER coupon**
5. Calculates discount immediately
6. Returns cart with updated totals

**Response:**
```json
{
  "success": true,
  "message": "Preorder item added to cart. ₹30 discount applied!",
  "cart": {
    "cart_items": [
      {
        "id": 123,
        "item": {...},
        "is_preorder": true,
        "quantity": 1,
        "unit_price": 150,
        "total_price": 150
      }
    ],
    "applied_coupon": {
      "code": "PREORDER-653-2025",
      "discount_amount": 30,
      "free_delivery": true
    },
    "summary": {
      "subtotal": 150,
      "discount_amount": 30,
      "delivery_fee": 0,
      "tax_amount": 6,
      "final_amount": 126
    }
  }
}
```

#### Step 2: User Views Cart

**Frontend:**
```typescript
GET /api/buyer/cart
```

**Response shows:**
- Preorder items with badge
- Applied discount breakdown
- Campaign info
- Final totals

**Note:** If user tries to add regular item to cart with preorder items, validation will reject with error message.

#### Step 3: User Checks Out

**Frontend:**
```typescript
POST /api/buyer/orders
{
  "delivery_address_id": 123,
  "payment_method": "online"
}
```

**Backend:**
1. Validates cart
2. Reserves preorder items (gets reservation_token)
3. Creates order with all items
4. Applies preorder discount to order
5. Redeems preorder coupon
6. Initiates payment

**Order Created:**
```json
{
  "id": 1537,
  "order_number": "ORD-20251209-982",
  "status": "pending_payment",
  "items": [
    {
      "item_id": 653,
      "item_name": "Chamomile Herbal Tea",
      "quantity": 1,
      "unit_price": 150,
      "total_price": 150,
      "is_preorder": true
    }
  ],
  "summary": {
    "subtotal": 150,
    "discount_amount": 30,
    "delivery_fee": 0,
    "tax_amount": 6,
    "final_amount": 126
  },
  "payment_details": {...}
}
```

#### Step 5: User Tracks Order

**Frontend:**
```typescript
GET /api/buyer/orders/1537
```

**Response:**
- Order details
- Status tracking
- Delivery date (from preorder campaign)
- All tracking updates

### Cart Validation Rules

1. **Preorder Quantity**: Must be exactly 1 per item
2. **Preorder Campaign**: Must be active and have available slots
3. **One Preorder Item Per Cart**: Only one preorder item allowed in cart at a time (regardless of campaign)
4. **User Limit**: User can only have 1 preorder item per campaign (enforced by coupon user_usage_limit)
5. **Cart Restriction**: Cart can contain EITHER preorder items OR regular items, NOT both (no multiple deliveries)
6. **Reservation Timing**: Preorder items are reserved during checkout, not when added to cart
7. **Coupon Application**: Only one preorder coupon can be applied per cart (since only one preorder item allowed)
8. **Discount Application**: Preorder discount applies to the single preorder item in cart

### Cart Item States

- **Pending Reservation**: Item in cart, not yet reserved
- **Reserved**: Reservation token obtained during checkout
- **Confirmed**: Order created, coupon redeemed

## ❓ Clarifications & Answers

### 1. Auto-Apply Coupon in Cart Page

**Answer: YES, auto-apply is required.**

- When a preorder item is added to cart, the PREORDER coupon is **automatically applied**
- User does NOT need to enter coupon code manually
- Coupon is applied immediately when item is added
- Cart totals reflect discount immediately
- If cart already has a different coupon, it's removed (preorder takes priority)

**Implementation:**
- In `CartService.addToCart()`, after validating preorder item, automatically call `applyCoupon()`
- Store `coupon_id` in cart entity
- Calculate discount in `calculateCartSummary()`

### 2. Multiple Items in Cart - Coupon Application

**Answer: Cart can only contain ONE preorder item OR regular items, not both.**

**Rules:**
- ❌ Cart CANNOT contain both preorder items and regular items
- ❌ Cart CANNOT contain multiple preorder items (only one preorder item allowed)
- ✅ Cart can contain only ONE preorder item (with preorder coupon applied)
- ✅ Cart can contain multiple regular items (no preorder coupon)
- ✅ If user tries to add regular item to cart with preorder item (or vice versa), validation will reject
- ✅ If user tries to add second preorder item, validation will reject
- ✅ Preorder coupon applies to the single preorder item in cart

**Example (Single Preorder Item):**
```
Cart contains one preorder item:
- Preorder item: ₹150 (Chamomile Tea) → Discount: ₹30

Calculation:
- Subtotal: ₹150
- Discount: ₹30
- Final subtotal: ₹120
```

**Error Scenarios:**
```
Scenario 1: User has preorder item → Tries to add regular item
→ Error: "Cannot add regular items to cart with preorder items. Please clear your cart first."

Scenario 2: User has preorder item → Tries to add another preorder item
→ Error: "Only one preorder item is allowed per cart. Please remove existing preorder item first."

Scenario 3: User has regular items → Tries to add preorder item
→ Error: "Cannot add preorder items to cart with regular items. Please clear your cart first."
```

### 3. Final Order Amount Calculation

**Answer: Depends on cart composition.**

**Scenario A: Only Preorder Item (Flat Discount)**
```
Item price: ₹150
Discount: ₹30 (flat discount)
Free delivery: Yes
Tax (5%): ₹6 (on ₹120)

Final amount: ₹150 - ₹30 + ₹0 + ₹6 = ₹126
```

**Scenario A1: Only Preorder Item (Percentage Discount)**
```
Item price: ₹150
Discount: 20% = ₹30 (with max cap ₹50)
Free delivery: Yes
Tax (5%): ₹6 (on ₹120)

Final amount: ₹150 - ₹30 + ₹0 + ₹6 = ₹126
```

**Formula:**
```
Final Amount = 
  (Subtotal - Discount) +
  (Delivery fee - waived if preorder has free delivery) +
  (Tax on final subtotal) +
  (Tip if any)
```

**Note:** Since cart can only contain preorder items OR regular items (not both), the calculation is straightforward:
- If preorder cart: Subtotal - Preorder discount + Tax + Tip (delivery free if applicable)
- If regular cart: Subtotal + Delivery fee + Tax + Tip (no preorder discount)

### 4. Order Tracking

**Answer: Same as regular orders.**

- Preorder orders are tracked exactly like regular orders
- Use existing order tracking system
- Order status flow: `pending_payment` → `paid` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`
- Tracking includes:
  - Order number
  - Status updates
  - Delivery agent details (if applicable)
  - Estimated delivery time
  - Delivery date (from preorder campaign)
- API: `GET /api/buyer/orders/:id` (existing endpoint)
- API: `GET /api/buyer/orders` (list all orders, includes preorders)

**Special Note:**
- Preorder orders may have a future delivery date (from campaign)
- This is stored in order metadata or can be derived from coupon redemption

### 5. Frontend and Backend Alignment

**Answer: YES, fully aligned. Here's the mapping:**

| Frontend Action | Backend Endpoint | Status |
|----------------|-----------------|--------|
| Add preorder to cart | `POST /api/buyer/cart/add` | ✅ Implemented |
| Get cart with preorder info | `GET /api/buyer/cart` | ✅ Implemented |
| Checkout cart | `POST /api/buyer/orders` | ✅ Implemented |
| Get order details | `GET /api/buyer/orders/:id` | ✅ Existing |
| Track order | `GET /api/buyer/orders/:id` | ✅ Existing |

**Data Flow Alignment:**

1. **Add to Cart:**
   - Frontend sends: `{ item_id, is_preorder: true, campaign_id }`
   - Backend: Validates, auto-applies coupon, returns cart with discount

2. **Cart Display:**
   - Frontend receives: Cart with `is_preorder`, `preorder_campaign`, applied coupon
   - Backend: Calculates totals with preorder discount

3. **Checkout:**
   - Frontend sends: `{ delivery_address_id, payment_method }`
   - Backend: Reserves preorder, creates order, redeems coupon, initiates payment

4. **Order Tracking:**
   - Frontend: Uses existing order detail API
   - Backend: Returns order with preorder metadata

**All APIs are aligned and ready for implementation.**

## 🎯 Next Steps

1. ✅ Review and approve this approach (Journey A: Cart-Based Flow finalized)
2. ✅ Create migrations for:
   - PREORDER coupon type
   - CartItem preorder fields
   - OrderItem preorder fields
3. ✅ Update entities:
   - CartItem entity (add preorder fields)
   - OrderItem entity (add preorder fields)
4. ✅ Update BuyerModule:
   - Register Coupon and CouponRedemption entities in TypeOrmModule.forFeature()
   - This enables repository injection in OrderService and BuyerService
5. ✅ Add required dependencies:
   - OrderService: CouponRedemptionRepository, CouponRepository, CouponService, RedisCouponService
   - BuyerService: CouponRepository, RedisCouponService
5. ✅ Implement CartService enhancements:
   - Auto-apply coupon logic
   - Cart validation (prevent mixing preorder and regular items)
   - Remove preorder item - coupon cleanup and reservation release
   - Update cart item - prevent quantity changes for preorders
   - Clear cart - coupon cleanup and reservation release
6. ✅ Add PREORDER discount calculation in CouponService
7. ✅ Update coupon validation (cart restriction handled in CartService)
8. ✅ Implement OrderService enhancements:
   - Preorder reservation with correct ReserveCouponDto (includes pincode)
   - Re-validate campaign status and quota during checkout
   - Include preorder fields and special_instructions in OrderItem creation
   - Redeem preorder coupon after order creation
   - Order cancellation - quota restoration
   - Payment failure - reservation release
9. ✅ Enhance BuyerService:
   - Add enrichItemWithPreorderInfo() helper method
   - Include preorder info in menu, details, and search APIs
10. ✅ Update item DTOs to include preorder_campaign field
11. ✅ Testing and deployment

## 📋 Summary of Changes

### Requirements Added
- ✅ **Flat discount support**: Fixed rupee amount (e.g., ₹30 off)
- ✅ **Percentage discount support**: Percentage of item price with optional max cap (e.g., 20% off, max ₹50)
- ✅ Free delivery option in preorder campaigns
- ✅ Auto-apply coupon when preorder item added to cart
- ✅ Cart restriction (preorder OR regular items, not both)
- ✅ Order tracking same as regular orders
- ✅ **Cart-Based Flow Only**

### Key Implementation Points
1. **Cart-Based Flow**: All preorders go through cart - no direct reservation APIs
2. **Auto-Apply Coupon**: Preorder coupon automatically applied when item added to cart, no manual code entry
3. **Cart Restriction**: 
   - Cart can have EITHER preorder items OR regular items, NOT both (no multiple deliveries)
   - Only ONE preorder item allowed per cart (regardless of campaign)
4. **Discount Calculation**: 
   - **Flat Discount**: Fixed rupee amount (e.g., ₹30) - `value_type: "rupees"`
   - **Percentage Discount**: Percentage of price with optional max cap (e.g., 20% max ₹50) - `value_type: "percent"`
   - Preorder discount applies to the single preorder item in cart
5. **Order Amount**: Calculated as (subtotal - discount) + delivery + tax (simplified since cart has only one preorder item)
6. **Tracking**: Uses existing order tracking system
7. **Alignment**: Frontend and backend APIs fully aligned
8. **Cart Operations**: 
   - Remove preorder item: Releases reservation, restores quota, removes coupon if no preorder items remain
   - Update preorder item: Prevents quantity changes (must be 1), allows customization/variant updates
   - Clear cart: Releases all reservations, restores quota, removes coupon
9. **Order Cancellation**: Restores quota when preorder order is cancelled
10. **Payment Failure**: Releases reservation and restores quota on payment failure
11. **Checkout Validation**: Re-validates campaign status and quota availability during checkout
12. **Reservation Cleanup**: Automatic cleanup of reservations when items removed or cart cleared

