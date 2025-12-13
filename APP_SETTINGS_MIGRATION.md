# App Settings Migration Guide

## Overview

App settings have been migrated from environment variables to database storage for better management and runtime configuration updates without requiring app restarts.

## Changes Made

### 1. **New Database Table: `app_settings`**
- Stores all app configuration in key-value pairs
- Includes category, description, and active status
- Automatically seeded with initial values from `.env.prod`

### 2. **Settings Migrated to Database**

| Setting Key | Category | Description | Default Value |
|------------|----------|-------------|---------------|
| `PLATFORM_FEE` | app_config | Platform fee charged per order | 50 |
| `INCLUDE_PLATFORM_FEE` | app_config | Whether to include platform fee in orders | false |
| `SUPPORT_PHONE` | support | Customer support phone number | +919952520699 |
| `SUPPORT_EMAIL` | support | Customer support email address | support@tazty.in |
| `APP_OPERATION_HOURS_ENABLED` | app_config | Enable/disable app operational hours | true |
| `APP_OPERATION_HOURS` | app_config | App operational hours (HHMM-HHMM) | 0900-1700 |
| `RAZORPAY_KEY_ID` | payment | Razorpay API Key ID | rzp_test_RYoAp8xLUKGiWa |
| `RAZORPAY_KEY_SECRET` | payment | Razorpay API Key Secret | aZU636O8lC8j3qwIwHh9aUmw |

### 3. **Updated Services**

- **CartService**: Now uses `AppSettingsService` for platform fee configuration
- **RazorpayService**: Reads payment credentials from database
- **AppOperationHoursService**: Fetches operational hours from database

### 4. **New API Endpoints**

```
GET    /app-settings                    - Get all settings
GET    /app-settings/category/:category - Get settings by category
GET    /app-settings/:key               - Get specific setting
POST   /app-settings                    - Create/update setting (requires auth)
POST   /app-settings/bulk               - Bulk create/update (requires auth)
PUT    /app-settings/:id                - Update setting value (requires auth)
PUT    /app-settings/:id/toggle         - Toggle active status (requires auth)
DELETE /app-settings/:id                - Delete setting (requires auth)
```

## Usage Examples

### 1. **Get All Settings**
```bash
curl http://localhost:3000/app-settings
```

### 2. **Get Payment Settings**
```bash
curl http://localhost:3000/app-settings/category/payment
```

### 3. **Update Platform Fee**
```bash
curl -X PUT http://localhost:3000/app-settings/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"value": "75"}'
```

### 4. **Create New Setting**
```bash
curl -X POST http://localhost:3000/app-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "key": "MAX_DELIVERY_DISTANCE",
    "value": "15",
    "category": "app_config",
    "description": "Maximum delivery distance in KM"
  }'
```

### 5. **Bulk Update Settings**
```bash
curl -X POST http://localhost:3000/app-settings/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "settings": [
      {
        "key": "PLATFORM_FEE",
        "value": "100",
        "category": "app_config"
      },
      {
        "key": "INCLUDE_PLATFORM_FEE",
        "value": "true",
        "category": "app_config"
      }
    ]
  }'
```

## Code Usage in Services

### Reading Settings

```typescript
import { AppSettingsService } from '../shared/services/app-settings.service';

// Inject in constructor
constructor(private readonly appSettingsService: AppSettingsService) {}

// Get string value
const value = await this.appSettingsService.get('SUPPORT_EMAIL', 'default@email.com');

// Get number value
const platformFee = await this.appSettingsService.getNumber('PLATFORM_FEE', 0);

// Get boolean value
const isEnabled = await this.appSettingsService.getBoolean('INCLUDE_PLATFORM_FEE', false);

// Get all settings in a category
const paymentSettings = await this.appSettingsService.getByCategory('payment');
```

### Writing Settings

