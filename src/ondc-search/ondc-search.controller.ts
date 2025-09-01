import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { OndcSearchService } from './ondc-search.service';

@Controller('ondc-search')
export class OndcSearchController {
  constructor(private readonly ondcSearchService: OndcSearchService) {}

  /**
   * Test endpoint for ONDC catalog refresh
   */
  @Post('catalog-refresh')
  async catalogRefresh(@Body() body: { city?: string }) {
    try {
      const result = await this.ondcSearchService.performCatalogRefresh(body.city);
      
      return {
        success: true,
        message: 'Catalog refresh completed',
        data: {
          providers_count: result.length,
          responses: result,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Catalog refresh failed',
        error: error.message,
      };
    }
  }

  /**
   * Test endpoint for specific ONDC search
   */
  @Post('search')
  async search(@Body() searchParams: {
    city?: string;
    search_term?: string;
    category_id?: string;
    gps?: string;
    area_code?: string;
  }) {
    try {
      const result = await this.ondcSearchService.searchSpecific(searchParams);
      
      return {
        success: true,
        message: 'Search completed',
        data: {
          providers_count: result.length,
          search_params: searchParams,
          responses: result,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Search failed',
        error: error.message,
        search_params: searchParams,
      };
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  healthCheck() {
    return {
      success: true,
      message: 'ONDC Search Service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
