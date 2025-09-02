import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { CatalogIngestionService } from './catalog-ingestion/catalog-ingestion.service';
import { ONDCOnSearchResponseDto } from './ondc-search/dto/ondc-search.dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * ONDC webhook endpoint for receiving catalog data at root level (/on_search)
   */
  @Post('on_search')
  async ondcWebhook(@Body() catalogData: any) {
    try {
      this.logger.log(`🔔 ONDC Webhook received. Message ID: ${catalogData.context?.message_id}`);
      
      // Check if this is a valid catalog response
      if (!catalogData.message) {
        this.logger.log(`📭 ONDC sent response without 'message' field - likely ACK/NACK or error response`);
        this.logger.log(`📋 Response type: ${JSON.stringify(Object.keys(catalogData))}`);
        
        // Send ACK back (ONDC expects acknowledgment even for these)
        return {
          message: {
            ack: {
              status: "ACK",
              message_id: catalogData.context?.message_id || "unknown"
            }
          }
        };
      }

      if (!catalogData.message.catalog) {
        this.logger.log(`📭 ONDC sent message without 'catalog' field`);
        this.logger.log(`📋 Message fields: ${JSON.stringify(Object.keys(catalogData.message))}`);
        
        // Send ACK back
        return {
          message: {
            ack: {
              status: "ACK",
              message_id: catalogData.context?.message_id || "unknown"
            }
          }
        };
      }

      const providersCount = catalogData.message.catalog['bpp/providers']?.length || 0;
      this.logger.log(`📊 Valid catalog response with ${providersCount} provider(s)`);
      
      if (providersCount === 0) {
        this.logger.log(`📭 No providers found in catalog response`);
        
        // Send ACK back (even for empty catalogs)
        return {
          message: {
            ack: {
              status: "ACK",
              message_id: catalogData.context?.message_id || "unknown"
            }
          }
        };
      }

      // Process the catalog data using the ingestion service
      this.logger.log(`🔄 Processing catalog with ${providersCount} provider(s)`);
      const result = await this.catalogIngestionService.ingestCatalogData([catalogData]);
      
      this.logger.log(`✅ Catalog processing completed successfully`);
      this.logger.log(`📊 Ingestion stats: ${JSON.stringify(result.stats)}`);
      
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
      this.logger.error(`❌ ONDC webhook failed: ${error.message}`, error.stack);
      this.logger.error(`📋 Problematic payload: ${JSON.stringify(catalogData)}`);
      
      // Send NACK response back to ONDC
      return {
        message: {
          ack: {
            status: "NACK",
            message_id: catalogData?.context?.message_id || "unknown",
            error: {
              code: "CATALOG_PROCESSING_FAILED",
              message: error.message
            }
          }
        }
      };
    }
  }
}
