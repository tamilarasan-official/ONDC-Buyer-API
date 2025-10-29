# ProcessProvider Workflow Documentation

## Overview

The `processProvider` method is the core workflow for processing a single ONDC provider (store) and all its associated data. This method handles the complete ingestion of store information, including locations, fulfillments, categories, items, and offers.

## Method Signature

```typescript
private async processProvider(
  provider: Provider, 
  context: any, 
  queryRunner: any, 
  stats: any
): Promise<void>
```

## Parameters

- **`provider`**: ONDC Provider object containing store data
- **`context`**: ONDC context information (bpp_id, bpp_uri, etc.)
- **`queryRunner`**: Database transaction runner for atomic operations
- **`stats`**: Statistics object to track processed entities

## Workflow Steps

### 1. 🏪 Upsert Store
**Purpose**: Create or update the main store entity

**Process**:
- Find existing store by `reference_id` (provider.id)
- Transform ONDC provider data using `StoreTransformer`
- Validate transformed data
- Save to database

**Data Mapped**:
- Store name, description, logo URL
- FSSAI license number
- GST number (extracted from tags)
- **Food type** (Veg, Non Veg, Vegan, etc.)
- **Tags** (cuisine types array like ["South Indian", "North Indian", "Chinese"])
- Store status (based on time.label)
- TTL (Time To Live)

**Database Entity**: `Store`

### 2. 📍 Upsert Store Locations
**Purpose**: Process all store locations

**Process**:
- Loop through `provider.locations` array
- Transform each location using `LocationTransformer`
- Save GPS coordinates, address details, service areas

**Data Mapped**:
- GPS coordinates
- Address fields (locality, street, city, state)
- Service radius and circle
- Operating hours and schedules

**Database Entity**: `StoreLocation`

### 3. 🚚 Upsert Store Fulfillments
**Purpose**: Process delivery/pickup options

**Process**:
- Loop through `provider.fulfillments` array
- Save fulfillment types (Delivery, Self-Pickup)
- Store contact information

**Data Mapped**:
- Fulfillment type (Delivery, Self-Pickup)
- Contact phone and email

**Database Entity**: `StoreFulfillment`

### 4. 🏷️ Process Store Tags
**Purpose**: Extract configuration and timing data from tags

**Process**: Parse different tag types:
- **`timing`**: Store operating hours → `StoreTimings`
- **`serviceability`**: Service area configs → `StoreConfigs`
- **`close_timing`**: Holiday schedules → `StoreCloseTimings`
- **`order_value`**: Minimum order values → `StoreConfigs`

**Database Entities**: `StoreTimings`, `StoreConfigs`, `StoreCloseTimings`

### 5. 📂 Upsert Categories
**Purpose**: Process store's menu categories with live data management

**Process**:
- **Step 1**: Mark all existing categories as inactive (`status: false`)
- **Step 2**: Loop through `provider.categories` array
- **Step 3**: Transform using `CategoryTransformer`
- **Step 4**: Mark current categories as active (`status: true`)
- **Step 5**: Link categories to the store
- **Step 6**: Process category timings and configs

**Data Mapped**:
- Category name, description, images
- Category timings and availability
- Display order and configuration
- **Status**: Active for current data, inactive for removed categories

**Database Entity**: `Category`

**Live Data Management**:
- Only categories present in current ONDC data remain active
- Categories not in current data are marked as inactive
- Ensures catalog reflects only live/available categories

### 6. 🍕 Upsert Items
**Purpose**: Process all menu items with live data management

**Process**:
- **Step 1**: Mark all existing items as inactive (`status: false`)
- **Step 2**: Loop through `provider.items` array
- **Step 3**: Transform using `ItemTransformer`
- **Step 4**: Mark current items as active (`status: true`)
- **Step 5**: Process item details:
  - **Pricing**: `ItemPrices` (base price, max price, currency)
  - **Quantity**: `ItemQuantities` (available count, unit types)
  - **Attributes**: `ItemAttributes` (custom properties)
  - **Timings**: `ItemTimings` (availability schedules)
  - **Categories**: Link items to categories
  - **Barcodes**: Product identification codes

**Data Mapped**:
- Item name, description, images
- Pricing information (currency, base price, max price)
- Quantity and availability
- Custom attributes and properties
- Availability timings
- Category associations
- **Status**: Active for current data, inactive for removed items

**Database Entities**: `Item`, `ItemPrices`, `ItemQuantities`, `ItemAttributes`, `ItemTimings`, `ItemCategories`, `ItemBarcodes`

**Live Data Management**:
- Only items present in current ONDC data remain active
- Items not in current data are marked as inactive
- Ensures catalog reflects only live/available items

### 7. 🎁 Upsert Offers
**Purpose**: Process promotional offers with live data management

**Process**:
- **Step 1**: Mark all existing offers as inactive (`status: false`)
- **Step 2**: Loop through `provider.offers` array
- **Step 3**: Transform using `OfferTransformer`
- **Step 4**: Mark current offers as active (`status: true`)
- **Step 5**: Process offer details:
  - **Qualifiers**: Conditions for the offer
  - **Benefits**: Discount details
  - **Locations**: Where offer applies
  - **Items**: Which items are included

