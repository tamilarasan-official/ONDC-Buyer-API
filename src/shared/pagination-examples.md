# Global Pagination System Examples

This document shows how to use the global pagination system across all your services.

## 🚀 **Quick Start - Using Pagination in Services**

### 1. **Simple Usage (Recommended)**
```typescript
// In your service
import { PaginationDto } from '../shared/dto/pagination.dto';
import { PaginationUtil } from '../shared/utils/pagination.util';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.roleRepository,
      paginationDto,
      ['name', 'description'], // Searchable fields
      'createdAt' // Default sort field
    );
  }
}
```

### 2. **Using Base Service (Advanced)**
```typescript
// In your service
import { BaseService } from '../shared/base/base.service';

@Injectable()
export class RoleService extends BaseService<Role> {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {
    super(roleRepository);
  }

  async findAll(paginationDto: PaginationDto) {
    return this.findAllWithPagination(
      paginationDto,
      ['name', 'description'],
      'createdAt'
    );
  }
}
```

## 📝 **Controller Implementation**

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { PaginationDto } from '../shared/dto/pagination.dto';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.roleService.findAll(paginationDto);
  }
}
```

## 🔍 **API Usage Examples**

### **Basic Pagination**
```http
GET /role?page=1&limit=10
```

### **With Search**
```http
GET /role?page=1&limit=10&search=admin
```

### **With Sorting**
```http
GET /role?page=1&limit=10&sortBy=name&sortOrder=ASC
```

### **With Status Filter**
```http
GET /role?page=1&limit=10&status=true
```

### **Combined Filters**
```http
GET /role?page=2&limit=20&search=user&sortBy=createdAt&sortOrder=DESC&status=true
```

## 📊 **Response Format**

### **Success Response**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "data": [
      {
        "id": 1,
        "name": "admin",
        "description": "Administrator role",
        "status": true,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🛠 **Advanced Usage**

### **Custom Search Fields**
```typescript
// Search in multiple fields
const result = await PaginationUtil.findWithPagination(
  this.roleRepository,
  paginationDto,
  ['name', 'description', 'email'], // Multiple searchable fields
  'createdAt'
);
```

### **Additional Where Conditions**
```typescript
// Add custom filters
const result = await PaginationUtil.findWithPagination(
  this.roleRepository,
  paginationDto,
  ['name', 'description'],
  'createdAt',
  { status: true, isActive: true } // Additional where conditions
);
```

### **Custom Query Builder**
```typescript
// For complex queries
async findAll(paginationDto: PaginationDto) {
  const options = PaginationUtil.buildPaginationOptions(paginationDto);
  
  const queryBuilder = this.roleRepository.createQueryBuilder('role')
    .leftJoinAndSelect('role.permissions', 'permissions');
  
  PaginationUtil.applyPagination(
    queryBuilder, 
    options, 
    ['role.name', 'role.description'],
    'role.createdAt'
  );
  
  const [data, total] = await queryBuilder.getManyAndCount();
  return PaginationUtil.createPaginatedResponse(data, total, options);
}
```

## 📋 **Available Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 10 | Items per page (max 100) |
| `search` | string | - | Search term for specified fields |
| `sortBy` | string | 'createdAt' | Field to sort by |
| `sortOrder` | 'ASC' \| 'DESC' | 'DESC' | Sort direction |
| `status` | boolean | - | Filter by status |

## 🔧 **Implementation for Other Services**

### **User Service Example**
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.userRepository,
      paginationDto,
      ['firstName', 'lastName', 'email'], // User-specific search fields
      'createdAt'
    );
  }
}
```

### **Product Service Example**
```typescript
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.productRepository,
      paginationDto,
      ['name', 'description', 'category'], // Product-specific search fields
      'price' // Sort by price by default
    );
  }
}
```

## 🎯 **Benefits**

1. **Consistent API**: All services use the same pagination format
2. **Reusable**: Write once, use everywhere
3. **Flexible**: Supports search, sorting, and filtering
4. **Type Safe**: Full TypeScript support
5. **Performance**: Optimized database queries
6. **Maintainable**: Centralized pagination logic

## 🚨 **Important Notes**

- **Search is case-insensitive** and uses LIKE queries
- **Maximum limit is 100** to prevent performance issues
- **Sort fields must exist** in your entity
- **Search fields must be specified** for search functionality
- **Status filter is optional** and only works if your entity has a status field 