# Buyer App Variant Management - Implementation Guide

## 📋 Overview
Guide for displaying and managing ONDC product variants on buyer applications using `parent_item_id` grouping.

---

## 🎯 Core Concept

**Single Rule**: All items with the same `parent_item_id` are variants of the same product.

**Example**:
```
Variant Group ID: "VG_100"

Item 1: Cotton T-Shirt - Red Small (parent_item_id: "VG_100")
Item 2: Cotton T-Shirt - Blue Large (parent_item_id: "VG_100")
Item 3: Cotton T-Shirt - Green Medium (parent_item_id: "VG_100")
```

All three items will be grouped and displayed as one product with variant options.

---

## 🔍 Implementation Steps

### Step 1: **Group Items by parent_item_id**

**Logic**:
- Loop through all items in catalog
- Items WITH `parent_item_id` → Group together
- Items WITHOUT `parent_item_id` → Standalone products

**Result**:
- Variant products: Multiple items grouped under one parent
- Regular products: Individual items

---

### Step 2: **Extract Variant Attributes**

**From Variant Group (in categories)**:
```
Variant Group tells you WHAT varies:
- Color
- Size
- Weight/UOM
- Material
etc.
```

**From Individual Items (in tags.attribute)**:
```
Each item has its specific values:
Item 1: color=Red, size=Small
Item 2: color=Blue, size=Large
```

**Action**: Build a list of all possible attribute combinations.

---

### Step 3: **Determine Display Name**

**Options**:

**Option A**: Use common prefix
- "Cotton T-Shirt - Red Small"
- "Cotton T-Shirt - Blue Large"
- Display as: **"Cotton T-Shirt"**

**Option B**: Use first variant name
- Display as: First variant's name

**Option C**: Use variant group descriptor
- If provided in categories

---

### Step 4: **Calculate Price Range**

**For Product Listing**:
```
Show: ₹299 - ₹499
(Minimum to Maximum across all variants)
```

**For Product Details**:
```
Show selected variant's exact price
Price updates when user selects different variant
```

---

## 🎨 UI Display Patterns

### **Product Listing Page (PLP)**

**Variant Product Card**:
```
┌─────────────────────────┐
│   [Product Image]       │
│                         │
│  Cotton T-Shirt         │
│  ₹299 - ₹499           │
│  5 variants available   │
│                         │
│  [View Options]         │
└─────────────────────────┘
```

**Regular Product Card**:
```
┌─────────────────────────┐
│   [Product Image]       │
│                         │
│  Plain White Shirt      │
│  ₹399                   │
│                         │
│  [Add to Cart]          │
└─────────────────────────┘
```

---

### **Product Details Page (PDP)**

**Variant Selection UI**:

```
Cotton T-Shirt
Cotton T-Shirt - Red Small (selected variant name)
₹299  ₹399  (25% OFF)

┌─────────────────────────────────┐
│ Select Color:                   │
│  [Red]  [Blue]  [Green]        │ ← Buttons/Swatches
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Select Size:                    │
│  [Small]  [Medium]  [Large]    │ ← Buttons
└─────────────────────────────────┘

Stock: In Stock
[Add to Cart]
```

**Key Behaviors**:
1. Default: Show first available variant
2. On selection: Update image, price, stock, variant name
3. Disable unavailable combinations
4. Highlight selected options

---

## 🛒 User Interaction Flow

### **Scenario: Customer selects variant**

```
Step 1: Customer lands on PDP
→ Default variant shown (first available)
→ Price: ₹299, Color: Red, Size: Small

Step 2: Customer clicks "Blue"
→ Find variant with: color=Blue, size=Small
→ If exists: Update display
→ If not exists: Keep current or show closest match

Step 3: Customer clicks "Large"
→ Find variant with: color=Blue, size=Large
→ Update: Price, Image, Stock, Name

Step 4: Add to Cart
→ Store specific variant ID (not parent ID)
→ Cart shows: "Cotton T-Shirt - Blue Large"
```

---

## 📦 Cart & Order Management

### **Cart Display**

```
┌────────────────────────────────────────┐
│ Cotton T-Shirt - Red Small             │
│ Color: Red, Size: Small                │
│ ₹299 × 1              [Remove]         │
├────────────────────────────────────────┤
│ Cotton T-Shirt - Blue Large            │
│ Color: Blue, Size: Large               │
│ ₹349 × 2              [Remove]         │
└────────────────────────────────────────┘
```

**Important**: Store individual variant IDs, not parent ID.

### **Order Payload**

Send to ONDC:
```
item_id: "102" (specific variant ID)
NOT: "VG_100" (parent/group ID)
```

---

## 🔎 Search & Filter

### **Search Behavior**

**Query: "Red T-Shirt"**

Match against:
- ✅ Base product name: "Cotton T-Shirt"
- ✅ Variant names: "Cotton T-Shirt - Red Small"
- ✅ Attribute values: color="Red"

**Result**: Show variant product if ANY variant matches.

### **Filter Behavior**

**Filter: Color = Red**

- Show only products that have Red variant available
- On PDP, pre-select Red option

---

## 🎯 Stock Management

### **Availability Check**

**Each variant has independent stock**:
```
Item 101 (Red Small): 99 in stock
Item 102 (Blue Large): 0 in stock
Item 103 (Green Medium): 5 in stock
```

**Display Rules**:
- PLP: Show if ANY variant in stock
- PDP: Disable out-of-stock variants
- Cart: Validate against specific variant stock

