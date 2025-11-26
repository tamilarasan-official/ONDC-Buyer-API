# Coupon Module - Quick Setup Guide

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
npm install ioredis
```

For export features (optional):
```bash
npm install qrcode puppeteer archiver
npm install --save-dev @types/qrcode
```

### Step 2: Run Migration
```bash
npm run migration:run
```

### Step 3: Add Environment Variables
Add to your `.env` file:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, leave empty if no password
COUPON_RESERVATION_TTL=900
APP_URL=https://your-app.com
PLATFORM_DELIVERY_FEE=50
```

### Step 4: Import Module
Add to `src/app.module.ts`:
```typescript
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    // ... existing modules
    CouponModule,  // Add this line
  ],
})
export class AppModule {}
```

### Step 5: Start Redis
```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or using local Redis
redis-server
```

### Step 6: Test the API
```bash
# Create a campaign
curl -X POST http://localhost:3000/admin/coupons/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_key": "test-campaign",
    "title": "Test Campaign"
  }'
```

## ✅ Verification Checklist

- [ ] `ioredis` package installed
- [ ] Migration run successfully
- [ ] Redis server running
- [ ] Environment variables set
- [ ] Module imported in `app.module.ts`
- [ ] API endpoints accessible

## 📚 Next Steps

1. **Enable Auth Guards** (if needed):
   - Uncomment `@UseGuards(JwtAuthGuard)` in controllers
   - Uncomment `@ApiBearerAuth("JWT-auth")` decorators

2. **Enable Rate Limiting** (if needed):
   - Install `@nestjs/throttler`
   - Uncomment `@Throttle` decorators in controllers

3. **Install Export Packages** (if needed):
   - For PDF: `npm install puppeteer`
   - For QR codes: `npm install qrcode @types/qrcode`
   - For ZIP: `npm install archiver`

## 🐛 Troubleshooting

### Redis Connection Error
- Check Redis is running: `redis-cli ping`
- Verify `REDIS_HOST` and `REDIS_PORT` in `.env`
- Check firewall rules

### Migration Error
- Ensure Postgres is running
- Check database credentials in `.env`
- Verify TypeORM configuration

### Module Not Found
- Ensure `CouponModule` is imported in `app.module.ts`
- Restart the NestJS server

## 📖 Full Documentation

See `src/coupon/COUPON_MODULE_README.md` for complete documentation.


