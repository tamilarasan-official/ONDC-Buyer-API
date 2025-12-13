# Coupon Module - Production Implementation

## Overview

This is a production-grade Coupon module for NestJS that supports cart/order-level coupons with Redis-based quota management, reservation system, and comprehensive validation logic.

## Features

- ✅ **Cart-level coupons only** (flat, percent, free_delivery, first_order, nth_order, referral)
- ✅ **Redis-based quota management** with atomic LUA scripts
- ✅ **Reservation system** with TTL (15 minutes default)
- ✅ **Idempotent redemption** with idempotency keys
- ✅ **Admin endpoints** for campaign management and code generation
- ✅ **Export functionality** (CSV, PDF, ZIP with QR codes)
- ✅ **Comprehensive validation** (time, geo, store, user limits, quota)
- ✅ **Transaction-safe** operations with rollback support

## Installation

### Required Dependencies

```bash
# Core dependencies (should already be installed)
npm install @nestjs/common @nestjs/typeorm typeorm uuid

# Redis client
npm install ioredis

# Export dependencies (optional - for PDF/QR/ZIP)
npm install qrcode puppeteer archiver
npm install --save-dev @types/qrcode
```

### Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional

# Coupon Configuration
COUPON_RESERVATION_TTL=900  # 15 minutes in seconds
APP_URL=https://your-app.com  # For QR code generation

# Platform Delivery Fee (for free_delivery coupons)
PLATFORM_DELIVERY_FEE=50  # Default delivery fee in INR
```

## Database Migration

Run the migration to create coupon tables:

```bash
npm run migration:run
```

This will create:
- `coupon_campaigns` table
- `coupons` table
- `coupon_redemptions` table
- `coupon_counters` table
- `coupon_type_enum` type

## Module Setup

Import the `CouponModule` in your `app.module.ts`:

```typescript
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    // ... other modules
    CouponModule,
  ],
})
export class AppModule {}
```

## API Endpoints

### Admin Endpoints

#### Create Campaign
```http
POST /admin/coupons/campaigns
Content-Type: application/json

{
  "campaign_key": "summer-2025",
  "title": "Summer 2025 Sale",
  "description": "20% off on all orders",
  "created_by": "admin@example.com",
  "status": "draft"
}
```

#### Generate Codes
```http
POST /admin/coupons/campaigns/:id/generate-codes
Content-Type: application/json

{
  "count": 100,
  "prefix": "SUMMER",
  "length": 8,
  "type": "percent",
  "value": 20,
  "value_type": "percent",
  "max_discount_amount": 500,
  "min_cart_value": 500,
  "expires_at": "2025-12-31T23:59:59Z",
  "user_usage_limit": 1,
  "global_usage_limit": 1000,
  "priority": 5,
  "preview": false
}
```

#### Export Codes
```http
POST /admin/coupons/campaigns/:id/export
Content-Type: application/json

{
  "format": "zip",
  "include_qr": true,
  "exported_by": "admin@example.com"
}
```

### Public Endpoints

#### Validate Coupon
```http
POST /coupons/validate
Content-Type: application/json

{
  "code": "SUMMER-ABC12345",
  "user_id": 123,
  "cart_total": 1000,
  "pincode": "600001",
  "store_id": 1,
  "reserve": true
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "discount_amount": 200,
  "delivery_waived": false,
  "reservation_token": "550e8400-e29b-41d4-a716-446655440000",
  "reservation_ttl": 900
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "reason_code": "MIN_CART_NOT_MET",
  "message": "Minimum cart value of ₹500 required"
}
```

#### Reserve Coupon
```http
POST /coupons/reserve
Content-Type: application/json

{
  "code": "SUMMER-ABC12345",
  "user_id": 123,
  "cart_total": 1000,
  "pincode": "600001",
  "store_id": 1
}
```

#### Redeem Coupon
```http
POST /coupons/redeem
Content-Type: application/json

{
  "reservation_token": "550e8400-e29b-41d4-a716-446655440000",
  "order_id": 12345,
  "user_id": 123,
  "payment_status": "paid",
  "idempotency_key": "order-12345-payment-abc123"
}
```

#### Rollback Coupon
```http
POST /coupons/rollback
Content-Type: application/json

