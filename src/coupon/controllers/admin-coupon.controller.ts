import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Logger,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { Response } from "express";
import { CouponService } from "../services/coupon.service";
import { CouponExportService } from "../services/coupon-export.service";
import { CreateCampaignDto } from "../dto/create-campaign.dto";
import { UpdateCampaignDto } from "../dto/update-campaign.dto";
import { GenerateCodesDto } from "../dto/generate-codes.dto";
import { ExportCodesDto, ExportFormat } from "../dto/export-codes.dto";
import { IncrementQuotaDto, ResetQuotaDto } from "../dto/manage-quota.dto";
import { CampaignStatus } from "../entities/coupon-campaign.entity";
// import { JwtAuthGuard } from "../../authentication/jwt-auth.guard"; // Uncomment when auth is ready

@ApiTags("Admin - Coupon Management")
@Controller("admin/coupons")
// @UseGuards(JwtAuthGuard) // Uncomment when auth is ready
// @ApiBearerAuth("JWT-auth")
export class AdminCouponController {
  private readonly logger = new Logger(AdminCouponController.name);

  constructor(
    private readonly couponService: CouponService,
    private readonly exportService: CouponExportService,
  ) {}

  @Post("campaigns")
  @ApiOperation({
    summary: "Create a new coupon campaign",
    description:
      "Create a new coupon campaign with a unique key. Campaigns are containers for multiple coupon codes. Each campaign can have multiple coupon codes with the same discount rules.",
  })
  @ApiBody({
    type: CreateCampaignDto,
    examples: {
      example1: {
        summary: "Summer Sale Campaign",
        value: {
          campaign_key: "summer-2025",
          title: "Summer Sale 2025",
          description: "Summer discount campaign for 2025",
          created_by: "admin@example.com",
          status: "draft",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Campaign created successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "number", example: 1 },
        campaign_key: { type: "string", example: "summer-2025" },
        title: { type: "string", example: "Summer Sale 2025" },
        description: { type: "string", example: "Summer discount campaign for 2025" },
        status: { type: "string", example: "draft", enum: ["draft", "active", "inactive"] },
        created_at: { type: "string", example: "2025-01-15T10:00:00Z" },
        updated_at: { type: "string", example: "2025-01-15T10:00:00Z" },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "Campaign key already exists",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 409 },
        message: { type: "string", example: "Campaign with key 'summer-2025' already exists" },
        error: { type: "string", example: "Conflict" },
      },
    },
  })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.couponService.createCampaign(dto);
  }

  @Patch("campaigns/:id")
  @ApiOperation({
    summary: "Update a coupon campaign",
    description:
      "Update campaign title, description, or status. Only provided fields will be updated. Use this to activate/deactivate campaigns or update campaign details.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({
    type: UpdateCampaignDto,
    examples: {
      updateStatus: {
        summary: "Activate Campaign",
        value: {
          status: "active",
        },
      },
      updateDetails: {
        summary: "Update Title and Description",
        value: {
          title: "Updated Summer Sale 2025",
          description: "Updated description for summer campaign",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Campaign updated successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "number", example: 1 },
        campaign_key: { type: "string", example: "summer-2025" },
        title: { type: "string", example: "Updated Summer Sale 2025" },
        description: { type: "string", example: "Updated description" },
        status: { type: "string", example: "active" },
        updated_at: { type: "string", example: "2025-01-15T10:30:00Z" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 404 },
        message: { type: "string", example: "Campaign with ID 1 not found" },
        error: { type: "string", example: "Not Found" },
      },
    },
  })
  async updateCampaign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.couponService.updateCampaign(id, dto);
  }

  @Get("campaigns")
  @ApiOperation({
    summary: "List coupon campaigns",
    description:
      "Get paginated list of campaigns with optional status filter. Returns all campaigns ordered by creation date (newest first). Use status filter to get only active, draft, or inactive campaigns.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: CampaignStatus,
    description: "Filter by campaign status (draft, active, inactive)",
    example: "active",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts from 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: "Campaigns retrieved successfully",
    schema: {
      type: "object",
      properties: {
        campaigns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              campaign_key: { type: "string", example: "summer-2025" },
              title: { type: "string", example: "Summer Sale 2025" },
              description: { type: "string", example: "Summer discount campaign" },
              status: { type: "string", example: "active" },
              created_at: { type: "string", example: "2025-01-15T10:00:00Z" },
            },
          },
        },
        total: { type: "number", example: 50 },
      },
    },
  })
  async getCampaigns(
    @Query("status") status?: CampaignStatus,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.couponService.getCampaigns(
      status,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 20,
    );
  }

  @Get("campaigns/:id")
  @ApiOperation({
    summary: "Get campaign details",
    description:
      "Get detailed information about a specific campaign including all associated coupon codes. Use this to view campaign configuration and all generated codes.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiResponse({
    status: 200,
    description: "Campaign retrieved successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "number", example: 1 },
        campaign_key: { type: "string", example: "summer-2025" },
        title: { type: "string", example: "Summer Sale 2025" },
        description: { type: "string", example: "Summer discount campaign" },
        status: { type: "string", example: "active" },
        coupons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              code: { type: "string", example: "SUMMER-ABC12345" },
              type: { type: "string", example: "percent" },
              status: { type: "string", example: "active" },
            },
          },
        },
        created_at: { type: "string", example: "2025-01-15T10:00:00Z" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 404 },
        message: { type: "string", example: "Campaign with ID 1 not found" },
        error: { type: "string", example: "Not Found" },
      },
    },
  })
  async getCampaign(@Param("id", ParseIntPipe) id: number) {
    return this.couponService.getCampaign(id);
  }

  @Post("campaigns/:id/generate-codes")
  @ApiOperation({
    summary: "Generate coupon codes",
    description:
      "Generate unique coupon codes for a campaign. Supports preview mode to see first 10 codes. Use different examples below for different coupon types (percent, flat, preorder, etc.).",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({
    type: GenerateCodesDto,
    description: "Coupon generation parameters",
    examples: {
      percentDiscount: {
        summary: "Percent Discount Coupon",
        description: "Generate 100 codes with 20% discount, max ₹500",
        value: {
          count: 100,
          prefix: "SUMMER",
          length: 8,
          type: "percent",
          value: 20,
          value_type: "percent",
          max_discount_amount: 500,
          min_cart_value: 500,
          expires_at: "2025-12-31T23:59:59Z",
          start_at: "2025-01-01T00:00:00Z",
          user_usage_limit: 1,
          global_usage_limit: 1000,
          preview: false,
        },
      },
      flatDiscount: {
        summary: "Flat Discount Coupon",
        description: "Generate 50 codes with ₹100 flat discount",
        value: {
          count: 50,
          prefix: "FLAT100",
          length: 8,
          type: "flat",
          value: 100,
          value_type: "rupees",
          min_cart_value: 300,
          expires_at: "2025-12-31T23:59:59Z",
          user_usage_limit: 1,
          global_usage_limit: 500,
          preview: false,
        },
      },
      preorderCoupon: {
        summary: "Preorder Coupon",
        description: "Generate preorder coupon codes with item-specific discount",
        value: {
          count: 200,
          prefix: "PREORDER",
          length: 8,
          type: "preorder",
          value: 15,
          value_type: "percent",
          max_discount_amount: 300,
          min_cart_value: 0,
          expires_at: "2025-12-31T23:59:59Z",
          start_at: "2025-01-01T00:00:00Z",
          user_usage_limit: 1,
          global_usage_limit: 200,
          priority: 5,
          preview: false,
          type_meta: {
            item_id: 123,
            title: "Special Preorder Offer",
            delivery_date: "2025-02-15T12:00:00Z",
            free_delivery: true,
          },
        },
      },
      freeDelivery: {
        summary: "Free Delivery Coupon",
        description: "Generate free delivery coupon codes",
        value: {
          count: 500,
          prefix: "FREEDEL",
          length: 8,
          type: "free_delivery",
          value: 0,
          value_type: "rupees",
          min_cart_value: 200,
          expires_at: "2025-12-31T23:59:59Z",
          user_usage_limit: 1,
          global_usage_limit: 5000,
          preview: false,
          type_meta: {
            delivery_fee_cap: 50,
          },
        },
      },
      nthOrder: {
        summary: "Nth Order Coupon",
        description: "Generate coupon for 3rd order discount",
        value: {
          count: 1000,
          prefix: "3RDORDER",
          length: 8,
          type: "nth_order",
          value: 25,
          value_type: "percent",
          max_discount_amount: 1000,
          min_cart_value: 0,
          expires_at: "2025-12-31T23:59:59Z",
          user_usage_limit: 1,
          global_usage_limit: null,
          preview: false,
          type_meta: {
            nth: 3,
          },
        },
      },
      previewMode: {
        summary: "Preview Mode",
        description: "Preview first 10 codes before generating full batch",
        value: {
          count: 1000,
          prefix: "TEST",
          length: 8,
          type: "percent",
          value: 10,
          value_type: "percent",
          max_discount_amount: 200,
          min_cart_value: 100,
          preview: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Codes generated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Codes generated successfully" },
        data: {
          type: "object",
          properties: {
            codes: {
              type: "array",
              items: { type: "string" },
              example: ["SUMMER-ABC12345", "SUMMER-XYZ67890", "SUMMER-DEF45678"],
            },
            preview: { type: "boolean", example: false },
            count: { type: "number", example: 100 },
            campaign_id: { type: "number", example: 1 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid parameters",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "max_discount_amount is required for percent type" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  async generateCodes(
    @Param("id", ParseIntPipe) campaignId: number,
    @Body() dto: GenerateCodesDto,
  ) {
    return this.couponService.generateCodes(campaignId, dto);
  }

  @Get("campaigns/:id/codes")
  @ApiOperation({
    summary: "List codes in campaign",
    description:
      "Get paginated list of all coupon codes in a campaign. Returns codes ordered by creation date (newest first). Use this to view all generated codes for a campaign.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts from 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 50)",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Codes retrieved successfully",
    schema: {
      type: "object",
      properties: {
        codes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              code: { type: "string", example: "SUMMER-ABC12345" },
              type: { type: "string", example: "percent" },
              value: { type: "number", example: 20 },
              value_type: { type: "string", example: "percent" },
              status: { type: "string", example: "active" },
              global_usage_limit: { type: "number", example: 1000, nullable: true },
              user_usage_limit: { type: "number", example: 1 },
              created_at: { type: "string", example: "2025-01-15T10:00:00Z" },
            },
          },
        },
        total: { type: "number", example: 100 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
  })
  async getCampaignCodes(
    @Param("id", ParseIntPipe) campaignId: number,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.couponService.getCampaignCodes(
      campaignId,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 50,
    );
  }

  @Post("campaigns/:id/export")
  @ApiOperation({
    summary: "Export coupon codes",
    description:
      "Export coupon codes to CSV, PDF, or ZIP format. Includes QR codes if requested. The exported file will be downloaded directly. CSV format is recommended for bulk exports, PDF for printing, and ZIP for QR code distribution.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({
    type: ExportCodesDto,
    examples: {
      csvExport: {
        summary: "Export to CSV",
        value: {
          format: "csv",
          include_qr: false,
          exported_by: "admin@example.com",
        },
      },
      pdfExport: {
        summary: "Export to PDF with QR codes",
        value: {
          format: "pdf",
          include_qr: true,
          exported_by: "admin@example.com",
        },
      },
      zipExport: {
        summary: "Export to ZIP with QR codes",
        value: {
          format: "zip",
          include_qr: true,
          exported_by: "admin@example.com",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Export file generated and downloaded",
    content: {
      "application/csv": {
        schema: { type: "string", format: "binary" },
        example: "SUMMER-ABC12345,SUMMER-XYZ67890,...",
      },
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
      "application/zip": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
  })
  @ApiResponse({
    status: 500,
    description: "Export failed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Failed to export codes" },
        error: { type: "string", example: "Error message" },
      },
    },
  })
  async exportCodes(
    @Param("id", ParseIntPipe) campaignId: number,
    @Body() dto: ExportCodesDto,
    @Res() res: Response,
  ) {
    try {
      let buffer: Buffer;
      let contentType: string;
      let filename: string;

      const campaign = await this.couponService.getCampaign(campaignId);

      switch (dto.format) {
        case ExportFormat.CSV:
          const csv = await this.exportService.exportCSV(
            campaignId,
            dto.include_qr || false,
          );
          buffer = Buffer.from(csv, "utf-8");
          contentType = "text/csv";
          filename = `${campaign.campaign_key}-codes.csv`;
          break;

        case ExportFormat.PDF:
          buffer = await this.exportService.exportPDF(
            campaignId,
            dto.include_qr || false,
          );
          contentType = "application/pdf";
          filename = `${campaign.campaign_key}-codes.pdf`;
          break;

        case ExportFormat.ZIP:
          buffer = await this.exportService.exportZIP(
            campaignId,
            dto.include_qr || false,
          );
          contentType = "application/zip";
          filename = `${campaign.campaign_key}-codes.zip`;
          break;

        default:
          throw new Error(`Unsupported format: ${dto.format}`);
      }

      // Mark as exported
      await this.exportService.markExported(campaignId, dto.exported_by);

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(buffer);
    } catch (error) {
      this.logger.error(`Export error: ${error.message}`, error.stack);
      res.status(500).json({
        success: false,
        message: "Failed to export codes",
        error: error.message,
      });
    }
  }

  @Get("coupons/:id/quota")
  @ApiOperation({
    summary: "Get coupon quota",
    description:
      "Get current available quota (slots) for a coupon. current_quota = remaining slots from Redis (can be stale); global_usage_limit = max from DB; redeemed_count = successful redemptions (DB); effective_remaining = max(0, global_usage_limit - redeemed_count); quota_out_of_sync = true when Redis disagrees with effective_remaining.",
  })
  @ApiParam({ name: "id", type: Number, description: "Coupon ID" })
  @ApiResponse({
    status: 200,
    description: "Quota retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Quota retrieved successfully" },
        data: {
          type: "object",
          properties: {
            coupon_id: { type: "number", example: 123 },
            current_quota: { type: "number", example: 45, nullable: true, description: "Remaining slots in Redis (used by reserve/release; may be out of sync)" },
            global_usage_limit: { type: "number", example: 100, nullable: true, description: "Max limit from DB" },
            redeemed_count: { type: "number", example: 5, description: "Successful redemptions / paid uses (DB)" },
            effective_remaining: { type: "number", example: 0, description: "True remaining slots: max(0, global_usage_limit - redeemed_count)" },
            quota_out_of_sync: { type: "boolean", example: false, description: "True when Redis current_quota does not match effective_remaining" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Coupon not found",
  })
  async getCouponQuota(@Param("id", ParseIntPipe) couponId: number) {
    const quota = await this.couponService.getCouponQuota(couponId);
    return {
      success: true,
      message: "Quota retrieved successfully",
      data: quota,
    };
  }

  @Post("coupons/:id/quota/increment")
  @ApiOperation({
    summary: "Increment coupon quota",
    description:
      "Add more slots to a coupon's quota. Useful when slots reach 0 and you want to make more available. This adds to the existing quota. Example: If current quota is 0 and you increment by 50, new quota becomes 50. If current quota is 10 and you increment by 50, new quota becomes 60.",
  })
  @ApiParam({ name: "id", type: Number, description: "Coupon ID" })
  @ApiBody({
    type: IncrementQuotaDto,
    examples: {
      addSlots: {
        summary: "Add 50 slots",
        value: {
          amount: 50,
        },
      },
      restoreQuota: {
        summary: "Restore quota after cancellation",
        value: {
          amount: 10,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Quota incremented successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Quota incremented by 50 successfully" },
        data: {
          type: "object",
          properties: {
            coupon_id: { type: "number", example: 123 },
            previous_quota: { type: "number", example: 0, nullable: true },
            new_quota: { type: "number", example: 50, nullable: true },
            amount_added: { type: "number", example: 50 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Coupon not found",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 404 },
        message: { type: "string", example: "Coupon with ID 123 not found" },
        error: { type: "string", example: "Not Found" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid amount (must be >= 1)",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 400 },
        message: {
          type: "array",
          items: { type: "string" },
          example: ["amount must not be less than 1"],
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  async incrementCouponQuota(
    @Param("id", ParseIntPipe) couponId: number,
    @Body() dto: IncrementQuotaDto,
  ) {
    const result = await this.couponService.incrementCouponQuota(
      couponId,
      dto.amount,
    );
    return {
      success: true,
      message: `Quota incremented by ${dto.amount} successfully`,
      data: result,
    };
  }

  @Post("coupons/:id/quota/reset")
  @ApiOperation({
    summary: "Reset coupon quota",
    description:
      "Reset coupon quota to a specific value. This overwrites the current quota completely. Use this when you want to set an exact quota value regardless of current quota. Example: If current quota is 5 and you reset to 100, new quota becomes 100. If current quota is 50 and you reset to 100, new quota becomes 100 (not 150).",
  })
  @ApiParam({ name: "id", type: Number, description: "Coupon ID" })
  @ApiBody({
    type: ResetQuotaDto,
    examples: {
      resetToOriginal: {
        summary: "Reset to original limit",
        value: {
          quota: 200,
        },
      },
      setNewLimit: {
        summary: "Set new quota limit",
        value: {
          quota: 500,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Quota reset successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Quota reset to 100 successfully" },
        data: {
          type: "object",
          properties: {
            coupon_id: { type: "number", example: 123 },
            previous_quota: { type: "number", example: 5, nullable: true },
            new_quota: { type: "number", example: 100 },
            global_usage_limit: { type: "number", example: 100, nullable: true, description: "DB limit (unchanged by reset)" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Coupon not found",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 404 },
        message: { type: "string", example: "Coupon with ID 123 not found" },
        error: { type: "string", example: "Not Found" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid quota (must be >= 0)",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 400 },
        message: {
          type: "array",
          items: { type: "string" },
          example: ["quota must not be less than 0"],
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  async resetCouponQuota(
    @Param("id", ParseIntPipe) couponId: number,
    @Body() dto: ResetQuotaDto,
  ) {
    const result = await this.couponService.resetCouponQuota(
      couponId,
      dto.quota,
    );
    return {
      success: true,
      message: `Quota reset to ${dto.quota} successfully`,
      data: result,
    };
  }
}


