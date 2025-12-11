# Preorder Booking - Frontend Buyer App Logic

## 📱 Overview

This document outlines the frontend implementation logic for the preorder booking feature in the buyer mobile app. It covers user flows, API integration, state management, and UX considerations.

**Note:** This guide focuses on logic and flows. Code implementation details are handled by the development team based on their chosen framework (React Native, Flutter, etc.).

## 🎯 User Flows

### Flow 1: Discover Preorder Campaign

```
User browses store → Sees preorder badge on item → Taps item → Views preorder details
```

**UI Elements:**
- Preorder badge/ribbon on item card
- "Add to Cart" button (works for both regular and preorder items)
- Campaign info: "100 slots available", "Delivery on Dec 15"

### Flow 2A: Add Preorder to Cart (Recommended)

```
User taps "Add to Cart" → Selects customizations → Item added to cart → Views cart
```

**UI Elements:**
- Customization selection screen
- Cart screen showing preorder items with badge
- Preorder campaign info in cart item
- "Proceed to Checkout" button

### Flow 2: Checkout Cart with Preorder

```
User views cart → Taps "Checkout" → System reserves preorders → Selects address → Pays → Order created
```

**UI Elements:**
- Cart screen with preorder items highlighted
- Checkout screen
- Address selection
- Payment method selection
- Payment gateway integration
- Order confirmation screen

## 🔄 API Integration

### 1. Get Items with Preorder Info

**Endpoints** (existing, enhanced with preorder info):
- `GET /api/buyer/restaurants/:id/menu` - Restaurant menu with items
- `GET /api/buyer/restaurants/:id` - Restaurant details with items
- `GET /api/buyer/search/items` - Search items

**Preorder Info in Item Response:**
Each item in the response should include preorder campaign info (if active):
- `is_preorder_available`: boolean - Whether item has active preorder campaign
- `preorder_campaign`: object (optional) - Campaign details if available
  - `id`: Campaign ID
  - `title`: Campaign title
  - `available_slots`: Number of slots remaining
  - `delivery_date`: Delivery date
  - `discount_amount`: Discount amount (flat or percentage)
  - `free_delivery`: Whether free delivery is included

**UI Display:**
- If `is_preorder_available` is true: Show preorder badge with "Preorder" text and available slots count
- Show "Add to Cart" button (cart-based flow)
- Badge should be visually distinct (e.g., orange/gold color)
- Display campaign info when user views item details

### 3. Add Preorder Item to Cart

**Endpoint**: `POST /api/buyer/cart/add`

**Request:**
- Method: POST
- Headers: Authorization token required
- Body includes:
  - `restaurant_id`: Store ID
  - `item_id`: Item ID
  - `quantity`: Must be 1 for preorders
  - `is_preorder`: true (flag to indicate preorder)
  - `campaign_id`: Optional campaign ID
  - `customizations`: Optional array of customization selections
  - `variants`: Optional array of variant selections

**Error Handling:**
- If quantity error: Show "Preorder items can only be added with quantity 1"
- If slots error: Show "All preorder slots are taken"
- If already reserved: Show "You already have a reservation for this item"
- If cart mixing error: Show "Cannot add preorder items to cart with regular items. Please clear your cart first."
- If multiple preorder items: Show "Only one preorder item is allowed per cart. Please remove existing preorder item first."
- On success: Show success message and update cart state

### 4. Get Cart (Shows Preorder Items)

**Endpoint**: `GET /api/buyer/cart`

**Response includes:**
- Cart items array
- Each item includes: id, item details, quantity, is_preorder flag
- If preorder item: includes preorder_campaign object with id, title, delivery_date, available_slots

**UI Display:**
- Show item image, name, quantity, and price
- If `is_preorder` is true: Display preorder badge with:
  - Preorder icon/text
  - Campaign title
  - Delivery date (formatted)
  - Available slots count
- Show applied discount if coupon is auto-applied
- Show free delivery indicator if applicable

### 5. Checkout Cart with Preorders

**Endpoint**: `POST /api/buyer/orders`

**Request:**
- Method: POST
- Headers: Authorization token required
- Body includes:
  - `delivery_address_id`: Selected delivery address ID
  - `payment_method`: "online" or "cod"

**Flow:**
1. Show loading indicator ("Reserving preorders...")
2. Make API call to create order
3. On success:
   - Clear cart from state
   - If online payment: Navigate to payment gateway with payment details
   - If COD: Navigate to order confirmation screen
