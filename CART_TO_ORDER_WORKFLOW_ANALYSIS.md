# Cart to Order Workflow Analysis

## 📋 Table of Contents
1. [Cart to Order Workflow](#cart-to-order-workflow)
2. [Payment Handling](#payment-handling)
3. [Webhook Handlers](#webhook-handlers)
4. [Preorder-Specific Flow](#preorder-specific-flow)
5. [Error Handling & Edge Cases](#error-handling--edge-cases)

---

## 🛒 Cart to Order Workflow

### **Step 1: Add Items to Cart**
**API:** `POST /api/buyer/cart/add`

**Process:**
1. ✅ **App Operation Hours Validation** - Checks if app is accepting orders
2. ✅ **Cart Restrictions** - Validates preorder vs regular items (no mixing)
3. ✅ **Preorder Auto-Apply** - Automatically applies preorder coupon if `is_preorder=true`
4. ✅ **Quota Check** - Validates available slots for preorder items
5. ✅ **Cart Item Creation** - Creates/updates cart item with:
   - Item details, quantity, customizations, variants
   - `is_preorder`, `preorder_campaign_id` (for preorder items)
   - Price calculations (item + customizations)

**Key Files:**
- `src/buyer/cart.service.ts` → `addToCart()`
- `src/buyer/buyer.controller.ts` → `addToCart()`

---

### **Step 2: Get Cart Summary**
**API:** `GET /api/buyer/cart`

**Process:**
1. ✅ **Load Cart** - Fetches active cart with items
2. ✅ **Calculate Totals** - Subtotal, delivery fee, tax, discount, final amount
3. ✅ **Preorder Info** - Includes preorder campaign details (title, delivery_date, slots, free_delivery)
4. ✅ **Estimated Delivery** - Sets delivery time based on preorder `delivery_date` if applicable
5. ✅ **Tax Calculation** - Applies GST on discounted price (not original)

**Key Files:**
- `src/buyer/cart.service.ts` → `getCart()`, `calculateCartSummary()`, `formatCartData()`

---

### **Step 3: Create Order**
**API:** `POST /api/buyer/orders`

**Process:**

#### **3.1 Validation & Preparation**
1. ✅ **App Operation Hours** - Validates app is open
2. ✅ **Cart Validation** - Ensures cart exists and is not empty
3. ✅ **Delivery Address** - Validates delivery address belongs to user
4. ✅ **Preorder Re-validation** - Re-checks campaign status and quota before checkout

#### **3.2 Preorder Reservation (if applicable)**
1. ✅ **Reserve Quota** - Calls `reservePreorderFromCart()` which:
   - Finds PREORDER coupon
   - Calls `couponService.reserveCoupon()` → Creates Redis reservation
   - **Atomically decrements quota** via LUA script
   - Returns `reservation_token` (15 min TTL)
2. ✅ **Store Reservation Token** - Saves `preorder_reservation_token` in `CartItem`

#### **3.3 Order Creation**
1. ✅ **Generate Order Number** - Format: `ORD-YYYYMMDD-XXX`
2. ✅ **Set Order Status**:
   - `"confirmed"` for COD orders
   - `"pending_payment"` for online payment
3. ✅ **Set Payment Status**:
   - `"pending"` for both COD and online (updated later)
4. ✅ **Calculate Estimated Delivery**:
   - Preorder: Uses `delivery_date` from coupon `type_meta`
   - Regular: Default 45 minutes from now
5. ✅ **Create Order Entity** - Saves order with:
   - User, store, delivery address
   - Totals (subtotal, delivery, tax, discount, tip, total)
   - Payment method, payment status
   - Estimated delivery time
6. ✅ **Create Order Items** - Copies from cart items:
   - Item details, quantity, prices
   - Customizations, variants, special instructions
   - `is_preorder`, `preorder_campaign_id` (for preorder items)

#### **3.4 Preorder Coupon Redemption**
1. ✅ **Redeem Coupon** - For preorder items with reservation token:
   - Calls `couponService.redeemCoupon()` with:
     - `reservation_token`
     - `order_id`
     - `user_id`
     - `payment_status`: `PAID` for COD, `FAILED` for online (updated on payment success)
   - Updates `CouponRedemption` status to `REDEEMED`
   - Deletes reservation from Redis
   - Updates coupon counter

#### **3.5 Post-Order Actions**
1. ✅ **Deactivate Cart** - Sets `cart.is_active = false`
2. ✅ **Create Tracking Entry** - Initial status tracking
3. ✅ **Push to Seller** - If status is `"confirmed"`:
   - Calls `sellerPushService.pushOrderToSeller()`
   - Includes preorder details in payload
   - Sends to seller's webhook URL
4. ✅ **Return Response**:
   - COD: Returns order immediately
   - Online: Returns order with `payment_required: true` and payment details

**Key Files:**
- `src/buyer/order.service.ts` → `createOrder()`, `reservePreorderFromCart()`
- `src/buyer/seller-push.service.ts` → `pushOrderToSeller()`

---

## 💳 Payment Handling

### **Payment Methods**

#### **1. Cash on Delivery (COD)**
**Flow:**
1. ✅ Order created with status `"confirmed"`
2. ✅ Payment status set to `"pending"` (will be updated on delivery)
3. ✅ Order immediately pushed to seller
4. ✅ No payment gateway interaction

#### **2. Online Payment (Razorpay)**

**Flow A: Payment Initiation (After Order Creation)**
**API:** `POST /api/buyer/orders/:id/payment/initiate` or `POST /api/buyer/payment/create`

**Process:**
1. ✅ **Validate Order** - Checks order exists, not already paid, status is `pending_payment`
2. ✅ **Create Razorpay Order** - Calls `razorpayService.createOrder()`:
   - Amount in paise (total_amount × 100)
   - Currency: INR
   - Receipt: Order number
3. ✅ **Create Payment Record** - Saves in `Payment` table:
   - `payment_id`: Razorpay order ID (temporarily)
   - `payment_method`: "online"
   - `payment_status`: "pending"
   - `gateway`: "razorpay"
4. ✅ **Return Payment Details** - Returns Razorpay checkout options:
   - `razorpay_order_id`
   - `amount`, `currency`
   - `key` (Razorpay key ID)
   - Customer prefill data

**Key Files:**
- `src/buyer/order.service.ts` → `initiatePayment()`, `createPayment()`
- `src/buyer/razorpay.service.ts` → `createOrder()`

---

**Flow B: Payment Verification (Mobile App)**
**API:** `POST /api/buyer/payment/verify`

**Process:**
1. ✅ **Verify Signature** - Validates Razorpay payment signature:
   - Uses HMAC SHA256 with `razorpay_order_id|razorpay_payment_id`
   - Compares with `razorpay_signature`
2. ✅ **Find Payment Record** - Locates payment by Razorpay order ID
3. ✅ **Update Payment Record** - Sets:
   - `payment_id`: Actual Razorpay payment ID
   - `payment_status`: "paid"
4. ✅ **Update Order Payment Status** - Calls `updatePaymentStatus()`:
   - Updates `order.payment_status` to `"paid"`
   - Updates `Payment` table
   - Creates tracking entry
5. ✅ **Update Order Status** - Calls `updateOrderStatus()`:
   - Sets order status to `"confirmed"`
   - Pushes order to seller (if not already pushed)
   - Creates tracking entry
6. ✅ **Update Preorder Coupon** - If payment succeeds:
   - Updates `CouponRedemption.payment_status` to `PAID` (if not already)
   - Note: Coupon was already redeemed during order creation

**Key Files:**
- `src/buyer/order.service.ts` → `verifyPayment()`, `updatePaymentStatus()`, `updateOrderStatus()`
- `src/buyer/razorpay.service.ts` → `verifyPaymentSignature()`

---

**Flow C: Payment Failure Handling**
**API:** `POST /api/buyer/orders/:id/payment/failure`

**Process:**
1. ✅ **Update Payment Status** - Sets `order.payment_status` to `"failed"`
2. ✅ **Release Preorder Reservations** - For preorder items:
   - Finds `CouponRedemption` by `order_id`
   - Calls `redisCouponService.releaseReservation()`:
     - Deletes reservation from Redis
     - **Increments quota back** (restores slot)
3. ✅ **Keep Order in Pending** - Order stays in `pending_payment` status
4. ✅ **Create Tracking Entry** - Records failure reason
5. ✅ **Allow Retry** - User can retry payment

**Key Files:**
- `src/buyer/order.service.ts` → `handlePaymentFailure()`
- `src/coupon/services/redis-coupon.service.ts` → `releaseReservation()`

---

## 🔔 Webhook Handlers

### **1. Razorpay Payment Webhook**
**Endpoint:** `POST /api/buyer/webhook/razorpay`

**Events Handled:**

#### **Event: `payment.captured`**
**Process:**
1. ✅ **Extract Payment Details** - Gets `payment_id` and `order_id` from event
2. ✅ **Update Payment Status** - Calls `updatePaymentStatus()`:
   - Sets `order.payment_status` to `"paid"`
   - Updates `Payment` table with payment ID
   - Creates tracking entry

**Handler:** `handlePaymentCaptured()`

---

#### **Event: `payment.failed`**
**Process:**
1. ✅ **Extract Payment Details** - Gets `payment_id` and `order_id` from event
2. ✅ **Update Payment Status** - Calls `updatePaymentStatus()`:
   - Sets `order.payment_status` to `"failed"`
   - Updates `Payment` table
   - Creates tracking entry
3. ⚠️ **Note:** Preorder quota restoration should be handled here (currently not implemented in webhook handler)

**Handler:** `handlePaymentFailed()`

---

#### **Event: `order.paid`**
**Process:**
1. ✅ **Extract Order ID** - Gets `order_id` from event
2. ✅ **Update Order Status** - Calls `updateOrderStatus()`:
   - Sets order status to `"confirmed"`
   - Pushes order to seller (if not already)
   - Creates tracking entry

**Handler:** `handleOrderPaid()`

---

**Security:**
- ✅ **Signature Verification** - Validates webhook signature using HMAC SHA256
- ✅ **Invalid Signature** - Returns 400 if signature doesn't match

**Key Files:**
- `src/buyer/buyer.controller.ts` → `handleRazorpayWebhook()`, `handlePaymentCaptured()`, `handlePaymentFailed()`, `handleOrderPaid()`
- `src/buyer/razorpay.service.ts` → `verifyWebhookSignature()`

---

### **2. Seller Status Update Webhook**
**Endpoint:** `POST /api/buyer/webhook/seller-status`

**Purpose:** Receive order status updates from seller app

**Process:**
1. ✅ **Find Order** - Locates order by `order_number`
2. ✅ **Validate Status Transition** - Ensures valid status progression
3. ✅ **Update Order Status** - Updates order:
   - Sets new status
   - Sets `delivered_at` if status is `"delivered"`
   - Updates `estimated_delivery_time` if provided
4. ✅ **Create Tracking Entry** - Records status change with:
   - Agent details (name, phone, vehicle, ETA, photo)
   - GPS location (if provided)
   - Timestamps and status history
   - Tracking URL, delivery code
   - Cancel reason (if cancelled)
5. ✅ **Send Notification** - Creates notification for user

**Supported Statuses:**
- `billed`, `agent-assigned`, `packed`, `out-of-delivery`, `delivered`, `cancelled`

**Key Files:**
- `src/buyer/buyer.controller.ts` → `updateOrderStatusFromSeller()`
- `src/buyer/order.service.ts` → `updateOrderStatusFromSeller()`
- `src/shared/services/seller-status.service.ts` → `validateSellerStatusUpdate()`

---

### **3. Store Status Update Webhook**
**Endpoint:** `POST /api/buyer/webhook/store-status`

**Purpose:** Receive store enable/disable updates from seller

**Process:**
1. ✅ **Batch Processing** - Handles multiple stores in one request
2. ✅ **Find Stores** - Supports both ONDC `reference_id` (e.g., "P1") and numeric ID
3. ✅ **Update Status** - Sets store `is_active` flag
4. ✅ **Return Results** - Returns success/failure for each store

**Key Files:**
- `src/buyer/buyer.controller.ts` → `updateStoreStatusFromSeller()`
- `src/store/store.service.ts` → `updateStoreStatusFromSeller()`

---

### **4. Store Timing Status Webhook**
**Endpoint:** `POST /api/buyer/webhook/store-timing-status`

**Purpose:** Manage temporary store closures outside normal hours

**Process:**
1. ✅ **Batch Processing** - Handles multiple stores
2. ✅ **Update Close Timings** - Creates/updates `StoreCloseTimings` records
3. ✅ **Reopen Stores** - Ends active close timings when status is `"open"`

**Key Files:**
- `src/buyer/buyer.controller.ts` → `updateStoreTimingStatusFromSeller()`
- `src/store/store.service.ts` → `updateStoreTimingStatusFromSeller()`

---

## 🎯 Preorder-Specific Flow

### **Differences from Regular Orders:**

1. **Cart Addition:**
   - ✅ Auto-applies preorder coupon
   - ✅ Validates quota > 0
   - ✅ Quantity must be 1
   - ✅ No mixing with regular items

2. **Order Creation:**
   - ✅ Re-validates campaign and quota
   - ✅ **Reserves quota** before order creation (atomic operation)
   - ✅ Stores `preorder_reservation_token` in cart item
   - ✅ Redeems coupon immediately (even for online payment)
   - ✅ Sets estimated delivery from `delivery_date` in coupon metadata

3. **Payment Success:**
   - ✅ Coupon already redeemed (no additional action needed)
   - ✅ Quota already decremented (reserved during order creation)

4. **Payment Failure:**
   - ✅ Releases reservation
   - ✅ **Restores quota** (increments back)
   - ✅ Order stays in `pending_payment` for retry

5. **Order Cancellation:**
   - ✅ Finds `CouponRedemption` for order
   - ✅ **Restores quota** (increments back)
   - ✅ Updates redemption status

6. **Cart Clearing:**
   - ✅ If reservation token exists, releases reservation and restores quota
   - ✅ If no reservation (just added to cart), no quota was taken

---

## ⚠️ Error Handling & Edge Cases

### **1. Concurrent Reservations**
- ✅ **Atomic Operations** - Uses Redis LUA script for quota decrement
- ✅ **Race Condition Prevention** - Checks quota > 0 before decrementing
- ✅ **Over-decrement Protection** - Restores quota if decrement goes negative

### **2. Reservation Expiry**
- ✅ **TTL** - Reservations expire after 15 minutes
- ⚠️ **Note:** Quota is already decremented, so expiry doesn't restore it automatically
- ✅ **Manual Cleanup** - Can be handled via background job or admin API

### **3. Payment Gateway Failures**
- ✅ **Webhook Retry** - Razorpay retries failed webhooks
- ✅ **Manual Verification** - Mobile app can verify payment manually
- ✅ **Payment Failure Handler** - Explicit endpoint for handling failures

### **4. Seller Push Failures**
- ✅ **Non-blocking** - Order creation doesn't fail if seller push fails
- ✅ **Retry on Status Update** - Pushes again when order status changes to `confirmed`

### **5. Database Transaction Failures**
- ✅ **Compensating Actions** - Increments quota back if DB transaction fails
- ✅ **Idempotency** - Payment verification checks for duplicate redemptions

### **6. Cart State Management**
- ✅ **Cart Deactivation** - Cart is deactivated after order creation
- ✅ **Reservation Cleanup** - Reservations are released on cart clear/remove
- ✅ **Quota Restoration** - Quota is restored when items are removed

---

## 📊 Summary

### **Order Status Flow:**
```
Cart → Order Created (pending_payment/confirmed) → Payment (if online) → confirmed → billed → packed → out-of-delivery → delivered
                                                                                    ↓
                                                                              cancelled (any time before delivered)
```

### **Payment Status Flow:**
```
pending → paid (on payment success) → success (in Payment table)
       ↓
    failed (on payment failure, can retry)
```

### **Preorder Quota Flow:**
```
Available → Reserved (on order creation) → Redeemed (on order creation) → [Slot consumed]
         ↓
      Restored (on payment failure/cancellation/cart clear)
```

### **Key Integration Points:**
1. ✅ **Razorpay** - Payment gateway for online payments
2. ✅ **Redis** - Quota management and reservations
3. ✅ **Seller Webhook** - Order status updates from seller app
4. ✅ **Notification Service** - User notifications on status changes

---

## 🔍 Code References

### **Main Services:**
- `src/buyer/cart.service.ts` - Cart management
- `src/buyer/order.service.ts` - Order creation and management
- `src/buyer/razorpay.service.ts` - Payment gateway integration
- `src/buyer/seller-push.service.ts` - Seller app integration
- `src/coupon/services/coupon.service.ts` - Coupon validation and redemption
- `src/coupon/services/redis-coupon.service.ts` - Quota and reservation management

### **Main Controllers:**
- `src/buyer/buyer.controller.ts` - All buyer APIs and webhooks

### **Key Entities:**
- `Order` - Order table
- `OrderItem` - Order items with preorder flags
- `Cart` - Cart table
- `CartItem` - Cart items with preorder flags
- `Payment` - Payment records
- `CouponRedemption` - Coupon usage tracking
- `OrderTracking` - Order status history

---

**Last Updated:** 2025-01-15
**Version:** 1.0




