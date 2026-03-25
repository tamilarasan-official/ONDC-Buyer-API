# Coupon Module - Production Implementation

## Overview

This is a production-grade Coupon module for NestJS that supports cart/order-level coupons with Redis-based quota management, reservation system, metrics reconciliation, and comprehensive validation logic.

## Features

- ✅ **Cart-level coupons only** (flat, percent, free_delivery, first_order, nth_order, referral, preorder)
- ✅ **Redis-based quota management** with atomic LUA scripts
- ✅ **Reservation system** with TTL (15 minutes default)
- ✅ **Idempotent redemption** with idempotency keys
- ✅ **Fallback idempotency path** when Redis reservation is expired but DB reservation exists
- ✅ **Admin endpoints** for campaign management and code generation
- ✅ **Export functionality** (CSV, PDF, ZIP with QR codes)
- ✅ **Comprehensive validation** (time, geo, store, user limits, quota)
- ✅ **Transaction-safe** operations with rollback support and Redis-only rollback handling
- ✅ **Queue + cron based paid-order metrics** for deterministic first/nth order validation

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
COUPON_RESERVATION_CRON_EXPRESSION=*/10 * * * *
COUPON_METRICS_RECONCILE_CRON=0 */2 * * *
COUPON_METRICS_ATTEMPTS=5
COUPON_METRICS_BACKOFF_DELAY_MS=2000
COUPON_METRICS_CONCURRENCY=5
COUPON_METRICS_REMOVE_ON_COMPLETE=false
COUPON_METRICS_DLQ_ALERT_THRESHOLD=100
APP_ROLE=both
BULL_PREFIX=tazty-buyer
APP_URL=https://your-app.com  # For QR code generation
```

### What These Variables Control

- `COUPON_RESERVATION_TTL`: Reservation lifetime in seconds. If not redeemed before TTL expiry, the reservation is treated as stale and can be rolled back.
- `COUPON_RESERVATION_CRON_EXPRESSION`: Cron schedule used by coupon stale-reservation cleanup.
- `COUPON_METRICS_RECONCILE_CRON`: Cron schedule for backfilling/reconciling paid-order metrics (`user_order_metrics` and `order_paid_events_dedupe`).
- `COUPON_METRICS_ATTEMPTS`: Max retry attempts for coupon metrics queue jobs before moving to DLQ.
- `COUPON_METRICS_BACKOFF_DELAY_MS`: Base retry delay (milliseconds) for exponential backoff in queue jobs.
- `COUPON_METRICS_CONCURRENCY`: Worker concurrency for coupon metrics job processing.
- `COUPON_METRICS_REMOVE_ON_COMPLETE`: If `true`, completed queue jobs are auto-removed; if `false`, they are retained for inspection.
- `COUPON_METRICS_DLQ_ALERT_THRESHOLD`: DLQ depth threshold that triggers warning logs/alerts.
- `APP_ROLE`: Controls runtime role (`api`, `worker`, or `both`). Coupon metrics worker starts only when role allows worker execution.
- `BULL_PREFIX`: Redis key prefix used by BullMQ queues to isolate environments/apps.
- `APP_URL`: Base URL used for coupon export artifacts (for example, QR link generation).

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
- `order_paid_events_dedupe` table
- `user_order_metrics` table

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
  "separator": "",
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

#### Coupon Analytics Overview
```http
GET /admin/coupons/analytics/overview?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z
```

**Response:**
```json
{
  "period": {
    "from": "2026-03-01T00:00:00.000Z",
    "to": "2026-03-31T23:59:59.000Z"
  },
  "campaigns": { "total": 20, "active": 12 },
  "coupons": { "total": 1200, "active": 890 },
  "funnel": {
    "reserved": 18,
    "redeemed": 140,
    "rolled_back": 15,
    "failed": 3,
    "redemption_rate": 88.05
  },
  "financials": {
    "total_discount_amount": 24500.5,
    "avg_discount_amount": 175,
    "delivery_waived_count": 22,
    "orders_with_coupon": 132
  }
}
```

#### Campaign Analytics
```http
GET /admin/coupons/analytics/campaigns/:id?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z
```

**Response fields include:**
- campaign details and code distribution (`total`, `active`, `inactive`, `expired`, `revoked`)
- funnel (`reserved`, `redeemed`, `rolled_back`, `failed`, `unique_redeemed_users`, `redemption_rate`)
- financials (`total_discount_amount`, `avg_discount_amount`, `delivery_waived_count`, `orders_with_coupon`)
- daily redemption trend and top coupon codes

### Runtime Contract

Public HTTP coupon endpoints are intentionally not exposed.

Coupon operations are executed through:
- Admin APIs under `/admin/coupons/*` for campaign management, code generation, export, quota operations, and analytics
- Internal buyer/cart/order/payment flows that call `CouponService` directly for validation, reservation, redemption, and rollback

Runtime ownership:
- Cart flows validate and reserve coupons before checkout
- Order and payment flows redeem reserved coupons on successful placement or payment confirmation
- Cart cleanup and payment failure flows rollback reservations when applicable
- Queue worker and reconciliation cron repair metrics and retry safe redemption paths

Current internal service methods:
- `CouponService.validateCoupon(...)`
- `CouponService.reserveCoupon(...)`
- `CouponService.redeemCoupon(...)`
- `CouponService.rollbackCoupon(...)`

## Coupon Types

### 1. Flat (`flat`)

```json
{
  "type": "flat",
  "value": 100,
  "value_type": "rupees",
  "min_cart_value": 300,
  "type_meta": {
    "store_reference_id": "STORE-REF-44",
    "item_reference_ids": ["ITEM-REF-1", "ITEM-REF-2"],
    "free_delivery": true,
    "delivery_fee_cap": 40
  }
}
```

- Fixed rupee discount.
- Formula: `discount = min(value, discount_base)`.
- `discount_base` is cart total for global/store-wide, or eligible item subtotal for product-scoped coupons.
- Supports global, store-wide, and store+product scoped combinations.
- Optional `free_delivery` and `delivery_fee_cap` are supported.

### 2. Percent (`percent`)

```json
{
  "type": "percent",
  "value": 20,
  "value_type": "percent",
  "max_discount_amount": 500,
  "min_cart_value": 500,
  "type_meta": {
    "store_reference_id": "STORE-REF-44",
    "item_reference_ids": ["ITEM-REF-1", "ITEM-REF-2"],
    "free_delivery": true,
    "delivery_fee_cap": 50
  }
}
```

- Percentage discount with cap.
- Formula: `discount = min(discount_base * value/100, max_discount_amount, discount_base)`.
- `value` must be in `(0, 100]`.
- `max_discount_amount` is required for percent coupons.
- Supports global, store-wide, and store+product scoped combinations.

### 3. Free Delivery (`free_delivery`)

```json
{
  "type": "free_delivery",
  "value": 0,
  "value_type": "rupees",
  "type_meta": {
    "delivery_fee_cap": 50,
    "store_reference_id": "STORE-REF-44",
    "item_reference_ids": ["ITEM-REF-1", "ITEM-REF-2"]
  }
}
```

- Waives delivery fee using actual delivery fee from cart/order context.
- Formula: `discount = min(actual_delivery_fee, delivery_fee_cap || actual_delivery_fee)`.
- `value_type` must be `rupees` and `value` must be `0`.
- Requires `delivery_fee` context during validation/reservation.
- Supports global, store-wide, and store+product scoped combinations.

### 4. First Order (`first_order`)

```json
{
  "type": "first_order",
  "value": 75,
  "value_type": "rupees",
  "type_meta": {
    "source": "onboarding",
    "notes": "new user activation"
  }
}
```

- Valid only when user has zero paid orders.
- `user_id` is required for eligibility checks.

### 5. Nth Order (`nth_order`)

```json
{
  "type": "nth_order",
  "value": 25,
  "value_type": "percent",
  "max_discount_amount": 1000,
  "type_meta": {
    "nth": 3
  }
}
```

- Valid only when `paid_orders_count + 1 === type_meta.nth`.
- `type_meta.nth` is mandatory and must be an integer >= 1.

### 6. Referral (`referral`)

```json
{
  "type": "referral",
  "value": 200,
  "value_type": "rupees",
  "type_meta": {
    "referral_code": "REF123",
    "referrer_user_id": 456,
    "reward_type": "referee"
  }
}
```

- Supports two modes via `type_meta.reward_type`:
- `referee` mode (default when omitted):
- requires request context `referral_code` and `referrer_user_id`
- blocks self-referral
- validates request context against coupon `type_meta` when those fields exist
- requires referee's first paid order
- `referrer` mode:
- requires request `referrer_user_id`
- requester `user_id` must equal `referrer_user_id`

#### How Referral Coupon Works

1. Create referral coupon with `type=referral` and required `type_meta` for the selected reward mode.
2. During validate/reserve, request context must include referral fields:
3. For `reward_type=referee`: send `referral_code` and `referrer_user_id`; user must be first paid-order user; self-referral is blocked.
4. For `reward_type=referrer`: send `referrer_user_id`; requester must be that same user.
5. On successful payment/order completion, internal flows call `redeemCoupon(...)` with idempotency key to finalize redemption once.

### 7. Preorder (`preorder`)

```json
{
  "type": "preorder",
  "value": 15,
  "value_type": "percent",
  "max_discount_amount": 300,
  "type_meta": {
    "item_id": 123,
    "title": "Special Preorder Offer",
    "delivery_date": "2026-12-25T18:30:00Z",
    "free_delivery": true
  }
}
```

- `type_meta.item_id` is required and must exist.
- `type_meta.delivery_date` is required and must be a future datetime.
- `type_meta.final_price` is not required.

## Coupon Type Meta Combinations

- `percent`:
- global: `{}`
- store-wide: `{ "store_reference_id": "STORE-REF-44" }`
- store+product: `{ "store_reference_id": "STORE-REF-44", "item_reference_ids": ["ITEM-REF-1"] }`
- optional delivery waiver: add `{ "free_delivery": true, "delivery_fee_cap": 50 }`
- `flat`:
- global/store/product combinations are same as percent
- optional delivery waiver: add `{ "free_delivery": true, "delivery_fee_cap": 40 }`
- `free_delivery`:
- global: `{ "delivery_fee_cap": 50 }`
- store-wide: `{ "delivery_fee_cap": 40, "store_reference_id": "STORE-REF-44" }`
- store+product: `{ "delivery_fee_cap": 35, "store_reference_id": "STORE-REF-44", "item_reference_ids": ["ITEM-REF-1"] }`
- `nth_order`: `{ "nth": 3 }`
- `first_order`: optional `{ "source": "...", "notes": "..." }`
- `referral`:
- referee reward: `{ "referral_code": "REF123", "referrer_user_id": 456, "reward_type": "referee" }`
- referrer reward: `{ "referrer_user_id": 456, "reward_type": "referrer" }`

## Reservation Flow

### Recommended Internal Flow

1. Cart flow validates coupon eligibility and may reserve quota through `CouponService.validateCoupon(...)` or `CouponService.reserveCoupon(...)`.
2. Cart persists the reservation token on the cart or cart items.
3. Order creation and payment success flows call `CouponService.redeemCoupon(...)` with deterministic idempotency keys.
4. Payment failure, cancellation, or cart cleanup calls `CouponService.rollbackCoupon(...)` when the reservation should be released.

### Internal Redeem Example

Coupon redeem is performed by internal order/payment flows, not a public HTTP endpoint.

```typescript
await this.couponService.redeemCoupon({
  reservation_token: "550e8400-e29b-41d4-a716-446655440000",
  order_id: 12345,
  user_id: 123,
  payment_status: PaymentStatus.PAID,
  idempotency_key: "pay-12345-550e8400-e29b-41d4-a716-446655440000",
});
```

Expected behavior:
- Redeems exactly once (idempotent by `idempotency_key`).
- If same key is retried, returns existing redemption result.
- If Redis reservation is expired but DB row is already redeemed/reserved, fallback path prevents duplicate effects.

Notes:
- Rollback is idempotent and safe under retries.
- If Redis reservation exists but DB reservation row is missing, rollback still releases quota (Redis-only rollback path).
- For `preorder` and `nth_order` reservations already linked to an order, quota may remain consumed intentionally.

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

If DB save fails after Redis decrement during reservation creation, the module attempts immediate Redis release for the same reservation token.

During rollback, quota restoration is driven by `releaseReservation` and guarded by redemption state transitions to avoid duplicate side effects.

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
- **percent**: `value_type=percent`, `value` in `(0,100]`, `max_discount_amount > 0`
- **flat**: `value_type=rupees`, `value > 0`
- **free_delivery**: `value_type=rupees`, `value=0`, and request must provide `delivery_fee`
- **referral**: Enforces referee/referrer mode rules and request context (`referral_code`, `referrer_user_id`) based on `reward_type`
- **preorder**: Requires valid future `delivery_date` and valid `item_id`

## Code Generation

### Latest Input Rules

- `prefix` must be alphanumeric and max 12 chars; normalized to uppercase.
- `separator` supports only `""` (default) or `"-"`.
- `length` is random-part length (default 8).
- `preview=true` returns up to first 10 generated codes.
- Type/value constraints:
- `percent`: `value_type=percent`, `value in (0,100]`, `max_discount_amount > 0`
- `flat`: `value_type=rupees`, `value > 0`
- `free_delivery`: `value_type=rupees`, `value = 0`
- `nth_order`: requires `type_meta.nth`
- `preorder`: requires `type_meta.item_id` and future `type_meta.delivery_date`

### Latest Code Generation Examples

Global percent with compact code:

```json
{
  "count": 100,
  "prefix": "SUMMER",
  "separator": "",
  "length": 8,
  "type": "percent",
  "value": 20,
  "value_type": "percent",
  "max_discount_amount": 500,
  "type_meta": {
    "free_delivery": true,
    "delivery_fee_cap": 50
  }
}
```

Store+product scoped flat:

```json
{
  "count": 50,
  "prefix": "FLATI44",
  "separator": "",
  "length": 8,
  "type": "flat",
  "value": 100,
  "value_type": "rupees",
  "type_meta": {
    "store_reference_id": "STORE-REF-44",
    "item_reference_ids": ["ITEM-REF-1", "ITEM-REF-2"],
    "free_delivery": true,
    "delivery_fee_cap": 40
  }
}
```

Free delivery store-wide:

```json
{
  "count": 200,
  "prefix": "FREEDEL_STORE",
  "separator": "",
  "length": 8,
  "type": "free_delivery",
  "value": 0,
  "value_type": "rupees",
  "type_meta": {
    "delivery_fee_cap": 40,
    "store_reference_id": "STORE-REF-44"
  }
}
```

Nth-order coupon:

```json
{
  "count": 1000,
  "prefix": "3RDORDER",
  "separator": "",
  "length": 8,
  "type": "nth_order",
  "value": 25,
  "value_type": "percent",
  "max_discount_amount": 1000,
  "type_meta": {
    "nth": 3
  }
}
```

Referral coupon (referee reward):

```json
{
  "count": 200,
  "prefix": "REFER",
  "separator": "",
  "length": 8,
  "type": "referral",
  "value": 150,
  "value_type": "rupees",
  "type_meta": {
    "referral_code": "REF123",
    "referrer_user_id": 456,
    "reward_type": "referee"
  }
}
```

### Character Set
- Uses charset without ambiguous characters: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
- Excludes: `0`, `O`, `I`, `1` to avoid confusion

### Prefix and Separator Rules
- Prefix is normalized to uppercase.
- Prefix must be alphanumeric and up to 12 characters.
- Default separator is empty string (`""`) for compact codes (no hyphen).
- Optional legacy separator `"-"` can be provided.

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
- Apply rate limiting at the buyer/cart APIs that trigger coupon validation or reservation
- Protect admin coupon APIs independently using API key auth and gateway limits

### Idempotency
- Redemption flow accepts `idempotency_key` through internal service orchestration
- Prevents duplicate redemptions across payment retries, duplicate callbacks, and queue retries
- Returns existing redemption result if the same key has already been processed

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
4. Apply coupon through buyer cart flow
5. Place order or complete payment flow
6. Verify reservation redemption or rollback behavior
7. Verify counters and analytics updated

## Configuration Options

### Reservation TTL
```env
COUPON_RESERVATION_TTL=900  # seconds
```

### Reservation Auto-Rollback Cron
```env
COUPON_RESERVATION_CRON_EXPRESSION=*/10 * * * *
```

### Metrics Reconciliation Cron
```env
COUPON_METRICS_RECONCILE_CRON=0 */2 * * *
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
- Verify metrics tables:
  - `SELECT to_regclass('public.order_paid_events_dedupe');`
  - `SELECT to_regclass('public.user_order_metrics');`

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
- Track analytics `orders_with_coupon` to monitor coupon penetration at order level

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

### Relation Does Not Exist (`order_paid_events_dedupe`)
- Cause: Metrics migration not applied in the active database.
- Fix: Run `npm run migration:run` against the same DB used by the running API/worker.
- Verify: `SELECT to_regclass('public.order_paid_events_dedupe');`

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
- Metrics migration: `src/migrations/1774900000000-CreateNthOrderCouponMetricsTables.ts`
- LUA script: `src/coupon/scripts/reserve-coupon.lua`
- Service implementation: `src/coupon/services/coupon.service.ts`


