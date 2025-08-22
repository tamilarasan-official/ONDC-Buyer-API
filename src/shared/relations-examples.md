# Relations with Global Pagination System

This document shows how to use relations with the global pagination system.

## 🚀 **How Relations Work**

The pagination system now supports loading related entities using TypeORM's `leftJoinAndSelect`.

## 📝 **API Usage Examples**

### **1. Basic Relations**
```http
GET /role?relations=permissions,users
```

### **2. Relations with Pagination**
```http
GET /role?page=1&limit=10&relations=permissions,users
```

### **3. Relations with Search**
```http
GET /role?page=1&limit=10&search=admin&relations=permissions
```

### **4. Relations with Sorting**
```http
GET /role?page=1&limit=10&sortBy=name&sortOrder=ASC&relations=permissions,users
```

### **5. Multiple Relations**
```http
GET /role?relations=permissions,users,department,createdBy
```

## 🔧 **Service Implementation**

### **Basic Usage**
```typescript
@Injectable()
export class RoleService {
  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.roleRepository,
      paginationDto,
      ['name', 'description'],
      'createdAt',
      undefined, // additionalWhere
      ['permissions'] // default relations
    );
  }
}
```

### **Advanced Usage with Default Relations**
```typescript
@Injectable()
export class UserService {
  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.userRepository,
      paginationDto,
      ['firstName', 'lastName', 'email'],
      'createdAt',
      undefined, // additionalWhere
      ['role', 'profile', 'department'] // always load these relations
    );
  }
}
```

### **Product Service with Relations**
```typescript
@Injectable()
export class ProductService {
  async findAll(paginationDto: PaginationDto) {
    return PaginationUtil.findWithPagination(
      this.productRepository,
      paginationDto,
      ['name', 'description', 'category'],
      'price',
      undefined, // additionalWhere
      ['category', 'brand', 'images'] // default relations
    );
  }
}
```

## 📊 **Response Format with Relations**

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
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "permissions": [
          {
            "id": 1,
            "name": "read_users",
            "description": "Can read users"
          },
          {
            "id": 2,
            "name": "write_users",
            "description": "Can write users"
          }
        ],
        "users": [
          {
            "id": 1,
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com"
          }
        ]
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

## 🛠 **Entity Relations Setup**

### **Role Entity with Relations**
```typescript
@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Permission, permission => permission.role)
  permissions: Permission[];

  @OneToMany(() => User, user => user.role)
  users: User[];
}
```

### **User Entity with Relations**
```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @ManyToOne(() => Role, role => role.users)
  role: Role;

  @OneToOne(() => Profile, profile => profile.user)
  profile: Profile;

  @ManyToOne(() => Department, department => department.users)
  department: Department;
}
```

## 🎯 **Available Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `relations` | string | Comma-separated list of relations to load |

## 🔍 **Search in Relations**

### **Search in Related Fields**
```typescript
// In your service
async findAll(paginationDto: PaginationDto) {
  return PaginationUtil.findWithPagination(
    this.userRepository,
    paginationDto,
    ['firstName', 'lastName', 'email', 'role.name', 'department.name'], // Include relation fields
    'createdAt',
    undefined,
    ['role', 'department']
  );
}
```

### **API Usage**
```http
GET /users?search=admin&relations=role,department
```

## 🚨 **Important Notes**

1. **Performance**: Loading many relations can impact performance
2. **Nested Relations**: Use dot notation for nested relations (e.g., `role.permissions`)
3. **Default Relations**: Set commonly used relations as defaults in your service
4. **Optional Relations**: Users can override default relations via query parameter
5. **Validation**: Ensure relation names match your entity definitions

## 🔧 **Custom Query Builder with Relations**

```typescript
async findAll(paginationDto: PaginationDto) {
  const options = PaginationUtil.buildPaginationOptions(paginationDto);
  
  const queryBuilder = this.roleRepository.createQueryBuilder('role')
    .leftJoinAndSelect('role.permissions', 'permissions')
    .leftJoinAndSelect('role.users', 'users')
    .leftJoinAndSelect('users.profile', 'profile');
  
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

## 🎯 **Benefits**

1. **Flexible**: Load only the relations you need
2. **Performance**: Optimized queries with proper joins
3. **Consistent**: Same pagination format with relations
4. **Reusable**: Works across all services
5. **Type Safe**: Full TypeScript support 