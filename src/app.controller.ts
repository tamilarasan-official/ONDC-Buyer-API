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
      
      // Check if this is a valid catalog response
      if (!catalogData.message) {
        
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

      // �� DETAILED ITEM LOGGING: Log all items and their relationships
      this.logDetailedItemInfo(catalogData);


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

  /**
   * Log detailed information about items and their relationships
   */
  private logDetailedItemInfo(catalogData: any) {
    try {
      const providers = catalogData.message.catalog['bpp/providers'] || [];
      
      providers.forEach((provider: any, providerIndex: number) => {
        this.logger.log(`🏪 Provider ${providerIndex + 1}: ${provider.descriptor?.name || 'Unknown'}`);
        this.logger.log(`   ID: ${provider.id}`);
        this.logger.log(`   Items Count: ${provider.items?.length || 0}`);
        this.logger.log(`   Categories Count: ${provider.categories?.length || 0}`);
        
        // Log categories
        if (provider.categories && provider.categories.length > 0) {
          this.logger.log(`   📂 Categories:`);
          provider.categories.forEach((category: any, catIndex: number) => {
            this.logger.log(`      ${catIndex + 1}. ${category.descriptor?.name || 'Unknown'} (ID: ${category.id})`);
            this.logger.log(`         Type: ${category.tags?.find((tag: any) => tag.code === 'type')?.list?.[0]?.value || 'regular'}`);
          });
        }
        
        // Log items with detailed information
        if (provider.items && provider.items.length > 0) {
          this.logger.log(`   🍕 Items:`);
          provider.items.forEach((item: any, itemIndex: number) => {
            this.logger.log(`      ${itemIndex + 1}. ${item.descriptor?.name || 'Unknown'} (ID: ${item.id})`);
            this.logger.log(`         Type: ${item.tags?.find((tag: any) => tag.code === 'type')?.list?.[0]?.value || 'item'}`);
            this.logger.log(`         Parent Item ID: ${item.parent_item_id || 'None'}`);
            this.logger.log(`         Price: ${item.price?.value || 'N/A'} ${item.price?.currency || ''}`);
            
            // Log tags for this item
            if (item.tags && item.tags.length > 0) {
              this.logger.log(`         Tags:`);
              item.tags.forEach((tag: any) => {
                this.logger.log(`            ${tag.code}: ${JSON.stringify(tag.list)}`);
              });
            }
            
            // Log customization-specific information
            if (item.parent_item_id) {
              this.logger.log(`         🔗 This is a customization/variant item linked to parent: ${item.parent_item_id}`);
            }
          });
          
          // 🔍 CUSTOMIZATION ANALYSIS: Find items with parent_item_id relationships
          const customizationItems = provider.items.filter((item: any) => item.parent_item_id);
          const mainItems = provider.items.filter((item: any) => !item.parent_item_id);
          
          this.logger.log(`   🔍 Customization Analysis:`);
          this.logger.log(`      Main Items: ${mainItems.length}`);
          this.logger.log(`      Customization/Variant Items: ${customizationItems.length}`);
          
          if (customizationItems.length > 0) {
            this.logger.log(`      Customization Items Details:`);
            customizationItems.forEach((item: any) => {
              this.logger.log(`         ${item.descriptor?.name} -> Parent: ${item.parent_item_id}`);
            });
          }
        }
      });
    } catch (error) {
      this.logger.error(`❌ Error logging detailed item info: ${error.message}`);
    }
  }
}
