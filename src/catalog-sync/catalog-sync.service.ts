import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OndcSearchService } from '../ondc-search/ondc-search.service';
import { CatalogIngestionService } from '../catalog-ingestion/catalog-ingestion.service';

/**
 * Service responsible for automated catalog synchronization via cron jobs
 */
@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);
  private readonly isProductionMode: boolean;
  private readonly enabledCronJobs: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly ondcSearchService: OndcSearchService,
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {
    this.isProductionMode = this.configService.get<string>('NODE_ENV') === 'production';
    this.enabledCronJobs = this.configService.get<string>('ENABLED_CRON_JOBS', 'full_sync,incremental_sync')
      .split(',')
      .map(job => job.trim());
    
    this.logger.log(`CatalogSyncService initialized`);
    this.logger.log(`Production mode: ${this.isProductionMode}`);
    this.logger.log(`Enabled cron jobs: ${this.enabledCronJobs.join(', ')}`);
  }

  /**
   * Full catalog refresh - Daily at 2:00 AM
   * Comprehensive sync of all store data
   */
  @Cron('0 2 * * *', {
    name: 'full_catalog_sync',
    timeZone: 'Asia/Kolkata',
  })
  async handleFullCatalogSync(): Promise<void> {
    if (!this.shouldRunCronJob('full_sync')) {
      return;
    }

    const startTime = Date.now();
    this.logger.log('🚀 Starting FULL catalog sync (scheduled)');

    try {
      const cities = this.getTargetCities();
      let totalStats = this.initializeStats();

      for (const city of cities) {
        this.logger.log(`📍 Processing city: ${city}`);
        
        try {
          // Send search request for the city (returns acknowledgement only)
          const searchResult = await this.ondcSearchService.performCatalogRefresh(city);
          
          if (searchResult.success) {
            this.logger.log(`🔍 Search request sent successfully for ${city}. Message ID: ${searchResult.message_id}`);
            this.logger.log(`📞 Waiting for multiple ON_SEARCH webhook calls for ${city}`);
            totalStats.cities_processed++;
          } else {
            this.logger.warn(`⚠️ Search request failed for city: ${city}. Status: ${searchResult.ack_status}`);
            totalStats.city_errors.push(`${city}: Search failed - ${searchResult.ack_status}`);
          }
          
          // Aggregate search statistics
          this.aggregateStats(totalStats, searchResult);

        } catch (cityError) {
          this.logger.error(`❌ Failed to process city ${city}: ${cityError.message}`, cityError.stack);
          totalStats.city_errors.push(`${city}: ${cityError.message}`);
        }

        // Add delay between cities to avoid overwhelming the API
        await this.delay(2000);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`🎉 FULL catalog sync completed in ${duration}ms`);
      this.logSyncSummary('FULL', totalStats, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`💥 FULL catalog sync failed after ${duration}ms: ${error.message}`, error.stack);
      
      // Log critical failure metrics
      this.logFailureMetrics('FULL', error, duration);
    }
  }

  /**
   * Incremental catalog refresh - Every 4 hours during business hours
   * Quick sync for active stores and recent changes
   */
  @Cron('0 */4 * * *', {
    name: 'incremental_catalog_sync',
    timeZone: 'Asia/Kolkata',
  })
  async handleIncrementalCatalogSync(): Promise<void> {
    if (!this.shouldRunCronJob('incremental_sync')) {
      return;
    }

    // Only run during business hours (8 AM to 10 PM IST)
    const currentHour = new Date().getHours();
    if (currentHour < 8 || currentHour > 22) {
      this.logger.log(`⏰ Skipping incremental sync - outside business hours (${currentHour}:00)`);
      return;
    }

    const startTime = Date.now();
    this.logger.log('🔄 Starting INCREMENTAL catalog sync (scheduled)');

    try {
      // Focus on primary cities for incremental sync
      const primaryCities = this.getPrimaryCities();
      let totalStats = this.initializeStats();

      for (const city of primaryCities) {
        this.logger.log(`📍 Incremental sync for city: ${city}`);
        
        try {
          // Send search request for the city (returns acknowledgement only)
          const searchResult = await this.ondcSearchService.performCatalogRefresh(city);
          
          if (searchResult.success) {
            this.logger.log(`🔍 Incremental search request sent for ${city}. Message ID: ${searchResult.message_id}`);
            this.logger.log(`📞 Waiting for ON_SEARCH webhook calls for ${city}`);
            totalStats.cities_processed++;
          } else {
            this.logger.warn(`⚠️ Incremental search failed for ${city}. Status: ${searchResult.ack_status}`);
            totalStats.city_errors.push(`${city}: Search failed - ${searchResult.ack_status}`);
          }
          
          // Aggregate search statistics
          this.aggregateStats(totalStats, searchResult);

        } catch (cityError) {
          this.logger.error(`❌ Incremental sync failed for ${city}: ${cityError.message}`);
          totalStats.city_errors.push(`${city}: ${cityError.message}`);
        }

        // Shorter delay for incremental sync
        await this.delay(1000);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`🎉 INCREMENTAL catalog sync completed in ${duration}ms`);
      this.logSyncSummary('INCREMENTAL', totalStats, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`💥 INCREMENTAL catalog sync failed after ${duration}ms: ${error.message}`, error.stack);
      this.logFailureMetrics('INCREMENTAL', error, duration);
    }
  }

  /**
   * Health check sync - Every 30 minutes
   * Quick health check to ensure system is responsive
   */
  @Cron('*/30 * * * *', {
    name: 'health_check_sync',
    timeZone: 'Asia/Kolkata',
  })
  async handleHealthCheckSync(): Promise<void> {
    if (!this.shouldRunCronJob('health_check')) {
      return;
    }

    const startTime = Date.now();
    this.logger.log('🩺 Starting HEALTH CHECK sync');

    try {
      // Test with Bangalore only for health check
      const searchResult = await this.ondcSearchService.performCatalogRefresh('std:080');
      
      const duration = Date.now() - startTime;
      
      if (searchResult.success) {
        this.logger.log(`✅ HEALTH CHECK passed - Search request sent successfully in ${duration}ms. Message ID: ${searchResult.message_id}`);
      } else {
        this.logger.warn(`⚠️ HEALTH CHECK warning - Search request failed in ${duration}ms. Status: ${searchResult.ack_status}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ HEALTH CHECK failed after ${duration}ms: ${error.message}`);
    }
  }

  /**
   * Manual trigger for full catalog sync
   */
  async triggerFullSync(cities?: string[]): Promise<{
    success: boolean;
    message: string;
    stats: any;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log('🚀 Starting MANUAL full catalog sync');

    try {
      const targetCities = cities || this.getTargetCities();
      let totalStats = this.initializeStats();

      for (const city of targetCities) {
        // Send search request for the city (returns acknowledgement only)
        const searchResult = await this.ondcSearchService.performCatalogRefresh(city);
        
        if (searchResult.success) {
          this.logger.log(`🔍 Manual search request sent for ${city}. Message ID: ${searchResult.message_id}`);
          totalStats.cities_processed++;
        } else {
          this.logger.warn(`⚠️ Manual search failed for ${city}. Status: ${searchResult.ack_status}`);
          totalStats.city_errors.push(`${city}: Search failed - ${searchResult.ack_status}`);
        }
        
        // Aggregate search statistics
        this.aggregateStats(totalStats, searchResult);

        await this.delay(1000);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`🎉 MANUAL full catalog sync completed in ${duration}ms`);

      return {
        success: true,
        message: 'Manual search requests sent successfully. Catalog data will be received via ON_SEARCH webhooks.',
        stats: totalStats,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`💥 MANUAL full catalog sync failed: ${error.message}`, error.stack);

      return {
        success: false,
        message: `Manual full sync failed: ${error.message}`,
        stats: null,
        duration
      };
    }
  }

  /**
   * Manual trigger for incremental catalog sync
   */
  async triggerIncrementalSync(cities?: string[]): Promise<{
    success: boolean;
    message: string;
    stats: any;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log('🔄 Starting MANUAL incremental catalog sync');

    try {
      const targetCities = cities || this.getPrimaryCities();
      let totalStats = this.initializeStats();

      for (const city of targetCities) {
        // Send search request for the city (returns acknowledgement only)
        const searchResult = await this.ondcSearchService.performCatalogRefresh(city);
        
        if (searchResult.success) {
          this.logger.log(`🔍 Manual incremental search sent for ${city}. Message ID: ${searchResult.message_id}`);
          totalStats.cities_processed++;
        } else {
          this.logger.warn(`⚠️ Manual incremental search failed for ${city}. Status: ${searchResult.ack_status}`);
          totalStats.city_errors.push(`${city}: Search failed - ${searchResult.ack_status}`);
        }
        
        // Aggregate search statistics
        this.aggregateStats(totalStats, searchResult);

        await this.delay(500);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`🎉 MANUAL incremental catalog sync completed in ${duration}ms`);

      return {
        success: true,
        message: 'Manual incremental search requests sent successfully. Catalog data will be received via ON_SEARCH webhooks.',
        stats: totalStats,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`💥 MANUAL incremental catalog sync failed: ${error.message}`, error.stack);

      return {
        success: false,
        message: `Manual incremental sync failed: ${error.message}`,
        stats: null,
        duration
      };
    }
  }

  /**
   * Get sync status and next scheduled runs
   */
  getSyncStatus(): {
    isEnabled: boolean;
    enabledJobs: string[];
    nextRuns: {
      full_sync: string;
      incremental_sync: string;
      health_check: string;
    };
    productionMode: boolean;
  } {
    return {
      isEnabled: this.enabledCronJobs.length > 0,
      enabledJobs: this.enabledCronJobs,
      nextRuns: {
        full_sync: 'Daily at 2:00 AM IST',
        incremental_sync: 'Every 4 hours (8 AM - 10 PM IST)',
        health_check: 'Every 30 minutes'
      },
      productionMode: this.isProductionMode
    };
  }

  /**
   * Private helper methods
   */
  private shouldRunCronJob(jobType: string): boolean {
    if (!this.enabledCronJobs.includes(jobType)) {
      this.logger.log(`⏭️ Skipping ${jobType} - job disabled`);
      return false;
    }
    return true;
  }

  private getTargetCities(): string[] {
    const defaultCities = ['std:0452'];
    return this.configService.get<string>('SYNC_TARGET_CITIES', defaultCities.join(','))
      .split(',')
      .map(city => city.trim());
  }

  private getPrimaryCities(): string[] {
    const primaryCities = ['std:0452'];
    return this.configService.get<string>('SYNC_PRIMARY_CITIES', primaryCities.join(','))
      .split(',')
      .map(city => city.trim());
  }

  private initializeStats() {
    return {
      cities_processed: 0,
      search_requests_sent: 0,
      search_requests_failed: 0,
      city_errors: [] as string[],
      total_errors: 0,
      note: 'Catalog data statistics will be available via ON_SEARCH webhook processing'
    };
  }

  private aggregateStats(totalStats: any, searchResult: any): void {
    if (searchResult.success) {
      totalStats.search_requests_sent++;
    } else {
      totalStats.search_requests_failed++;
    }
    totalStats.total_errors = totalStats.city_errors.length;
  }

  private logSyncSummary(type: string, stats: any, duration: number): void {
    this.logger.log(`
📊 ${type} CATALOG SYNC SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Duration: ${(duration / 1000).toFixed(2)}s
🏙️  Cities Processed: ${stats.cities_processed}
📤 Search Requests Sent: ${stats.search_requests_sent}
❌ Search Requests Failed: ${stats.search_requests_failed}

📞 Note: Catalog data will be received via ON_SEARCH webhooks
   Each successful search request will trigger multiple webhook calls

❌ Errors: ${stats.total_errors}
${stats.city_errors.length > 0 ? `🚨 City Errors: ${stats.city_errors.join(', ')}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  private logFailureMetrics(type: string, error: any, duration: number): void {
    this.logger.error(`
💥 ${type} CATALOG SYNC FAILURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Duration: ${(duration / 1000).toFixed(2)}s
❌ Error: ${error.message}
🔍 Stack: ${error.stack?.split('\n')[1] || 'No stack trace'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
