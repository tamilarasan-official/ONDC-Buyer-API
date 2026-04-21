import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  ParseIntPipe,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../authentication/jwt-auth.guard";
import { InvoiceService } from "./invoice.service";
import { InvoiceUrlResponseDto } from "./dto/invoice.dto";

@ApiTags("Buyer App APIs")
@Controller("api/buyer/invoice")
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(":orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get invoice for an order",
    description:
      "Returns invoice_no, order_number and invoice_url. " +
      "If the PDF has already been generated it is returned immediately from storage. " +
      "If not (e.g. delivery webhook failed to store the URL), the PDF is generated on demand, " +
      "uploaded to S3, persisted in the invoices table, and the URL is returned.",
  })
  @ApiParam({ name: "orderId", description: "Order ID", type: "number", example: 1 })
  @ApiResponse({ status: 200, description: "Invoice details returned", type: InvoiceUrlResponseDto })
  @ApiResponse({ status: 404, description: "Order not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getInvoice(
    @Req() req: any,
    @Param("orderId", ParseIntPipe) orderId: number,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const data = await this.invoiceService.getOrGenerateInvoiceUrl(userId, orderId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to get invoice",
      });
    }
  }
}
