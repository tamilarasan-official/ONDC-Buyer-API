# Tax Fields Implementation for ONDC Buyer App

## 🎯 **Overview**
Added comprehensive tax field support to handle GST and other tax information from ONDC search responses.

## 📊 **Implemented Tax Fields**

### **1. Store Level Tax Information**
**File:** `src/store/entities/store.entity.ts`
```typescript
@Column({ type: "varchar", length: 15, nullable: true })
gst_number?: string; // GST registration number like "22AAAAA0000A1Z5"
```

**DTO Updated:** `src/store/dto/create-store.dto.ts`
```typescript
@IsOptional()
@IsString()
gst_number?: string;
```

### **2. Item Level Tax Information**
**File:** `src/item/entities/item.entity.ts`
```typescript
@Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
tax_rate?: number; // Tax rate percentage like 5.00, 12.00, 18.00, 28.00

@Column({ type: "varchar", length: 20, nullable: true })
tax_type?: string; // "GST", "CGST+SGST", "IGST", "VAT"

@Column({ type: "varchar", length: 20, nullable: true })
hsn_code?: string; // HSN/SAC code for tax classification
```

### **3. Flexible Tax Attributes**
**File:** `src/item/entities/item-attributes.entity.ts`
Enhanced to support tax-related attributes with new attribute group "tax":

**Sample Tax Attributes:**
```typescript
// attribute_group: "tax"
// attribute_code: "tax_exemption", "cess_rate", "additional_tax"
// attribute_value: "exempt", "2.5", "applicable"
```

## 🏗️ **Database Schema Changes**

### **New Columns Added:**

#### **store table:**
- `gst_number` VARCHAR(15) NULL

#### **item table:**
- `tax_rate` DECIMAL(5,2) NULL
- `tax_type` VARCHAR(20) NULL  
- `hsn_code` VARCHAR(20) NULL

#### **item_attributes table:**
- Enhanced to support "tax" attribute group

## 📝 **ONDC Mapping Examples**

### **From ONDC Search Response:**
```json
{
  "tags": [
    {
      "code": "statutory_requirements",
      "list": [
        {
          "code": "gst_number", 
          "value": "22AAAAA0000A1Z5"
        },
        {
          "code": "tax_rate",
          "value": "18"
        },
        {
          "code": "hsn_code",
          "value": "1006"
        }
      ]
    }
  ]
}
```

### **To Database Storage:**
```typescript
// Store entity
store.gst_number = "22AAAAA0000A1Z5"

// Item entity  
item.tax_rate = 18.00
item.tax_type = "GST"
item.hsn_code = "1006"

// Item attributes for additional tax info
{
  attribute_group: "tax",
  attribute_code: "tax_exemption", 
  attribute_value: "no"
}
```

## 🎯 **Use Cases for Buyer App**

### **1. Price Display**
- Show tax-inclusive pricing
- Display tax breakdown to customers
- Calculate total amount with taxes

### **2. Invoice Generation**
- Generate tax invoices with GST details
- Include HSN codes for compliance
- Show tax split (CGST/SGST/IGST)

### **3. Order Management**
- Track tax information per order
- Generate tax reports
- Handle tax exemptions

### **4. Compliance**
- Store GST registration details
- Maintain HSN code records
- Support tax audit requirements

## 🔄 **Next Steps**

1. **Generate Migration:**
   ```bash
   npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate ./src/migrations/add-tax-fields -d ./data-source.ts
   ```

2. **Run Migration:**
   ```bash
   npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d ./data-source.ts
   ```

3. **Update Services:**
   - Add tax calculation logic
   - Implement tax display helpers
   - Create tax validation rules

## 📋 **Sample Tax Data Examples**

### **Different Tax Scenarios:**
```typescript
// Essential items (5% GST)
item.tax_rate = 5.00
item.tax_type = "GST"
item.hsn_code = "1006" // Rice

// Electronics (18% GST)  
item.tax_rate = 18.00
item.tax_type = "GST"
item.hsn_code = "8517" // Mobile phones

// Luxury items (28% GST)
item.tax_rate = 28.00
item.tax_type = "GST" 
item.hsn_code = "8703" // Cars

// Tax-exempt items
item.tax_rate = 0.00
item.tax_type = "EXEMPT"
// Additional attributes:
{attribute_group: "tax", attribute_code: "exemption_reason", attribute_value: "essential_commodity"}
```

## ✅ **Implementation Complete**
- ✅ Store GST number field added
- ✅ Item tax rate, type, and HSN code fields added
- ✅ Flexible tax attributes support via item_attributes
- ✅ DTO validation updated
- ✅ Ready for database migration

**Ready for migration approval and execution!** 🚀
