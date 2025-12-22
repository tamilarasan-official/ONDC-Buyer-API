import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Delete,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiSecurity
} from "@nestjs/swagger";
import { AppSettingsService } from "../services/app-settings.service";
import {
  CreateAppSettingDto,
  UpdateAppSettingDto,
  BulkCreateAppSettingsDto,
} from "../dto/app-settings.dto";
import { ApiKeyGuard, CurrentRole } from "src/super-admin-access/api-key-auth-gaurd";

@ApiTags("App Settings")
@Controller("app-settings")
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) { }

  @Get()
  @ApiOperation({
    summary: "Get all app settings",
    description: "Retrieve all application settings with their complete details including id, key, value, category, description, active status, and timestamps.",
  })
  @ApiResponse({
    status: 200,
    description: "App settings retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "App settings retrieved successfully",
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "number",
                example: 1,
                description: "Unique identifier for the setting",
              },
              key: {
                type: "string",
                example: "PLATFORM_FEE",
                description: "Unique key identifier for the setting",
              },
              value: {
                type: "string",
                example: "50",
                description: "Setting value (stored as string)",
              },
              category: {
                type: "string",
                example: "app_config",
                description: "Category grouping (e.g., 'app_config', 'payment', 'support')",
                nullable: true,
              },
              description: {
                type: "string",
                example: "Platform fee charged per order",
                description: "Human-readable description of the setting",
                nullable: true,
              },
              is_active: {
                type: "boolean",
                example: true,
                description: "Whether the setting is currently active",
              },
              created_at: {
                type: "string",
                format: "date-time",
                example: "2025-01-15T10:30:00Z",
                description: "Timestamp when the setting was created",
              },
              updated_at: {
                type: "string",
                format: "date-time",
                example: "2025-01-15T10:30:00Z",
                description: "Timestamp when the setting was last updated",
              },
            },
          },
        },
      },
    },
  })
  async getAll() {
    const settings = await this.appSettingsService.getAll();
    return {
      success: true,
      message: "App settings retrieved successfully",
      data: settings,
    };
  }

  @Get("category/:category")
  @ApiOperation({
    summary: "Get settings by category",
    description: "Retrieve all settings grouped by a specific category (e.g., 'payment', 'app_config', 'support'). Returns a key-value object.",
  })
  @ApiParam({
    name: "category",
    description: "Category name to filter settings",
    example: "app_config",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Settings retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Settings retrieved successfully",
        },
        data: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
          example: {
            PLATFORM_FEE: "50",
            INCLUDE_PLATFORM_FEE: "false",
            APP_OPERATION_HOURS: "0900-1700",
          },
          description: "Key-value pairs of settings in the specified category",
        },
      },
    },
  })
  async getByCategory(@Param("category") category: string) {
    const settings = await this.appSettingsService.getByCategory(category);
    return {
      success: true,
      message: "Settings retrieved successfully",
      data: settings,
    };
  }

  @Get(":key")
  @ApiOperation({
    summary: "Get a setting by key",
    description: "Retrieve a specific setting value by its unique key identifier.",
  })
  @ApiParam({
    name: "key",
    description: "Unique key identifier for the setting",
    example: "SUPPORT_EMAIL",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Setting retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Setting retrieved successfully",
        },
        data: {
          type: "object",
          properties: {
            key: {
              type: "string",
              example: "SUPPORT_EMAIL",
              description: "The setting key",
            },
            value: {
              type: "string",
              example: "support@tazty.in",
              description: "The setting value",
              nullable: true,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Setting not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Setting not found" },
      },
    },
  })
  async get(@Param("key") key: string) {
    const value = await this.appSettingsService.get(key);
    return {
      success: true,
      message: "Setting retrieved successfully",
      data: { key, value },
    };
  }

  @Post()
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: "Create or update a setting",
    description: "Create a new setting or update an existing one if the key already exists. Requires authentication.",
  })
  @ApiBody({ type: CreateAppSettingDto })
  @ApiResponse({
    status: 201,
    description: "Setting created/updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Setting created/updated successfully",
        },
        data: {
          type: "object",
          properties: {
            id: {
              type: "number",
              example: 1,
              description: "Unique identifier for the setting",
            },
            key: {
              type: "string",
              example: "PLATFORM_FEE",
              description: "Unique key identifier for the setting",
            },
            value: {
              type: "string",
              example: "50",
              description: "Setting value (stored as string)",
            },
            category: {
              type: "string",
              example: "app_config",
              description: "Category grouping (e.g., 'app_config', 'payment', 'support')",
              nullable: true,
            },
            description: {
              type: "string",
              example: "Platform fee charged per order",
              description: "Human-readable description of the setting",
              nullable: true,
            },
            is_active: {
              type: "boolean",
              example: true,
              description: "Whether the setting is currently active",
            },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
              description: "Timestamp when the setting was created",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
              description: "Timestamp when the setting was last updated",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key.",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async create(@Body() dto: CreateAppSettingDto) {
    const setting = await this.appSettingsService.set(
      dto.key,
      dto.value,
      dto.category,
      dto.description,
    );
    return {
      success: true,
      message: "Setting created/updated successfully",
      data: setting,
    };
  }

  @Post("bulk")
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Bulk create/update settings",
    description: "Create or update multiple settings in a single operation. Requires authentication.",
  })
  @ApiBody({ type: BulkCreateAppSettingsDto })
  @ApiResponse({
    status: 201,
    description: "Settings created/updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Settings created/updated successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key.",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async bulkCreate(@Body() dto: BulkCreateAppSettingsDto) {
    await this.appSettingsService.bulkSet(dto.settings);
    return {
      success: true,
      message: "Settings created/updated successfully",
    };
  }

  @Put(":id")
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: "Update a setting value",
    description: "Update the value of an existing setting by its ID. Requires authentication.",
  })
  @ApiParam({
    name: "id",
    description: "Setting ID to update",
    example: 1,
    type: Number,
  })
  @ApiBody({ type: UpdateAppSettingDto })
  @ApiResponse({
    status: 200,
    description: "Setting updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Setting updated successfully",
        },
        data: {
          type: "object",
          properties: {
            id: {
              type: "number",
              example: 1,
              description: "Unique identifier for the setting",
            },
            key: {
              type: "string",
              example: "PLATFORM_FEE",
              description: "Unique key identifier for the setting",
            },
            value: {
              type: "string",
              example: "75",
              description: "Updated setting value (stored as string)",
            },
            category: {
              type: "string",
              example: "app_config",
              description: "Category grouping (e.g., 'app_config', 'payment', 'support')",
              nullable: true,
            },
            description: {
              type: "string",
              example: "Platform fee charged per order",
              description: "Human-readable description of the setting",
              nullable: true,
            },
            is_active: {
              type: "boolean",
              example: true,
              description: "Whether the setting is currently active",
            },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
              description: "Timestamp when the setting was created",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T12:00:00Z",
              description: "Timestamp when the setting was last updated",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Setting not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Setting with ID 1 not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key.",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async update(@Param("id") id: number, @Body() dto: UpdateAppSettingDto) {
    const setting = await this.appSettingsService.update(id, dto.value);
    return {
      success: true,
      message: "Setting updated successfully",
      data: setting,
    };
  }

  @Put(":id/toggle")
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: "Toggle setting active status",
    description: "Toggle the is_active status of a setting between true and false. Requires authentication.",
  })
  @ApiParam({
    name: "id",
    description: "Setting ID to toggle",
    example: 1,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: "Setting status toggled successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Setting status toggled successfully",
        },
        data: {
          type: "object",
          properties: {
            id: {
              type: "number",
              example: 1,
              description: "Unique identifier for the setting",
            },
            key: {
              type: "string",
              example: "PLATFORM_FEE",
              description: "Unique key identifier for the setting",
            },
            value: {
              type: "string",
              example: "50",
              description: "Setting value (stored as string)",
            },
            category: {
              type: "string",
              example: "app_config",
              description: "Category grouping (e.g., 'app_config', 'payment', 'support')",
              nullable: true,
            },
            description: {
              type: "string",
              example: "Platform fee charged per order",
              description: "Human-readable description of the setting",
              nullable: true,
            },
            is_active: {
              type: "boolean",
              example: false,
              description: "Updated active status (toggled from previous value)",
            },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
              description: "Timestamp when the setting was created",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T12:00:00Z",
              description: "Timestamp when the setting was last updated",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Setting not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Setting with ID 1 not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key.",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })

  async toggleActive(@Param("id") id: number, @CurrentRole() role: string) {
    console.log('role: ', role);
    const setting = await this.appSettingsService.toggleActive(id, role);
    return {
      success: true,
      message: "Setting status toggled successfully",
      data: setting,
    };
  }

  @Delete(":id")
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a setting" })
  async delete(@Param("id") id: number, @CurrentRole() role: string) {
    await this.appSettingsService.delete(id, role);
    return {
      success: true,
      message: "Setting deleted successfully",
    };
  }
}