**Data Mapped**:
- Offer terms and conditions
- Discount amounts and types
- Validity periods
- Applicable locations and items
- **Status**: Active for current data, inactive for removed offers

**Database Entity**: `Offers`

**Live Data Management**:
- Only offers present in current ONDC data remain active
- Offers not in current data are marked as inactive
- Ensures catalog reflects only live/available offers

### 8. 🔗 Post-Process Customization Relationships
**Purpose**: Handle item variants and customizations

**Process**:
- Link customization items to their parent items
- Create variant groups for items with options
- Establish parent-child relationships

**Database Entities**: `ItemCustomizationGroups`, `CustomizationRelationships`, `VariantGroups`, `ItemVariants`

### 9. 📋 Link Customization Items to Categories
**Purpose**: Ensure customization items are properly categorized

**Process**: Link variant/customization items to appropriate categories

### 10. 🗑️ Handle Deletions (Currently Disabled)
**Purpose**: Soft delete items no longer in the catalog

**Status**: Commented out for webhook processing

## Data Flow Pattern

```
ONDC Provider Data
       ↓
   Transformer Layer (Validation & Sanitization)
       ↓
   Database Entities (Upsert Operations)
       ↓
   Relationship Linking (Post-processing)
       ↓
   Statistics Tracking
```

## Key Features

### 1. Transaction Safety
- All operations within a database transaction
- Rollback on any failure
- Atomic operations ensure data consistency

### 2. Data Validation
- Each transformer validates data before saving
- Sanitization of input data
- Error handling with detailed logging

### 3. Error Handling
- Comprehensive error logging
- Graceful failure handling
- Detailed error messages for debugging

### 4. Statistics Tracking
- Counts of processed entities
- Performance monitoring
- Processing metrics

### 5. Upsert Logic
- Updates existing records or creates new ones
- Prevents duplicate entries
- Maintains data integrity

### 6. Relationship Management
- Proper linking between entities
- Foreign key relationships
- Data consistency across tables

## Statistics Tracked

The method tracks the following statistics:

- `stores_upserted`: Number of stores processed
- `categories_upserted`: Number of categories processed
- `items_upserted`: Number of items processed
- `offers_upserted`: Number of offers processed

## Error Handling

The method includes comprehensive error handling:

1. **Validation Errors**: Logged as warnings, processing continues
2. **Transformation Errors**: Logged with full stack trace
3. **Database Errors**: Transaction rollback, error propagation
4. **Missing Data**: Graceful handling of optional fields

## Dependencies

### Transformers Used
- `StoreTransformer`: Store data transformation
- `LocationTransformer`: Location data transformation
- `CategoryTransformer`: Category data transformation
- `ItemTransformer`: Item data transformation
- `OfferTransformer`: Offer data transformation

### Database Entities
- Store-related: `Store`, `StoreLocation`, `StoreFulfillment`, `StoreTimings`, `StoreConfigs`, `StoreCloseTimings`
- Category-related: `Category`, `CategoryTimings`, `CategoryConfigs`
- Item-related: `Item`, `ItemCategories`, `ItemTimings`, `ItemAttributes`, `ItemBarcodes`, `ItemPrices`, `ItemQuantities`, `ItemCustomizationGroups`, `CustomizationRelationships`
- Variant-related: `VariantGroups`, `ItemVariants`
- Offer-related: `Offers`

## Usage Example

```typescript
// Called from processProviderResponse
for (const provider of response.message.catalog['bpp/providers']) {
  await this.processProvider(provider, context, queryRunner, stats);
}
```

## Performance Considerations

1. **Batch Processing**: Items are processed in loops for efficiency
2. **Transaction Management**: Single transaction per provider
3. **Memory Management**: Entities are created and saved immediately
4. **Database Optimization**: Upsert operations minimize database calls

## Future Enhancements

1. **Parallel Processing**: Process items in parallel for better performance
2. **Caching**: Cache frequently accessed data
3. **Batch Operations**: Use bulk insert/update operations
4. **Async Processing**: Queue heavy operations for background processing

## Troubleshooting

### Common Issues

1. **Validation Failures**: Check transformer validation rules
2. **Database Constraints**: Verify foreign key relationships
3. **Memory Issues**: Monitor entity creation in loops
4. **Transaction Timeouts**: Optimize database operations

### Debugging Tips

1. Enable detailed logging in transformers
2. Check database transaction logs
3. Monitor statistics for processing counts
4. Validate ONDC data structure before processing

## Related Files

- `src/catalog-ingestion/catalog-ingestion.service.ts` - Main service file
- `src/catalog-ingestion/transformers/` - Transformer classes
- `src/store/entities/` - Store-related entities
- `src/item/entities/` - Item-related entities
- `src/category/entities/` - Category-related entities
- `src/offer/entities/` - Offer-related entities
- `src/variant/entities/` - Variant-related entities

---

*Last Updated: January 2025*
*Version: 1.0*
