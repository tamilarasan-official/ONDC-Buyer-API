# Coding Standards & Conventions

This document outlines the coding standards and conventions to maintain consistency across the ONDC Buyer API codebase.

## Naming Conventions

### Variables and Properties

**Always use snake_case for:**
- Database column names
- API request/response field names
- Entity properties
- DTO properties

**Examples:**
```typescript
// ✅ Correct
{
  access_token: "...",
  refresh_token: "...",
  existing_user: true,
  phone_number: 1234567890,
  created_at: Date,
  updated_at: Date
}

// ❌ Incorrect
{
  accessToken: "...",
  refreshToken: "...",
  existingUser: true,
  phoneNumber: 1234567890,
  createdAt: Date,
  updatedAt: Date
}
```

**Use camelCase for:**
- TypeScript/JavaScript variables within functions
- Method names
- Class method parameters (internal use)

**Examples:**
```typescript
// ✅ Correct
async function getUserProfile(userId: number) {
  const userProfile = await this.repository.findOne(userId);
  return userProfile;
}

// Method names
async generateOtp(generateOtpDto: GenerateOtpDto) { }
```

### Classes and Interfaces

**Use PascalCase for:**
- Class names
- Interface names
- Entity names
- DTO names
- Enum names

**Examples:**
```typescript
// ✅ Correct
export class User { }
export class UserOtp { }
export class GenerateOtpDto { }
export interface JwtPayload { }
export enum UserRole { }
```

### Files and Folders

**Use kebab-case for:**
- File names
- Folder names

**Examples:**
```
✅ Correct:
- user.entity.ts
- authentication.service.ts
- generate-otp.dto.ts
- user-address.entity.ts

❌ Incorrect:
- User.entity.ts
- authenticationService.ts
- generateOtpDto.ts
- userAddress.entity.ts
```

### Constants

**Use UPPER_SNAKE_CASE for:**
- Global constants
- Environment variable names
- Configuration constants

**Examples:**
```typescript
// ✅ Correct
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_PAGE_SIZE = 10;
```

## API Response Format

### Success Response
All successful API responses follow this structure:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "existing_user": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
All error responses follow this structure:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Field Naming in Responses
- **Always use snake_case** for all field names in API responses
- This applies to nested objects as well
- Keep consistent with database column names

## Database Conventions

### Entity Fields
```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;  // Exception: simple 'id' is acceptable

  @Column({ type: "varchar" })
  phone_number: number;  // ✅ snake_case

  @CreateDateColumn()
  created_at: Date;  // ✅ snake_case

  @UpdateDateColumn()
  updated_at: Date;  // ✅ snake_case
}
```

### Relationship Names
```typescript
@OneToOne(() => UserOtp, (userOtp) => userOtp.user)
@JoinColumn({ name: "otp_id" })  // ✅ snake_case for column name
otp: UserOtp | null;
```

## TypeScript Conventions

### Type Annotations
```typescript
// ✅ Prefer explicit return types for public methods
async login(loginDto: LoginDto): Promise<LoginResponse> {
  // ...
}

// ✅ Use optional chaining and nullish coalescing
const userName = user?.name ?? 'Guest';
```

### Error Handling
```typescript
// ✅ Always use try-catch blocks and throw NestJS exceptions
try {
  const user = await this.userService.login(loginDto);
  return { access_token, refresh_token, existing_user };
} catch (error) {
  throw new BadRequestException('Login failed', error.message);
}
```

### Imports
```typescript
// ✅ Use absolute imports from 'src/'
import { User } from 'src/user/entities/user.entity';
import { generateAccessToken } from 'src/shared/utils/jwt';

// ❌ Avoid relative imports
import { User } from '../user/entities/user.entity';
```

## DTO Conventions

### Validation Decorators
```typescript
export class GenerateOtpDto {
  @IsNumber()
  @IsNotEmpty()
  phone_number: number;  // ✅ snake_case
}
```

### Update DTOs
```typescript
// ✅ Use PartialType for update DTOs
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

## Service Patterns

### Base Service
```typescript
// ✅ Extend BaseService for standard CRUD operations
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super(userRepository);
  }
}
```

### Repository Injection
```typescript
// ✅ Always use @InjectRepository decorator
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,
) {}
```

## Environment Variables

### Naming
- Use UPPER_SNAKE_CASE
- Group related variables with common prefixes

**Examples:**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=secret
JWT_REFRESH_SECRET=refresh_secret

# AWS
AWS_ACCESS_KEY_ID=key
AWS_SECRET_ACCESS_KEY=secret
AWS_REGION=us-east-1
```

## Code Organization

### Module Structure
```
src/
├── module-name/
│   ├── dto/
│   │   ├── create-module.dto.ts
│   │   └── update-module.dto.ts
│   ├── entities/
│   │   └── module.entity.ts
│   ├── module.controller.ts
│   ├── module.service.ts
│   └── module.module.ts
```

### File Naming Pattern
- `*.entity.ts` - Entity files
- `*.dto.ts` - Data Transfer Object files
- `*.service.ts` - Service files
- `*.controller.ts` - Controller files
- `*.module.ts` - Module files
- `*.guard.ts` - Guard files
- `*.interceptor.ts` - Interceptor files
- `*.filter.ts` - Exception filter files

## Comments and Documentation

### JSDoc for Public Methods
```typescript
/**
 * Logs in a user with phone number and OTP
 * @param loginDto - Contains phone_number and otp
 * @returns Access token, refresh token, and existing_user flag
 * @throws BadRequestException if login fails
 */
async login(loginDto: LoginDto) {
  // Implementation
}
```

### Inline Comments
```typescript
// ✅ Use inline comments for complex logic
// Check if user has completed profile (has both name and email)
existing_user: !!(user.name && user.email),
```

## Testing Conventions

### Test File Naming
```
user.service.spec.ts
authentication.controller.spec.ts
```

### Test Structure
```typescript
describe('UserService', () => {
  describe('login', () => {
    it('should return tokens and existing_user flag', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## Quick Reference

| Type | Convention | Example |
|------|-----------|---------|
| API Fields | snake_case | `phone_number`, `existing_user` |
| Database Columns | snake_case | `created_at`, `updated_at` |
| Variables (internal) | camelCase | `userData`, `isValid` |
| Classes | PascalCase | `User`, `UserService` |
| Files/Folders | kebab-case | `user-service.ts` |
| Constants | UPPER_SNAKE_CASE | `JWT_SECRET` |
| Methods | camelCase | `generateOtp()` |

---

**Last Updated:** 2024-10-24

**Note:** When in doubt, refer to existing code patterns in the codebase, and always prioritize consistency over personal preference.
