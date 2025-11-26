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
      "Generate unique coupon codes for a campaign. Supports preview mode to see first 10 codes.",
  })
  @ApiParam({ name: "id", type: Number, description: "Campaign ID" })
  @ApiBody({ type: GenerateCodesDto })
  @ApiResponse({
    status: 201,
    description: "Codes generated successfully",
    schema: {
      example: {
        codes: ["SUMMER-ABC12345", "SUMMER-XYZ67890"],
        preview: false,
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