4. On error:
   - If quota/slots error: Show error and refresh cart
   - Otherwise: Show error message

**Error Handling:**
- If preorder slots no longer available: Show error and refresh cart to show updated status
- Handle network errors gracefully

**Note:** Direct reservation flow is not used in cart-based approach. All preorders go through cart.

## 🎨 UI/UX Considerations

### 1. Preorder Badge Design

**Visual Elements:**
- Preorder icon/badge on item cards
- Distinct color (e.g., orange/gold)
- Animated pulse effect (optional)
- Clear "Preorder" text
- Show available slots count

**Styling Guidelines:**
- Make badge visually distinct from regular items
- Ensure badge is readable on all backgrounds
- Use consistent styling across the app

### 2. Error Handling

**Common Error Messages:**
- "Sorry, all slots are taken" - When quota exhausted
- "You already have a reservation for this item" - When user limit reached
- "This preorder is not available for this item" - When item mismatch
- "Preorder campaign has ended" - When campaign expired
- "Preorder campaign starts soon" - When campaign not started yet
- "Cannot add preorder items to cart with regular items" - When mixing cart types
- "Preorder items can only be added with quantity 1" - When quantity invalid

**Error Display:**
- Show toast/alert with error message
- Provide actionable feedback
- Allow user to retry or navigate away

### 4. Cart Screen with Preorder Items

**Screen Layout:**
- Cart title
- List of cart items
- For preorder items: Show preorder badge, campaign info, discount applied
- Cart summary (subtotal, discount, delivery fee, tax, final amount)
- "Proceed to Checkout" button

**Preorder Item Display:**
- Preorder badge/indicator
- Campaign title
- Delivery date
- Available slots count
- Applied discount amount
- Free delivery indicator (if applicable)

**Info Box:**
- Show warning: "Preorder items will be reserved during checkout"
- Remind user: "Slots are limited - complete checkout quickly"

**Note:** Cart can only contain preorder items OR regular items, not both. If user tries to mix, validation will show error.

### 5. Preorder Validation Before Checkout

**Validation Logic:**
- Before checkout, validate all preorder items in cart
- For each preorder item:
  - Check campaign is still active
  - Check slots are still available
  - Check user hasn't already reserved
- If validation fails:
  - Show error message with item name
  - Offer option to remove invalid item
  - Prevent checkout until resolved

**Error Scenarios:**
- Campaign no longer available
- All slots taken
- User already has reservation

### 6. Loading States

**When to Show:**
- When fetching campaigns
- When adding item to cart
- When reserving preorder (during checkout)
- When creating order

**Loading Messages:**
- "Loading campaigns..."
- "Adding to cart..."
- "Reserving preorder..."
- "Creating order..."

### 7. Success States

**Success Indicators:**
- Success animation/icon when item added to cart
- Success message: "Preorder item added to cart. ₹30 discount applied!"
- Order confirmation screen after successful checkout

## 📱 State Management

### Global State Management

**State to Maintain:**
- Preorder campaigns list (cached)
- Cart state (includes preorder items)
- Loading states
- Error states

**Actions Needed:**
- Fetch campaigns
- Add preorder to cart
- Remove preorder from cart
- Validate cart preorders
- Checkout cart with preorders
- Refresh cart

**State Updates:**
- Update campaigns when store/item pages load
- Update cart when items added/removed
- Clear cart after successful checkout

### Local Storage

**What to Store:**
- Cached campaigns (optional, for offline support)
- Cart state (optional, for persistence)

**Storage Keys:**
- Campaign cache key
- Cart state key

**Note:** For cart-based flow, reservation tokens are handled server-side during checkout, so no need to store reservation tokens locally.

## 🔔 Push Notifications

### Notification Triggers

1. **Reservation Success**
   ```
   Title: "Preorder Reserved!"
   Body: "Complete payment within 15 minutes to confirm your preorder"
   Action: Deep link to confirmation screen
   ```

2. **Expiry Warning (2 minutes left)**
   ```
   Title: "Hurry! Reservation expiring soon"
   Body: "Your preorder reservation expires in 2 minutes"
   Action: Deep link to payment screen
   ```

3. **Reservation Expired**
   ```
   Title: "Reservation Expired"
   Body: "Your preorder reservation has expired. Slots are available again"
   Action: Deep link to item page
   ```

4. **Campaign Started**
   ```
   Title: "Preorder Now Available!"
   Body: "{Campaign Title} is now available for preorder"
   Action: Deep link to item page
   ```