**UI States**:
```
[Red]   [Blue]   [Green]
 ✓       ✗         ✓
Active  Disabled  Active
```

---

## 📱 Mobile Considerations

**Variant Selection**:
- Use bottom sheet/modal for variant selection
- Show image preview for each variant
- Sticky "Add to Cart" button

**Quick Add from Listing**:
- Option 1: Direct to PDP (recommended for variants)
- Option 2: Quick select modal on listing page

---

## ⚡ Performance Tips

### **Data Processing**

1. **Initial Load**: Process and group variants once
2. **Cache Results**: Don't reprocess on every render
3. **Lazy Load Images**: Load variant images on selection

### **State Management**

**Store**:
```
processedProducts = [
  {
    id: "VG_100",
    name: "Cotton T-Shirt",
    isVariant: true,
    variants: [...],  // All variant items
    attributes: [...], // Color, Size options
    priceRange: { min: 299, max: 499 },
    defaultVariant: {...} // First available
  },
  {
    id: "201",
    name: "Plain Shirt",
    isVariant: false,
    ...
  }
]
```

---

## 🎨 Visual Examples

### **Example 1: Grocery (UOM Variants)**

```
Ashirwad Atta
₹65 - ₹300

Select Pack Size:
[1 kg]  [2 kg]  [5 kg]

Selected: 1 kg Pack - ₹65
```

### **Example 2: Fashion (Color & Size)**

```
Levi's Jeans
₹1,299 - ₹1,899

Select Color:
[🔵 Blue]  [⚫ Black]  [🔴 Faded Blue]

Select Size:
[30]  [32]  [34]  [36]  [38]

Selected: Blue - Size 32 - ₹1,499
```

### **Example 3: Electronics (Storage Variants)**

```
iPhone 15
₹79,900 - ₹1,34,900

Select Storage:
[128GB]  [256GB]  [512GB]

Select Color:
[Black]  [Blue]  [Pink]

Selected: 256GB - Black - ₹89,900
```

---

## ✅ Best Practices

### **Do's**
✅ Group by `parent_item_id` exclusively  
✅ Show price range on listing  
✅ Update price/image on variant change  
✅ Disable unavailable variants  
✅ Store individual variant ID in cart  
✅ Show clear attribute labels  
✅ Provide visual feedback on selection  

### **Don'ts**
❌ Don't show parent ID in cart/orders  
❌ Don't assume all attributes always available  
❌ Don't let users add unavailable variants  
❌ Don't group products without `parent_item_id`  
❌ Don't hardcode attribute names  
❌ Don't ignore variant stock status  

---

## 🔧 Edge Cases

### **Case 1: Missing Variant Group**
```
Items have parent_item_id but no variant group in categories
→ Fallback: Group by parent_item_id anyway
→ Extract attributes from item tags
```

### **Case 2: Incomplete Attribute Data**
```
Some variants missing attribute values
→ Show those variants but with limited filters
→ Use variant name for differentiation
```

### **Case 3: All Variants Out of Stock**
```
→ Still show product in listing
→ Mark as "Out of Stock"
→ Option: Notify when available
```

---

## 📊 Testing Checklist

- [ ] Variants grouped correctly by `parent_item_id`
- [ ] Standalone products displayed separately
- [ ] Price updates on variant selection
- [ ] Image changes on variant selection
- [ ] Out-of-stock variants disabled
- [ ] Cart stores correct variant ID
- [ ] Search finds products by variant attributes
- [ ] Filters work across variants
- [ ] Mobile responsive variant selectors
- [ ] Accessibility (keyboard navigation, screen readers)

---

## 🎓 Quick Reference

**Data Source**: `catalog.bpp/providers[].items[]`

**Grouping Field**: `item.parent_item_id`

**Variant Definition**: `catalog.bpp/providers[].categories[]` (type: variant_group)

**Attribute Values**: `item.tags[]` (code: attribute)

**Cart/Order**: Use `item.id` (NOT `parent_item_id`)

---

## 📚 ONDC Documentation References

### **Key Differences: F&B vs Grocery**

| Feature | F&B (Customizations) | Grocery (Variants) |
|---------|---------------------|-------------------|
| **Base Item Included** | ✅ YES | ❌ NO |
| **Type** | `customization` | Variant items only |
| **Related Field** | `"related": true` | Not used |
| **Parent Linking** | Via `parent` tag to custom_group | Via `parent_item_id` to variant_group |
| **Group Type** | `custom_group` | `variant_group` |
| **Purpose** | Make-to-order configurations | Different pack sizes/UOM |
| **Price** | Additive (base + customizations) | Independent per variant |
| **Example** | Pizza + Toppings | 1kg, 2kg, 5kg Atta |

### **Important Notes**

1. **Grocery/Fashion/Electronics**: Use variants (NO base product sent)
2. **F&B**: Use customizations (base product + customization items)
3. **Buyer App**: Groups variants automatically by `parent_item_id`
4. **Cart/Orders**: Always use specific variant `item.id`, never `parent_item_id`

---

## 🔗 Related Documentation

- [ONDC Catalog Specifications](https://github.com/ONDC-Official/ONDC-Protocol-Specs)
- [Variant Implementation Examples](https://github.com/ONDC-Official/verification-logs)
- [Seller App Variant Logic](./seller-app-variant-implementation.md)

---

**Last Updated**: December 5, 2025  
**Version**: 1.0  
**Maintained by**: Valar Digital Ecom Team
