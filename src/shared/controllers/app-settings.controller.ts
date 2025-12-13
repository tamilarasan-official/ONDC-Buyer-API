import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AppSettingsService } from "../services/app-settings.service";
import {
  CreateAppSettingDto,
  UpdateAppSettingDto,
  BulkCreateAppSettingsDto,
} from "../dto/app-settings.dto";
import { JwtAuthGuard } from "../../authentication/jwt-auth.guard";

@ApiTags("App Settings")
@Controller("app-settings")
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get all app settings" })
  async getAll() {
    const settings = await this.appSettingsService.getAll();
    return {
      success: true,
      message: "App settings retrieved successfully",
      data: settings,
    };
  }

  @Get("category/:category")
  @ApiOperation({ summary: "Get settings by category" })
  async getByCategory(@Param("category") category: string) {
    const settings = await this.appSettingsService.getByCategory(category);
    return {
      success: true,
      message: "Settings retrieved successfully",
      data: settings,
    };
  }

  @Get(":key")
  @ApiOperation({ summary: "Get a setting by key" })
  async get(@Param("key") key: string) {
    const value = await this.appSettingsService.get(key);
    return {
      success: true,
      message: "Setting retrieved successfully",
      data: { key, value },
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create or update a setting" })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Bulk create/update settings" })
  async bulkCreate(@Body() dto: BulkCreateAppSettingsDto) {
    await this.appSettingsService.bulkSet(dto.settings);
    return {
      success: true,
      message: "Settings created/updated successfully",
    };
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a setting" })
  async update(@Param("id") id: number, @Body() dto: UpdateAppSettingDto) {
    const setting = await this.appSettingsService.update(id, dto.value);
    return {
      success: true,
      message: "Setting updated successfully",
      data: setting,
    };
  }

  @Put(":id/toggle")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle setting active status" })
  async toggleActive(@Param("id") id: number) {
    const setting = await this.appSettingsService.toggleActive(id);
    return {
      success: true,
      message: "Setting status toggled successfully",
      data: setting,
    };
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a setting" })
  async delete(@Param("id") id: number) {
    await this.appSettingsService.delete(id);
    return {
      success: true,
      message: "Setting deleted successfully",
    };
  }
}
