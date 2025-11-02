# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ONDC Buyer API backend built with NestJS and TypeScript. The application provides user authentication with OTP-based login, user profile management, and file upload capabilities using AWS S3.

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Configure database credentials and other environment variables in .env
```

### Running the Application
```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### Testing
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Debug tests
npm run test:debug
```

### Code Quality
```bash
# Lint and auto-fix
npm run lint

# Format code
npm run format
```

## Architecture

### Core Technology Stack
- **Framework**: NestJS 11.x
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT-based (access + refresh tokens)
- **File Storage**: AWS S3
- **Email**: Nodemailer with Handlebars templates
- **Validation**: class-validator and class-transformer

### Module Structure

The application follows NestJS modular architecture:

- **AuthenticationModule**: Handles OTP generation, login, and token refresh
  - Uses static OTP for development (see authentication.service.ts:20-32)
  - JWT tokens are managed in `src/shared/utils/jwt.ts`
  - Access tokens expire in 1h, refresh tokens in 7d

- **UserModule**: User profile and settings management
  - User entity with optional name/email, required phone_number
  - One-to-one relationship with UserOtp entity

- **Shared Module**: Contains reusable components
  - `BaseService`: Abstract service with CRUD and pagination utilities
  - `ResponseInterceptor`: Wraps all responses in standard format
  - `AllExceptionsFilter`: Standardized error response format
  - `UploadService`: AWS S3 file upload integration
  - `PaginationUtil`: Reusable pagination logic

### Global Configuration

The application is configured in `src/main.ts` with:
- Global validation pipe (whitelist: true, no implicit conversion)
- Class serializer interceptor for entity transformation
- Response interceptor for consistent API responses
- Exception filter for standardized error handling
- CORS enabled for all origins

### Database

- Uses TypeORM with PostgreSQL
- Database synchronize is disabled in production (app.module.ts:62)
- Migrations are located in `src/migrations/`
- Run migrations manually using TypeORM CLI

### Authentication Flow

1. User requests OTP via `/authentication/generate-otp` with phone number
2. OTP is stored in UserOtp entity (currently static for development)
3. User logs in via `/authentication/login` with phone number and OTP
4. Server returns access_token (1h) and refresh_token (7d)
5. Protected routes require Bearer token in Authorization header
6. JwtAuthGuard (src/authentication/jwt-auth.guard.ts) protects routes except:
   - `/authentication/*` routes
   - `/public/*` routes
   - GET requests to `/roles/*`

### Response Format

All successful responses follow this structure (via ResponseInterceptor):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

All error responses follow this structure (via AllExceptionsFilter):
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### File Uploads

- AWS S3 integration via UploadService
- Uses multer-s3 for direct S3 uploads
- Files are stored with UUID-based names
- Environment-specific folder structure (AWS_ENV_NAME)

## Important Conventions

### Import Paths
- Use absolute imports from `src/` (e.g., `import { User } from 'src/user/entities/user.entity'`)
- tsconfig.json has baseUrl set to `./`

### Entity Design
- All entities should have `@CreateDateColumn()` and `@UpdateDateColumn()`
- Use TypeORM decorators consistently
- Entities are auto-loaded from `**/*.entity{.ts,.js}` pattern

### Service Patterns
- Extend BaseService for standard CRUD operations
- Inject repositories via @InjectRepository decorator
- Throw NestJS HTTP exceptions (BadRequestException, NotFoundException, etc.)
- Catch and re-throw specific exceptions in try-catch blocks

### DTOs and Validation
- Use class-validator decorators in DTOs
- Update DTOs typically use PartialType from @nestjs/mapped-types
- Validation pipe is global with whitelist enabled

### Environment Variables
Required environment variables (see .env.example):
- PORT, NODE_ENV
- DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_LOGGING
- JWT_SECRET, JWT_REFRESH_SECRET
- MAILER_HOST, MAILER_PORT, MAILER_USER, MAILER_PASS, MAILER_FROM
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME, AWS_BUCKET_URL, AWS_ENV_NAME

## App Configuration

### Default Location
The app is configured to launch in Madurai, Tamil Nadu first. Default location is available via:
- **API Endpoint**: `GET /config` returns default location and app info
- **Backend Fallback**: LocationService returns Madurai coordinates (9.93523, 78.130404) when no user location is available

### Frontend Integration for Location
To avoid showing foreign locations (e.g., California) in the address picker:
1. Check if location permission is granted
2. If granted, use device's current location
3. If denied or unavailable, fetch `GET /config` and use `default_location.latitude/longitude`
4. Never hardcode California or other foreign locations

## Known Development Notes

- OTP generation currently uses static OTP (see src/authentication/authentication.service.ts:20-32)
- Database synchronize is false; use migrations for schema changes
- JWT secrets have default values for development only (src/shared/utils/jwt.ts:3-4)
- CORS is configured to allow all origins (main.ts:24)
