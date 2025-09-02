import { Controller, Get, Query, Post, Body, Logger } from '@nestjs/common';
import { OndcSearchService } from './ondc-search.service';
import { CatalogIngestionService } from '../catalog-ingestion/catalog-ingestion.service';
import { ONDCOnSearchResponseDto } from './dto/ondc-search.dto';

@Controller('ondc-search')
export class OndcSearchController {
  private readonly logger = new Logger(OndcSearchController.name);

  constructor(
    private readonly ondcSearchService: OndcSearchService,
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {}

  /**
   * Test endpoint for ONDC catalog refresh - sends SEARCH request only
   */
  @Post('catalog-refresh')
  async catalogRefresh(@Body() body: { city?: string }) {
    try {
      const result = await this.ondcSearchService.performCatalogRefresh(body.city);
      
      return {
        success: result.success,
        message: result.success 
          ? 'Search request sent to ONDC. Catalog data will be received via /on_search webhook.'
          : 'Search request failed',
        data: {
          message_id: result.message_id,
          ack_status: result.ack_status,
          status: result.success ? 'waiting_for_catalog' : 'search_failed'
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
   * ONDC webhook endpoint to receive catalog data - handles multiple ON_SEARCH calls
   */
  @Post('on_search')
  async receiveOndcCatalog(@Body() catalogData: ONDCOnSearchResponseDto) {
    try {
      this.logger.log(`Received catalog data from ONDC. Message ID: ${catalogData.context?.message_id}`);
      
      // Process the catalog data using existing perfect ingestion service (NO CHANGES TO INGESTION LOGIC)
      const result = await this.catalogIngestionService.ingestCatalogData([catalogData as any]);
      
      this.logger.log(`Catalog data processed successfully. Message ID: ${catalogData.context?.message_id}`);
      
      // Send ACK response back to ONDC
      return {
        message: {
          ack: {
            status: "ACK",
            message_id: catalogData.context?.message_id || "unknown"
          }
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to process catalog data: ${error.message}`, error.stack);
      
      // Send NACK response back to ONDC
      return {
        message: {
          ack: {
            status: "NACK",
            message_id: catalogData.context?.message_id || "unknown",
            error: {
              code: "CATALOG_PROCESSING_FAILED",
              message: error.message
            }
          }
        }
      };
    }
  }

  /**
   * Complete catalog refresh with ingestion endpoint - now just sends SEARCH request
   */
  @Post('catalog-refresh-and-ingest')
  async catalogRefreshAndIngest(@Body() body: { city?: string }) {
    try {
      // Step 1: Send SEARCH request to ONDC (gets acknowledgement only)
      this.logger.log('Starting catalog refresh process');
      const searchResult = await this.ondcSearchService.performCatalogRefresh(body.city);
      
      if (!searchResult.success) {
        throw new Error(`Search request failed: ${searchResult.ack_status}`);
      }
      
      return {
        success: true,
        message: 'Search request sent to ONDC. Multiple catalog data will be received via /on_search webhook.',
        data: {
          search_stats: {
            message_id: searchResult.message_id,
            ack_status: searchResult.ack_status,
            status: 'waiting_for_multiple_catalogs'
          },
          note: 'Each provider will send separate catalog data via /on_search webhook'
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
