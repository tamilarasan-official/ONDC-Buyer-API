import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "src/authentication/jwt-auth.guard";
import { UpdateAddressDto, UpdateUserDto } from "./dto/update-user.dto";
import { CreateAddressDto } from "./dto/create-user.dto";

@ApiTags("User Management")
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user profile",
    description:
      "Retrieve the authenticated user's profile information including personal details and preferences.",
  })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Profile retrieved successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", example: "john@example.com" },
            phone_number: { type: "number", example: 9876543210 },
            status: { type: "boolean", example: true },
            created_at: { type: "string", example: "2025-01-15T10:30:00Z" },
            updated_at: { type: "string", example: "2025-01-15T10:30:00Z" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async profile(@Req() req) {
    return this.userService.profile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update user profile",
    description:
      "Update the authenticated user's profile information including name, email, and other personal details.",
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Profile updated successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            name: { type: "string", example: "John Doe Updated" },
            email: { type: "string", example: "john.updated@example.com" },
            phone_number: { type: "number", example: 9876543210 },
            status: { type: "boolean", example: true },
            updated_at: { type: "string", example: "2025-01-15T12:00:00Z" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid data provided",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid email format" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async updateProfile(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateProfile(req.user, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("address")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add new address",
    description:
      "Add a new delivery address for the authenticated user. Users can have multiple addresses for different locations.",
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: "Address added successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address added successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            address1: { type: "string", example: "123 Main Street" },
            address2: { type: "string", example: "Apartment 4B" },
            address3: { type: "string", example: "Near City Mall" },
            city: { type: "string", example: "Bangalore" },
            state: { type: "string", example: "Karnataka" },
            pincode: { type: "string", example: "560001" },
            latitude: { type: "number", example: 9.93523 },
            longitude: { type: "number", example: 78.130404 },
            type: { type: "string", example: "home" },
            is_default: { type: "boolean", example: false },
            created_at: { type: "string", example: "2025-01-15T12:00:00Z" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid address data",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid address format" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async addAddress(@Req() req, @Body() createAddressDto: CreateAddressDto) {
    return this.userService.addAddress(req.user, createAddressDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("address/:id")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update address",
    description:
      "Update an existing address for the authenticated user. Only the user who owns the address can update it.",
  })
  @ApiParam({
    name: "id",
    description: "Address ID to update",
    example: 1,
    type: "number",
  })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({
    status: 200,
    description: "Address updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address updated successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            address1: { type: "string", example: "123 Updated Street" },
            address2: { type: "string", example: "Apartment 5B" },
            city: { type: "string", example: "Bangalore" },
            state: { type: "string", example: "Karnataka" },
            pincode: { type: "string", example: "560001" },
            latitude: { type: "number", example: 9.93523 },
            longitude: { type: "number", example: 78.130404 },
            type: { type: "string", example: "home" },
            is_default: { type: "boolean", example: true },
            updated_at: { type: "string", example: "2025-01-15T12:30:00Z" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid address data",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid address format" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Address not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Address not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async updateAddress(
    @Req() req,
    @Param("id") id: number,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(req.user, id, updateAddressDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("address")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get all addresses",
    description:
      "Retrieve all delivery addresses for the authenticated user. Addresses are sorted by default status and creation date.",
  })
  @ApiResponse({
    status: 200,
    description: "Addresses retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Addresses retrieved successfully",
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              address1: { type: "string", example: "123 Main Street" },
              address2: { type: "string", example: "Apartment 4B" },
              address3: { type: "string", example: "Near City Mall" },
              city: { type: "string", example: "Bangalore" },
              state: { type: "string", example: "Karnataka" },
              pincode: { type: "string", example: "560001" },
              latitude: { type: "number", example: 9.93523 },
              longitude: { type: "number", example: 78.130404 },
              type: { type: "string", example: "home" },
              is_default: { type: "boolean", example: true },
              created_at: { type: "string", example: "2025-01-15T12:00:00Z" },
              updated_at: { type: "string", example: "2025-01-15T12:00:00Z" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async getAllAddresses(@Req() req) {
    return this.userService.getAllAddresses(req.user);
  }

  @Get("address/:id")
  @ApiOperation({
    summary: "Get address by ID",
    description:
      "Retrieve a specific address by its ID. This endpoint is public and can be used to get address details.",
  })
  @ApiParam({
    name: "id",
    description: "Address ID to retrieve",
    example: 1,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Address retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address retrieved successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            address1: { type: "string", example: "123 Main Street" },
            address2: { type: "string", example: "Apartment 4B" },
            city: { type: "string", example: "Bangalore" },
            state: { type: "string", example: "Karnataka" },
            pincode: { type: "string", example: "560001" },
            latitude: { type: "number", example: 9.93523 },
            longitude: { type: "number", example: 78.130404 },
            type: { type: "string", example: "home" },
            is_default: { type: "boolean", example: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Address not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Address not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async getAddresses(@Param("id") id: number) {
    return this.userService.getAddress(id);
  }

  @Delete("address/:id")
  @ApiOperation({
    summary: "Delete address",
    description:
      "Delete a specific address by its ID. This endpoint is public and can be used to remove addresses.",
  })
  @ApiParam({
    name: "id",
    description: "Address ID to delete",
    example: 1,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Address deleted successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address deleted successfully" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Address not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Address not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async deleteAddress(@Param("id") id: number) {
    return this.userService.deleteAddress(id);
  }
}