## 🧪 Testing Scenarios

### 1. Happy Path
- User sees preorder badge
- Taps "Reserve Now"
- Selects customizations
- Confirms reservation
- Completes payment
- Order created successfully

### 2. Expiry Flow
- User reserves preorder
- Waits 15 minutes
- Reservation expires
- User tries to complete payment
- Shows expired message
- User can reserve again if slots available

### 3. Quota Exhausted
- User tries to reserve
- All 100 slots taken
- Shows "All slots taken" message
- Option to join waitlist (if implemented)

### 4. User Already Reserved
- User has active reservation
- Tries to reserve again
- Shows "You already have a reservation" message
- Option to view existing reservation

### 5. Payment Failure
- User confirms preorder
- Payment fails
- Reservation still active
- User can retry payment
- Reservation expires if not paid

## 📊 Analytics Events

**Events to Track:**
- `preorder_campaign_viewed` - When user views item with preorder badge
  - Data: campaign_id, item_id, store_id
- `preorder_added_to_cart` - When preorder item added to cart
  - Data: campaign_id, item_id, store_id
- `preorder_checkout_started` - When user starts checkout with preorder
  - Data: campaign_id, item_id
- `preorder_order_created` - When order created successfully
  - Data: campaign_id, order_id, payment_method
- `preorder_cart_validation_failed` - When validation fails during checkout
  - Data: campaign_id, error_reason

## 🎯 Best Practices

1. **Cache Campaigns**: Cache preorder campaigns to reduce API calls
2. **Poll for Updates**: Refresh campaign data every 30 seconds on item pages
3. **Offline Handling**: Show cached data when offline, sync when online
4. **Error Recovery**: Retry failed API calls with exponential backoff
5. **User Feedback**: Always show loading states and error messages
6. **Deep Linking**: Support deep links to preorder screens
7. **Background Sync**: Check reservation expiry in background

## 🔄 Complete User Journey

### Journey A: Cart-Based Flow (Recommended)

```
1. User opens app → Sees store/item listing
2. Item has preorder badge → User taps item
3. Item detail page → Shows preorder info → User taps "Add to Cart"
4. Customization screen → User selects options → Taps "Add to Cart"
5. Cart screen → Shows preorder item with badge → User taps "Checkout"
6. Checkout screen → System reserves preorder → User selects address
7. Payment method selection → User chooses payment method
8. Payment screen → User completes payment
9. Order confirmation → Shows order details → User can track order
```

## 🛒 Cart Integration Details

### Cart Screen Display

**Layout:**
- Cart title
- List of cart items (preorder items will have badge)
- Cart summary section showing:
  - Subtotal
  - Discount amount (if preorder coupon applied)
  - Delivery fee (0 if free delivery)
  - Tax amount
  - Final amount
- "Proceed to Checkout" button

**Preorder Item Display:**
- Show preorder badge
- Display campaign title
- Show delivery date
- Show available slots
- Display applied discount
- Show free delivery indicator

**Important Notes:**
- Cart can only contain preorder items OR regular items, not both
- Only ONE preorder item is allowed per cart (regardless of campaign)
- If user tries to add different type, show error: "Cannot add [type] items to cart with [other type] items. Please clear your cart first."
- If user tries to add second preorder item, show error: "Only one preorder item is allowed per cart. Please remove existing preorder item first."

### Preorder Validation Before Checkout

**Validation Steps:**
1. Before allowing checkout, validate all preorder items
2. For each preorder item:
   - Check campaign is still active
   - Check slots are available
   - Check user hasn't already reserved
3. If validation fails:
   - Show error with item name
   - Offer to remove invalid item
   - Prevent checkout

**Error Handling:**
- Show dialog with error message
- Provide "Remove Item" and "Cancel" options
- Refresh cart after removing item

## 📝 Implementation Checklist

- [ ] API integration for all endpoints
- [ ] Preorder badge component
- [ ] Add preorder to cart functionality
- [ ] Cart screen with preorder items display
- [ ] Preorder validation in cart
- [ ] Checkout flow with preorder reservation
- [ ] Countdown timer component
- [ ] Payment flow integration
- [ ] My Preorders screen
- [ ] Error handling
- [ ] Loading states
- [ ] Push notifications
- [ ] Deep linking
- [ ] Analytics tracking
- [ ] Offline support
- [ ] State management
- [ ] Local storage
- [ ] Testing

