import { Controller, Get, Query, Post, Body, Logger } from '@nestjs/common';
import { OndcSearchService } from './ondc-search.service';
import { CatalogIngestionService } from '../catalog-ingestion/catalog-ingestion.service';

@Controller('ondc-search')
export class OndcSearchController {
  private readonly logger = new Logger(OndcSearchController.name);

  constructor(
    private readonly ondcSearchService: OndcSearchService,
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {}

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
   * Complete catalog refresh with ingestion endpoint
   */
  @Post('catalog-refresh-and-ingest')
  async catalogRefreshAndIngest(@Body() body: { city?: string }) {
    try {
      // Step 1: Perform ONDC search
      this.logger.log('Starting catalog refresh and ingestion process');
      const searchResult = await this.ondcSearchService.performCatalogRefresh(body.city);
      
      // Step 2: Ingest the results into database
      const ingestionResult = await this.catalogIngestionService.ingestCatalogData(searchResult);
      
      return {
        success: true,
        message: 'Catalog refresh and ingestion completed successfully',
        data: {
          search_stats: {
            providers_count: searchResult.length,
          },
          ingestion_stats: ingestionResult.stats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Catalog refresh and ingestion failed',
        error: error.message,
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
