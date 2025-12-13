# Admin Coupon Management Module - Frontend Implementation Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Data Models & Fields](#data-models--fields)
3. [Features & Capabilities](#features--capabilities)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Implementation Workflow](#implementation-workflow)
6. [UI/UX Design Guidelines](#uiux-design-guidelines)
7. [Step-by-Step Implementation](#step-by-step-implementation)
8. [Best Practices](#best-practices)

---

## Overview

### What is the Coupon Management Module?
A comprehensive admin interface to create, manage, and track coupon campaigns with features like:
- Campaign creation and management
- Bulk coupon code generation
- Export functionality (CSV, PDF, ZIP)
- Real-time analytics and tracking
- Quota management

### Architecture Flow
```
Admin Frontend → API Endpoints → Coupon Service → Database/Redis
```

---

## Data Models & Fields

### 1. Campaign Model

**Entity**: `CouponCampaign`

| Field | Type | Description | Required | Example |
|-------|------|-------------|----------|---------|
| `id` | number | Auto-generated ID | Auto | `1` |
| `campaign_key` | string | Unique identifier (alphanumeric, hyphens, underscores) | ✅ | `"summer-2025-sale"` |
| `title` | string | Campaign display name | ✅ | `"Summer 2025 Sale"` |
| `description` | string | Campaign description | ❌ | `"20% off on all orders"` |
| `created_by` | string | Admin username/email | ❌ | `"admin@example.com"` |
| `status` | enum | Campaign status | ❌ | `"draft"`, `"active"`, `"paused"`, `"archived"` |
| `created_at` | datetime | Creation timestamp | Auto | `"2025-11-26T10:00:00Z"` |
| `updated_at` | datetime | Last update timestamp | Auto | `"2025-11-26T10:00:00Z"` |

**Status Values**:
- `draft` - Campaign created but not active
- `active` - Campaign is live and coupons can be used
- `paused` - Temporarily disabled
- `archived` - Archived for historical records

---

### 2. Coupon Model

**Entity**: `Coupon`

| Field | Type | Description | Required | Example |
|-------|------|-------------|----------|---------|
| `id` | bigint | Auto-generated ID | Auto | `1234567890` |
| `campaign_id` | number | Reference to campaign | ✅ | `1` |
| `code` | string | Unique coupon code | Auto | `"SUMMER-ABC12345"` |
| `type` | enum | Coupon type | ✅ | `"flat"`, `"percent"`, `"free_delivery"`, etc. |
| `value` | number | Discount value | ✅ | `100` or `20` (for percent) |
| `value_type` | enum | Value type | ✅ | `"rupees"`, `"percent"` |
| `max_discount_amount` | number | Max discount cap (for percent) | Conditional | `500` |
| `min_cart_value` | number | Minimum cart value required | ❌ | `500` |
| `start_at` | datetime | Start date/time | ❌ | `"2025-01-01T00:00:00Z"` |
| `expires_at` | datetime | Expiration date/time | ❌ | `"2025-12-31T23:59:59Z"` |
| `user_usage_limit` | number | Uses per user | ❌ | `1` (default: 1) |
| `global_usage_limit` | number | Total uses across all users | ❌ | `1000` (null = unlimited) |
| `priority` | number | Priority for coupon selection when multiple coupons match (higher = selected first) | ❌ | `0` (default: 0) |
| `status` | enum | Coupon status | Auto | `"active"`, `"expired"`, `"exhausted"` |
| `type_meta` | JSON | Type-specific metadata | ❌ | `{"nth": 3}` or `{"delivery_fee_cap": 50}` |
| `exported` | boolean | Whether codes were exported | Auto | `false` |
| `exported_at` | datetime | Export timestamp | Auto | `null` |
| `exported_by` | string | Who exported | Auto | `null` |

**Coupon Types**:
1. **`flat`** - Fixed rupee discount (e.g., ₹100 off)
2. **`percent`** - Percentage discount (e.g., 20% off, max ₹500)
3. **`free_delivery`** - Waives delivery fee
4. **`first_order`** - Discount on user's first order
5. **`nth_order`** - Discount on user's Nth order (requires `type_meta.nth`)
6. **`referral`** - Referral reward coupon

**Value Types**:
- `rupees` - Fixed amount in INR
- `percent` - Percentage value

---

### 3. Campaign Statistics (Computed)

| Metric | Description | Calculation |
|--------|-------------|-------------|
| `total_codes` | Total codes generated | Count of coupons in campaign |
| `active_codes` | Active codes | Count where status = 'active' |
| `redeemed_codes` | Codes used | Count of redemptions |
| `redemption_rate` | Usage percentage | `(redeemed / total) * 100` |
| `total_discount_given` | Total discount amount | Sum of discount_amount from redemptions |
| `remaining_quota` | Available uses | `global_usage_limit - redeemed` |

---

## Features & Capabilities

### Core Features

1. **Campaign Management**
   - Create new campaigns
   - Edit campaign details
   - Activate/Pause/Archive campaigns
   - View campaign list with filters

2. **Code Generation**
   - Bulk generate coupon codes (1-10,000 at once)
   - Custom prefix and length
   - Preview mode (see first 10 codes before generating)
   - Automatic uniqueness validation

3. **Code Management**
   - View all codes in a campaign
   - Search and filter codes
   - View code details (status, usage, expiration)
   - Track redemption history

4. **Export Functionality**
   - Export to CSV (with QR URLs)
   - Export to PDF (printable format, 10 codes per page)
   - Export to ZIP (includes CSV, PDF, metadata.json)
   - Include QR codes in exports

5. **Analytics & Tracking**
   - Campaign performance metrics
   - Redemption statistics
   - Usage trends
   - Quota monitoring

---

## API Endpoints Reference

### Base URL
```
/admin/coupons
```

### 1. Campaign Management

#### Create Campaign
```
POST /admin/coupons/campaigns
Body: {
  campaign_key: string (required, max 80 chars)
  title: string (required)
  description?: string
  created_by?: string (max 64 chars)
  status?: "draft" | "active" | "paused" | "archived"
}
Response: { id, campaign_key, title, ... }
```

#### Update Campaign
```
PATCH /admin/coupons/campaigns/:id
Body: {
  title?: string
  description?: string
  status?: CampaignStatus
}
Response: Updated campaign object
```

#### List Campaigns
```
GET /admin/coupons/campaigns?status=active&page=1&limit=20
Query Params:
  - status?: CampaignStatus (filter)
  - page?: number (default: 1)
  - limit?: number (default: 20)
Response: {
  campaigns: Campaign[],
  total: number,
  page: number,
  limit: number
}
```

#### Get Campaign Details
```
GET /admin/coupons/campaigns/:id
Response: Campaign object with statistics
```

---

### 2. Code Generation

#### Generate Codes
```
POST /admin/coupons/campaigns/:id/generate-codes
Body: {
  count: number (1-10000, required)
  prefix?: string (optional)
  length?: number (6-16, default: 8)
  type: CouponType (required)
  value: number (required, >= 0)
  value_type: "rupees" | "percent" (required)
  max_discount_amount?: number (required if value_type = "percent")
  min_cart_value?: number (default: 0)
  expires_at?: string (ISO 8601)
  start_at?: string (ISO 8601)
  user_usage_limit?: number (default: 1)
  global_usage_limit?: number (null = unlimited)
  priority?: number (default: 0, >= 0)
  preview?: boolean (default: false)
  type_meta?: object (for nth_order, referral, free_delivery, preorder)
}
Response: {
  codes: string[],
  preview: boolean,
  count: number
}
```

**Important Notes**:
- If `preview: true`, only first 10 codes are returned
- `max_discount_amount` is **required** for percent type
- `type_meta.nth` is required for `nth_order` type
- `type_meta.delivery_fee_cap` is optional for `free_delivery` type
- `priority` defaults to `0` if not provided. Higher priority coupons are selected first when multiple coupons match the same item (e.g., multiple preorder coupons for the same item_id)

---

### 3. Code Listing

#### List Codes in Campaign
```
GET /admin/coupons/campaigns/:id/codes?page=1&limit=50
Query Params:
  - page?: number (default: 1)
  - limit?: number (default: 50)
Response: {
  codes: Coupon[],
  total: number,
  page: number,
  limit: number
}
```

---

### 4. Export

#### Export Codes
```
POST /admin/coupons/campaigns/:id/export
Body: {
  format: "csv" | "pdf" | "zip" (required)
  include_qr?: boolean (default: false)
  exported_by?: string
}
Response: File download (binary)
```

**Response Headers**:
- `Content-Type`: `text/csv`, `application/pdf`, or `application/zip`
- `Content-Disposition`: `attachment; filename="campaign-key-codes.{ext}"`

---

## Implementation Workflow

### High-Level Flow

```
1. Create Campaign
   ↓
2. Generate Coupon Codes
   ↓
3. (Optional) Preview Codes
   ↓
4. Export Codes (CSV/PDF/ZIP)
   ↓
5. Monitor Campaign Performance
   ↓
6. Update/Archive Campaign
```

### Detailed Workflow

#### Phase 1: Campaign Setup
1. Admin navigates to "Coupon Management"
2. Clicks "Create New Campaign"
3. Fills campaign form:
   - Campaign Key (unique identifier)
   - Title (display name)
   - Description (optional)
   - Status (default: draft)
4. Submits form → API call to `POST /campaigns`
5. On success, redirect to campaign detail page

#### Phase 2: Code Generation
1. On campaign detail page, click "Generate Codes"
2. Fill generation form:
   - Number of codes (1-10,000)
   - Prefix (optional, e.g., "SUMMER")
   - Code length (6-16, default: 8)
   - Coupon type (flat/percent/free_delivery/etc.)
   - Discount value
   - Value type (rupees/percent)
   - Max discount (if percent)
   - Min cart value
   - Validity dates
   - Usage limits
   - Type-specific metadata (if applicable)
3. (Optional) Enable "Preview Mode" to see first 10 codes
4. Submit → API call to `POST /campaigns/:id/generate-codes`
5. Display generated codes or preview
6. Show success message with count

#### Phase 3: Code Management
1. View codes list (paginated)
2. Search/filter codes
3. View individual code details:
   - Status
   - Redemption count
   - Expiration date
   - Usage limits
4. Track redemptions per code

#### Phase 4: Export
1. Click "Export Codes" button
2. Select format (CSV/PDF/ZIP)
3. Toggle "Include QR Codes" if needed
4. Submit → API call to `POST /campaigns/:id/export`
5. Handle file download
6. Show success message

#### Phase 5: Monitoring
1. View campaign dashboard:
   - Total codes
   - Active codes
   - Redemption rate
   - Total discount given
   - Remaining quota
2. View redemption history
3. Track performance metrics

---

## UI/UX Design Guidelines

### Page Structure

#### 1. Campaign List Page
```
┌─────────────────────────────────────────┐
│  Coupon Management                     │
│  [+ Create Campaign]                   │
├─────────────────────────────────────────┤
│  Filters: [Status ▼] [Search...]       │
├─────────────────────────────────────────┤
│  Campaign List (Table)                  │
│  ┌───────────────────────────────────┐ │
│  │ Key      │ Title    │ Status │ ... │ │
│  ├───────────────────────────────────┤ │
│  │ summer-  │ Summer   │ Active │ ... │ │
│  │ 2025     │ Sale     │        │     │ │
│  └───────────────────────────────────┘ │
│  [Pagination]                          │
└─────────────────────────────────────────┘
```

**Table Columns**:
- Campaign Key
- Title
- Status (with badge)
- Total Codes
- Redemptions
- Created Date
- Actions (View, Edit, Export)

---

#### 2. Campaign Detail Page
```
┌─────────────────────────────────────────┐
│  ← Back to Campaigns                    │
│  Campaign: Summer 2025 Sale            │
│  Status: [Active ▼] [Edit] [Archive]    │
├─────────────────────────────────────────┤
│  Statistics Cards:                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │Total │ │Active│ │Used  │ │Rate  │ │
│  │ 1000 │ │ 850  │ │ 150  │ │ 15%  │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ │
├─────────────────────────────────────────┤
│  [Generate Codes] [Export Codes]        │
├─────────────────────────────────────────┤
│  Codes List (Table with pagination)     │
│  ┌───────────────────────────────────┐ │
│  │ Code        │ Status │ Used │ ... │ │
│  ├───────────────────────────────────┤ │
│  │ SUMMER-ABC  │ Active │ 0/1  │ ... │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

#### 3. Create Campaign Form
```
┌─────────────────────────────────────────┐
│  Create New Campaign                    │
├─────────────────────────────────────────┤
│  Campaign Key*                          │
│  [________________]                     │
│  (alphanumeric, hyphens, underscores)   │
│                                         │
│  Title*                                 │
│  [________________]                     │
│                                         │
│  Description                            │
│  [________________]                     │
│  [________________]                     │
│                                         │
│  Status: [Draft ▼]                       │
│                                         │
│  [Cancel] [Create Campaign]            │
└─────────────────────────────────────────┘
```

**Validation**:
- Campaign Key: Required, unique, max 80 chars
- Title: Required
- Description: Optional, textarea
- Status: Default "draft"

---

#### 4. Generate Codes Form
```
┌─────────────────────────────────────────┐
│  Generate Coupon Codes                  │
├─────────────────────────────────────────┤
│  Basic Settings                         │
│  ─────────────────────────────────────  │
│  Number of Codes*: [1000] (1-10,000)   │
│  Prefix: [SUMMER] (optional)           │
│  Code Length: [8] (6-16)               │
│  ☑ Preview Mode (show first 10 only)   │
│                                         │
│  Discount Configuration                 │
│  ─────────────────────────────────────  │
│  Coupon Type*: [Percent ▼]              │
│  Discount Value*: [20]                  │
│  Value Type*: [Percent ▼]               │
│  Max Discount: [500] (required if %)   │
│  Min Cart Value: [500]                  │
│                                         │
│  Validity                                │
│  ─────────────────────────────────────  │
│  Start Date: [2025-01-01] [00:00]      │
│  Expiry Date: [2025-12-31] [23:59]     │
│                                         │
│  Usage Limits                           │
│  ─────────────────────────────────────  │
│  Uses per User: [1]                     │
│  Global Usage Limit: [1000] (unlimited) │
│                                         │
│  Type-Specific Settings                 │
│  ─────────────────────────────────────  │
│  (Shown based on coupon type)            │
│  For nth_order: Nth Order: [3]          │
│  For free_delivery: Delivery Cap: [50] │
│                                         │
│  [Cancel] [Preview] [Generate Codes]   │
└─────────────────────────────────────────┘
```

**Form Sections**:
1. **Basic Settings**: Count, prefix, length, preview
2. **Discount Configuration**: Type, value, limits
3. **Validity**: Start/end dates
4. **Usage Limits**: Per-user and global
5. **Type-Specific**: Conditional fields based on type

**Conditional Logic**:
- If `type = "percent"` → Show `max_discount_amount` (required)
- If `type = "nth_order"` → Show `type_meta.nth` (required)
- If `type = "free_delivery"` → Show `type_meta.delivery_fee_cap` (optional)
- If `type = "referral"` → Show referral-specific fields

---

#### 5. Export Modal
```
┌─────────────────────────────────────────┐
│  Export Coupon Codes                    │
├─────────────────────────────────────────┤
│  Format*:                                │
│  ○ CSV                                  │
│  ○ PDF                                  │
│  ● ZIP (includes CSV + PDF)             │
│                                         │
│  ☑ Include QR Codes                     │
│                                         │
│  [Cancel] [Export]                      │
└─────────────────────────────────────────┘
```

---

### UI Components Needed

1. **Campaign List Table**
   - Sortable columns
   - Status badges (color-coded)
   - Action buttons (View, Edit, Export)
   - Pagination

2. **Statistics Cards**
   - Total Codes
   - Active Codes
   - Redemptions
   - Redemption Rate
   - Total Discount Given

3. **Code List Table**
   - Code display (copyable)
   - Status badge
   - Usage count (X/Y format)
   - Expiration date
   - Actions (View details)

4. **Form Components**
   - Text inputs with validation
   - Number inputs with min/max
   - Date/time pickers
   - Dropdowns/Selects
   - Checkboxes
   - Conditional fields

5. **Modals**
   - Create Campaign
   - Generate Codes
   - Export Options
   - Confirmation dialogs

6. **Status Badges**
   - Campaign: draft (gray), active (green), paused (yellow), archived (red)
   - Coupon: active (green), expired (red), exhausted (orange)

---

## Step-by-Step Implementation

### Step 1: Setup & Routing

1. **Create Route Structure**
   ```
   /admin/coupons
     ├── /campaigns (list)
     ├── /campaigns/new (create)
     ├── /campaigns/:id (detail)
     ├── /campaigns/:id/edit (edit)
     └── /campaigns/:id/codes (code list)
   ```

2. **Create API Service Layer**
   - Create `couponService.ts` or `couponApi.ts`
   - Implement methods for each endpoint:
     - `createCampaign(data)`
     - `getCampaigns(params)`
     - `getCampaign(id)`
     - `updateCampaign(id, data)`
     - `generateCodes(campaignId, data)`
     - `getCampaignCodes(campaignId, params)`
     - `exportCodes(campaignId, format, includeQr)`

3. **Setup State Management** (if using Redux/Zustand)
   - Campaigns list state
   - Current campaign state
   - Codes list state
   - Loading/error states

---

### Step 2: Campaign List Page

1. **Create Component Structure**
   ```
   CampaignListPage
   ├── CampaignListHeader (title + create button)
   ├── CampaignFilters (status filter + search)
   └── CampaignTable (list + pagination)
   ```

2. **Implementation Steps**:
   - Fetch campaigns on mount: `GET /campaigns`
   - Display in table format
   - Implement status filter dropdown
   - Implement search functionality
   - Add pagination controls
   - Add "Create Campaign" button → navigate to create page

3. **Table Features**:
   - Click row → navigate to detail page
   - Status badge with color coding
   - Actions column (View, Edit, Export)
   - Responsive design

---

### Step 3: Create Campaign Page

1. **Create Form Component**
   ```
   CreateCampaignForm
   ├── CampaignKeyInput (with validation)
   ├── TitleInput
   ├── DescriptionTextarea
   └── StatusSelect
   ```

2. **Implementation Steps**:
   - Create form with validation
   - Validate campaign_key uniqueness (check on blur)
   - Handle form submission
   - Call `POST /campaigns`
   - On success: redirect to campaign detail page
   - On error: display error message

3. **Validation Rules**:
   - Campaign Key: Required, alphanumeric + hyphens/underscores, max 80 chars
   - Title: Required
   - Description: Optional
   - Status: Default "draft"

---

### Step 4: Campaign Detail Page

1. **Create Component Structure**
   ```
   CampaignDetailPage
   ├── CampaignHeader (title, status, actions)
   ├── StatisticsCards (metrics)
   ├── ActionButtons (Generate, Export)
   └── CodesList (table with pagination)
   ```

2. **Implementation Steps**:
   - Fetch campaign details: `GET /campaigns/:id`
   - Display campaign information
   - Calculate and display statistics
   - Fetch codes list: `GET /campaigns/:id/codes`
   - Display codes in table
   - Add "Generate Codes" button → open modal
   - Add "Export Codes" button → open modal
   - Add status update functionality

3. **Statistics Calculation**:
   - Total Codes: Count from codes list
   - Active Codes: Filter by status = 'active'
   - Redemptions: Count redemption records
   - Redemption Rate: (redemptions / total) * 100

---

### Step 5: Generate Codes Modal/Page

1. **Create Form Component**
   ```
   GenerateCodesForm
   ├── BasicSettingsSection
   ├── DiscountConfigSection
   ├── ValiditySection
   ├── UsageLimitsSection
   └── TypeSpecificSection (conditional)
   ```

2. **Implementation Steps**:
   - Create multi-section form
   - Implement conditional fields based on coupon type
   - Add validation:
     - Count: 1-10,000
     - Code length: 6-16
     - Max discount: Required if percent type
     - Type meta: Required for nth_order
   - Handle preview mode toggle
   - On submit:
     - If preview: Show first 10 codes in modal
     - If generate: Call `POST /campaigns/:id/generate-codes`
     - Show success message with count
     - Refresh codes list

3. **Conditional Field Logic**:
   ```javascript
   if (type === 'percent') {
     show max_discount_amount (required)
   }
   if (type === 'nth_order') {
     show type_meta.nth (required)
   }
   if (type === 'free_delivery') {
     show type_meta.delivery_fee_cap (optional)
   }
   ```

---

### Step 6: Export Functionality

1. **Create Export Modal**
   ```
   ExportModal
   ├── FormatSelection (radio buttons)
   ├── IncludeQRCodes (checkbox)
   └── ExportButton
   ```

2. **Implementation Steps**:
   - Create modal with format selection
   - Add "Include QR Codes" checkbox
   - On submit: Call `POST /campaigns/:id/export`
   - Handle file download:
     - Set response type to 'blob'
     - Create download link
     - Trigger download
     - Show success message

3. **File Download Handler**:
   ```javascript
   // Example (React)
   const handleExport = async (format, includeQr) => {
     const response = await exportCodes(campaignId, format, includeQr);
     const blob = new Blob([response.data]);
     const url = window.URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `campaign-${format}.${format}`;
     link.click();
   };
   ```

---

### Step 7: Code List & Management

1. **Create Codes Table Component**
   ```
   CodesTable
   ├── SearchBar
   ├── Table (code, status, usage, expiration)
   └── Pagination
   ```

2. **Implementation Steps**:
   - Fetch codes: `GET /campaigns/:id/codes?page=1&limit=50`
   - Display in table
   - Add search functionality (client-side or API)
   - Add pagination
   - Make codes copyable (click to copy)
   - Show status badges
   - Display usage as "X/Y" format

3. **Code Display Features**:
   - Copy to clipboard on click
   - Status color coding
   - Expiration date formatting
   - Usage count display

---

### Step 8: Edit Campaign

1. **Create Edit Form** (similar to create form)
2. **Implementation Steps**:
   - Pre-fill form with existing data
   - Allow editing title, description, status
   - Call `PATCH /campaigns/:id`
   - Show success message
   - Refresh campaign details

---

### Step 9: Error Handling & Loading States

1. **Loading States**:
   - Show loading spinner during API calls
   - Disable buttons during submission
   - Show skeleton loaders for tables

2. **Error Handling**:
   - Display error messages for API failures
   - Handle validation errors
   - Show user-friendly error messages
   - Log errors for debugging

3. **Success Messages**:
   - Show toast/notification on success
   - Auto-dismiss after 3-5 seconds
   - Provide undo action where applicable

---

### Step 10: Testing & Polish

1. **Test Scenarios**:
   - Create campaign with valid data
   - Create campaign with duplicate key (should fail)
   - Generate codes with preview mode
   - Generate codes without preview
   - Export in all formats
   - Edit campaign
   - Filter and search campaigns
   - Pagination

2. **UI Polish**:
   - Add animations/transitions
   - Improve responsive design
   - Add tooltips for help text
   - Add confirmation dialogs for destructive actions
   - Add keyboard shortcuts

---

## Best Practices

### 1. Form Validation
- **Client-side**: Immediate feedback on input
- **Server-side**: Always validate on API
- **Show errors**: Clear, actionable error messages
- **Prevent submission**: Disable submit if invalid

### 2. User Experience
- **Loading states**: Always show loading indicators
- **Optimistic updates**: Update UI immediately, rollback on error
- **Confirmation dialogs**: For destructive actions
- **Success feedback**: Clear success messages
- **Error recovery**: Provide retry options

### 3. Performance
- **Pagination**: Always paginate large lists
- **Lazy loading**: Load codes on demand
- **Debounce search**: Wait for user to stop typing
- **Cache data**: Cache campaign list, refresh on navigation

### 4. Security
- **Input sanitization**: Sanitize all user inputs
- **CSRF protection**: Include CSRF tokens
- **Rate limiting**: Handle rate limit errors gracefully
- **Authorization**: Check user permissions

### 5. Code Organization
- **Component structure**: Keep components small and focused
- **API layer**: Separate API calls from components
- **State management**: Use appropriate state management solution
- **Type safety**: Use TypeScript for type safety

### 6. Accessibility
- **Keyboard navigation**: Support keyboard-only navigation
- **Screen readers**: Add ARIA labels
- **Focus management**: Manage focus on modals
- **Color contrast**: Ensure sufficient contrast

---

## Additional Features (Optional)

### 1. Analytics Dashboard
- Redemption trends chart
- Campaign performance comparison
- Revenue impact analysis
- User segment analysis

### 2. Bulk Operations
- Bulk activate/pause codes
- Bulk delete codes
- Bulk export selected codes

### 3. Advanced Filters
- Filter by expiration date
- Filter by usage status
- Filter by discount type
- Filter by redemption count

### 4. Notifications
- Alert when quota is low
- Alert when campaign expires
- Daily/weekly performance reports

---

## Summary

This guide provides a comprehensive roadmap for implementing the Coupon Management module on the Admin Frontend. Follow the steps sequentially, starting with basic CRUD operations and gradually adding advanced features. Focus on user experience, error handling, and performance optimization.

**Key Takeaways**:
1. Start with campaign management (CRUD)
2. Add code generation with preview mode
3. Implement export functionality
4. Add analytics and monitoring
5. Polish UI/UX and add advanced features

For API details, refer to the Swagger documentation at `/api-docs` or check the `COUPON_MODULE_README.md` file.

