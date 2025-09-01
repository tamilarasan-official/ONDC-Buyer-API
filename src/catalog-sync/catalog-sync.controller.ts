import { Controller, Post, Get, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CatalogSyncService } from './catalog-sync.service';

@Controller('catalog-sync')
export class CatalogSyncController {
  private readonly logger = new Logger(CatalogSyncController.name);

  constructor(
    private readonly catalogSyncService: CatalogSyncService,
  ) {}

  /**
   * Get cron job status and configuration
   */
  @Get('status')
  async getStatus() {
    try {
      const status = this.catalogSyncService.getSyncStatus();
      
      return {
        success: true,
        message: 'Catalog sync status retrieved successfully',
        data: status,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync status: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get sync status',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually trigger full catalog sync
   */
  @Post('trigger-full-sync')
  async triggerFullSync(@Body() body: { cities?: string[] }) {
    try {
      this.logger.log('Manual full sync triggered via API');
      
      const result = await this.catalogSyncService.triggerFullSync(body.cities);
      
      return {
        success: result.success,
        message: result.message,
        data: {
          duration_ms: result.duration,
          duration_seconds: (result.duration / 1000).toFixed(2),
          stats: result.stats,
        },
      };
    } catch (error) {
      this.logger.error(`Manual full sync failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Manual full sync failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually trigger incremental catalog sync
   */
  @Post('trigger-incremental-sync')
  async triggerIncrementalSync(@Body() body: { cities?: string[] }) {
    try {
      this.logger.log('Manual incremental sync triggered via API');
      
      const result = await this.catalogSyncService.triggerIncrementalSync(body.cities);
      
      return {
        success: result.success,
        message: result.message,
        data: {
          duration_ms: result.duration,
          duration_seconds: (result.duration / 1000).toFixed(2),
          stats: result.stats,
        },
      };
    } catch (error) {
      this.logger.error(`Manual incremental sync failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Manual incremental sync failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint for cron system
   */
  @Get('health')
  async healthCheck() {
    try {
      const status = this.catalogSyncService.getSyncStatus();
      
      return {
        success: true,
        message: 'Catalog sync service is healthy',
        data: {
          service_status: 'active',
          cron_enabled: status.isEnabled,
          enabled_jobs: status.enabledJobs,
          production_mode: status.productionMode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Catalog sync service health check failed',
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