{
  "reservation_token": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Payment cancelled by user"
}
```

## Coupon Types

### 1. Flat Discount
```json
{
  "type": "flat",
  "value": 100,
  "value_type": "rupees",
  "min_cart_value": 500
}
```
- Fixed rupee discount
- `discount = min(value, cart_total)`

### 2. Percent Discount
```json
{
  "type": "percent",
  "value": 20,
  "value_type": "percent",
  "max_discount_amount": 500,
  "min_cart_value": 1000
}
```
- Percentage discount with max cap
- `discount = min(cart_total * percent/100, max_discount_amount)`
- **Required**: `max_discount_amount` must be set

### 3. Free Delivery
```json
{
  "type": "free_delivery",
  "type_meta": {
    "delivery_fee_cap": 50
  }
}
```
- Waives delivery fee
- Returns `delivery_waived: true`
- Discount equals platform delivery fee or cap in `type_meta`

### 4. First Order
```json
{
  "type": "first_order",
  "value": 50,
  "value_type": "rupees"
}
```
- Applies only if user has **zero** paid orders
- Checks order count: `SELECT COUNT(*) WHERE status IN ('paid', 'delivered', 'confirmed')`

### 5. Nth Order
```json
{
  "type": "nth_order",
  "type_meta": {
    "nth": 3
  },
  "value": 100,
  "value_type": "rupees"
}
```
- Applies on customer's Nth paid order
- Validates: `count_paid_orders(user) + 1 === nth`
- **Required**: `type_meta.nth` must be set

### 6. Referral
```json
{
  "type": "referral",
  "type_meta": {
    "referral_code": "REF123",
    "reward_type": "referee" // or "referrer"
  },
  "value": 200,
  "value_type": "rupees"
}
```
- Tied to referral system
- Issues rewards on referee's first paid order
- Implement via order-success event listener

## Reservation Flow

### Recommended Flow

1. **Validate + Reserve** (or separate calls):
   ```
   POST /coupons/validate?reserve=true
   → Returns reservation_token (valid for 15 minutes)
   ```

2. **On Payment Success**:
   ```
   POST /coupons/redeem
   → Persists redemption, updates counters, releases reservation
   ```

3. **On Payment Failure/Cancel**:
   ```
   POST /coupons/rollback
   → Releases reservation, increments quota (if allowed)
   ```

### Reservation TTL

- **Default**: 900 seconds (15 minutes)
- **Configurable**: Set `COUPON_RESERVATION_TTL` env variable
- **Behavior**: Reservation expires automatically if not redeemed

## Redis Quota Management

### Initialization

When coupons with `global_usage_limit` are created, quota is initialized in Redis:

```typescript
// Automatically called during code generation
await redisCouponService.initializeQuota(couponId, global_usage_limit);
```

### Atomic Reservation (LUA Script)

The LUA script atomically:
1. Checks quota > 0
2. Decrements quota
3. Creates reservation hash with TTL
4. Returns success/error codes

**Key Pattern:**
- Quota: `coupon:quota:<coupon_id>`
- Reservation: `coupon:reservation:<uuid>`

### Compensating Operations

If DB transaction fails after Redis decrement:
- Background job increments quota back
- Implement retry mechanism for failed redemptions

## Validation Rules

### Common Checks (All Types)
- ✅ Coupon exists and is active
- ✅ Campaign is active
- ✅ Within time window (start_at, end_at)
- ✅ Minimum cart value met
- ✅ Pincode eligibility (if `valid_pincodes` set)
- ✅ Store eligibility (if `applicable_store_ids` set)
- ✅ Per-user usage limit not exceeded
- ✅ Global quota available (if `global_usage_limit` set)

### Type-Specific Checks
- **first_order**: User has zero paid orders
- **nth_order**: User's next order is the Nth order
- **percent**: Must have `max_discount_amount`

## Code Generation

### Character Set
- Uses charset without ambiguous characters: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
- Excludes: `0`, `O`, `I`, `1` to avoid confusion

### Preview Mode
```json
{
  "count": 100,
  "preview": true
}
```
- Returns first 10 codes only
- Useful for testing before mass generation

## Export Features

### CSV Export
- Columns: `campaign_key, code, status, created_at, expires_at, qr_url`
- Includes QR URLs if `include_qr=true`

### PDF Export
- 10 codes per A4 page (2x5 grid)
- Includes QR codes if requested
- Requires `puppeteer` package

### ZIP Export
- Contains: `codes.csv`, `codes.pdf`, `metadata.json`
- Requires `archiver` package

### Marking as Exported
- Sets `exported=true` on all codes in campaign
- Records `exported_by` and `exported_at` for audit

## Security & Fraud Prevention

### Rate Limiting
- Validate endpoint: 10 requests/minute per IP
- Reserve endpoint: 5 requests/minute per IP
- Use `@nestjs/throttler` (uncomment in controllers)

### Idempotency
- Redeem endpoint accepts `idempotency_key`
- Prevents duplicate redemptions
- Returns existing redemption if key matches

### Validation Logging
- Log failed validations for suspicious pattern detection
- Track rapid failed attempts per IP/user

## Testing

### Unit Tests
```bash
npm test -- coupon.service.spec.ts
```

### Integration Test (Concurrency)
```typescript
// Test concurrent redemptions
const promises = Array(100).fill(null).map(() => 
  redeemCoupon({ reservation_token, order_id, user_id, payment_status: 'paid' })
);
await Promise.all(promises);
// Verify: total redemptions <= global_usage_limit
```

### E2E Test Flow
1. Create campaign
2. Generate codes (preview first)
3. Export CSV/PDF
4. Validate code
5. Reserve code
6. Redeem code
7. Verify counter updated

## Configuration Options

### Reservation TTL
```env
COUPON_RESERVATION_TTL=900  # seconds
```

### Platform Delivery Fee
```env
PLATFORM_DELIVERY_FEE=50  # INR
```

### App URL (for QR codes)
```env
APP_URL=https://your-app.com
```

## Deployment Notes

### Redis Setup
- Ensure Redis is running and accessible
- Configure connection in `.env`
- Test LUA script execution: `redis-cli EVAL "$(cat reserve-coupon.lua)" 2 key1 key2 arg1 arg2`

### Database
- Run migration: `npm run migration:run`
- Verify enum type created: `SELECT * FROM pg_type WHERE typname = 'coupon_type_enum'`
- Check constraints: `SELECT * FROM information_schema.table_constraints WHERE table_name = 'coupons'`

### Dependencies
- Install optional packages for export features:
  ```bash
  npm install qrcode puppeteer archiver @types/qrcode
  ```

### Monitoring
- Monitor Redis quota keys: `coupon:quota:*`
- Track reservation expiration: `coupon:reservation:*`
- Alert on quota exhaustion
- Monitor redemption success/failure rates

## Troubleshooting

### Redis Connection Errors
- Check `REDIS_HOST` and `REDIS_PORT`
- Verify Redis is running: `redis-cli ping`
- Check firewall rules

### LUA Script Errors
- Verify script syntax: `redis-cli --eval reserve-coupon.lua`
- Check Redis version (requires 2.6+)

### Export Failures
- PDF: Ensure `puppeteer` is installed and Chromium can launch
- ZIP: Ensure `archiver` is installed
- QR: Ensure `qrcode` is installed

### Quota Issues
- Check Redis quota keys: `redis-cli GET coupon:quota:123`
- Re-initialize if needed: Call `initializeQuota()` manually

## Future Enhancements

- [ ] Stackable coupons (multiple coupons per order)
- [ ] Geo-radius validation (PostGIS integration)
- [ ] Referral system integration
- [ ] Background job for quota compensation
- [ ] Analytics dashboard
- [ ] A/B testing support

## Support

For issues or questions, refer to:
- Migration file: `src/migrations/1764000000000-CreateCouponModule.ts`
- LUA script: `src/coupon/scripts/reserve-coupon.lua`
- Service implementation: `src/coupon/services/coupon.service.ts`


