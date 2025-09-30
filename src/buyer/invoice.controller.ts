import { Controller, Get, Post, Param, Body, Res, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../authentication/jwt-auth.guard';
import { InvoiceService } from './invoice.service';
import { GenerateInvoiceDto, InvoiceResponseDto, InvoiceFormat } from './dto/invoice.dto';

@ApiTags('Invoice')
@Controller('api/buyer/invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('generate/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Generate invoice for an order',
    description: 'Generate invoice in PDF or JSON format for a specific order'
  })
  @ApiParam({ 
    name: 'orderId', 
    description: 'Order ID', 
    type: 'number',
    example: 1
  })
  @ApiBody({ 
    type: GenerateInvoiceDto,
    description: 'Invoice generation options'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Invoice generated successfully',
    type: InvoiceResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Order not found' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async generateInvoice(
    @Req() req: any,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() generateInvoiceDto: GenerateInvoiceDto,
    @Res() res: Response
  ) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const result = await this.invoiceService.generateInvoice(userId, orderId, generateInvoiceDto);

      if (generateInvoiceDto.format === 'pdf') {
        const pdfBuffer = result as Buffer;
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${orderId}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        });
        res.send(pdfBuffer);
      } else {
        res.json({
          success: true,
          data: result
        });
      }
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to generate invoice'
      });
    }
  }

  @Get('data/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get invoice data for an order',
    description: 'Get structured invoice data in JSON format. Works directly for delivered orders - no separate generation step needed.'
  })
  @ApiParam({ 
    name: 'orderId', 
    description: 'Order ID', 
    type: 'number',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Invoice data retrieved successfully',
    type: InvoiceResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Order not found' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async getInvoiceData(
    @Req() req: any,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response
  ) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const invoiceData = await this.invoiceService.getInvoiceData(userId, orderId);
      
      res.json({
        success: true,
        data: invoiceData
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to get invoice data'
      });
    }
  }

  @Get('download/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Download PDF invoice for an order',
    description: 'Download PDF invoice for a specific order. Works directly for delivered orders - no separate generation step needed.'
  })
  @ApiParam({ 
    name: 'orderId', 
    description: 'Order ID', 
    type: 'number',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'PDF invoice downloaded successfully',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Order not found' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async downloadInvoice(
    @Req() req: any,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response
  ) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const pdfBuffer = await this.invoiceService.generateInvoice(
        userId, 
        orderId, 
        { format: InvoiceFormat.PDF }
      ) as Buffer;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${orderId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      
      res.send(pdfBuffer);
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to download invoice'
      });
    }
  }
}