```typescript
// Set a single setting
await this.appSettingsService.set(
  'NEW_SETTING',
  'value',
  'category',
  'description'
);

// Update existing setting
await this.appSettingsService.update(settingId, 'new_value');

// Bulk set
await this.appSettingsService.bulkSet([
  { key: 'KEY1', value: 'value1', category: 'cat1' },
  { key: 'KEY2', value: 'value2', category: 'cat2' }
]);
```

## Caching

The `AppSettingsService` implements **automatic caching** with a 1-minute TTL:

- Settings are cached in memory on first load
- Cache auto-refreshes after 1 minute
- Manual refresh on any update/create/delete operation
- No additional caching setup required

## Migration Steps Completed

✅ Created `app_settings` table with unique constraint on `key`  
✅ Seeded initial values from environment variables  
✅ Created seeder script for easy updates  
✅ Updated `CartService` to use database settings  
✅ Updated `RazorpayService` to use database settings  
✅ Updated `AppOperationHoursService` to use database settings  
✅ Added API endpoints for settings management  
✅ Implemented caching for performance  

## Seeding App Settings

You can update or reseed the app settings at any time using the seeder script:

```bash
# Run the seeder
npm run seed:app-settings
```

The seeder will:
- Update existing settings if they already exist
- Insert new settings if they don't exist
- Preserve custom values (won't overwrite unless you want to reset)

To modify the seed data, edit: `src/migrations/seeders/seed-app-settings.ts`  

## Environment Variables Status

The following environment variables can now be **optionally removed** from `.env.prod`:

```dotenv
# These are now in database - can be removed after verification
PLATFORM_FEE=50
INCLUDE_PLATFORM_FEE=false
SUPPORT_PHONE=+919952520699
SUPPORT_EMAIL=support@tazty.in
APP_OPERATION_HOURS_ENABLED=true
APP_OPERATION_HOURS=0900-1700
RAZORPAY_KEY_ID=rzp_test_RYoAp8xLUKGiWa
RAZORPAY_KEY_SECRET=aZU636O8lC8j3qwIwHh9aUmw
```

⚠️ **Note**: Keep environment variables for backward compatibility during transition period. Remove after confirming all services work correctly.

## Testing

1. **Verify settings loaded**:
```bash
curl http://localhost:3000/app-settings
```

2. **Test platform fee in cart**:
```bash
curl http://localhost:3000/buyer/cart -H "Authorization: Bearer TOKEN"
```

3. **Test Razorpay initialization**:
Check server logs for: `🔑 Razorpay initialized with Key ID: rzp_test_...`

4. **Test app operation hours**:
```bash
curl http://localhost:3000/buyer/home
```
Check `app_operation_status` in response.

## Benefits

✅ **No restart required** - Update settings without redeploying  
✅ **Better management** - Use API or database GUI to manage configs  
✅ **Audit trail** - Track when settings were changed  
✅ **Environment independent** - Same code works across dev/staging/prod  
✅ **Secure** - Sensitive settings protected by auth guards  
✅ **Performance** - Cached in memory with auto-refresh  

## Admin UI Integration

You can now build an admin panel to manage these settings:

- List all settings grouped by category
- Toggle active/inactive status
- Edit values with validation
- View change history (add audit logging if needed)
- Bulk import/export for backup

## Troubleshooting

### Settings not loading
- Check if migration ran: `npm run migration:run`
- Verify table exists: `SELECT * FROM app_settings;`
- Check server logs for cache initialization

### Values not updating
- Cache TTL is 1 minute - wait or restart server
- Verify setting is active: `is_active = true`
- Check for database connection issues

### Razorpay not working
- Verify keys in database: `SELECT * FROM app_settings WHERE category='payment';`
- Check initialization logs
- Ensure keys are correct (test vs live)

## Next Steps

Consider migrating additional settings:
- SMS/Email templates
- Feature flags
- Rate limiting configs
- Third-party API keys
- Business rules (min order value, delivery charges, etc.)
