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
    description: "Create a new coupon campaign with a unique key",
  })
  @ApiBody({ type: CreateCampaignDto })
  @ApiResponse({
    status: 201,
    description: "Campaign created successfully",
  })
  @ApiResponse({
    status: 409,
    description: "Campaign key already exists",
  })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.couponService.createCampaign(dto);
  }

  @Patch("campaigns/:id")
  @ApiOperation({
    summary: "Update a coupon campaign",
    description: "Update campaign title, description, or status",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({ type: UpdateCampaignDto })
  @ApiResponse({
    status: 200,
    description: "Campaign updated successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
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
    description: "Get paginated list of campaigns with optional status filter",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: CampaignStatus,
    description: "Filter by campaign status",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: "Campaigns retrieved successfully",
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
    description: "Get campaign details with associated coupons",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiResponse({
    status: 200,
    description: "Campaign retrieved successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Campaign not found",
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
    description: "Get paginated list of coupon codes in a campaign",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Codes retrieved successfully",
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
      "Export coupon codes to CSV, PDF, or ZIP format. Includes QR codes if requested.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({ type: ExportCodesDto })
  @ApiResponse({
    status: 200,
    description: "Export file generated",
    content: {
      "application/csv": { schema: { type: "string", format: "binary" } },
      "application/pdf": { schema: { type: "string", format: "binary" } },
      "application/zip": { schema: { type: "string", format: "binary" } },
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
}


