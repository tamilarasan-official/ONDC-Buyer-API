import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { Store } from "./entities/store.entity";
import { StoreCloseTimings } from "./entities/store-close-timings.entity";
import { StoreLocation } from "./entities/store-location.entity";
import {
  StoreStatusUpdateDto,
  StoreStatusUpdateItemDto,
} from "./dto/store-status-update.dto";
import {
  StoreCloseTimingDto,
  StoreCloseTimingItemDto,
} from "./dto/store-close-timing.dto";

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(StoreCloseTimings)
    private readonly storeCloseTimingsRepository: Repository<StoreCloseTimings>,
    @InjectRepository(StoreLocation)
    private readonly storeLocationRepository: Repository<StoreLocation>,
  ) {}

  /**
   * Update single store status
   */
  private async updateSingleStoreStatus(
    storeUpdate: StoreStatusUpdateItemDto,
  ) {
    // Find store by reference_id (ONDC provider ID) or by ID
    // First try to find by reference_id (string like "P1")
    let store = await this.storeRepository.findOne({
      where: { reference_id: storeUpdate.store_id },
    });

    // If not found by reference_id, try to find by numeric ID
    if (!store) {
      const storeId = parseInt(storeUpdate.store_id, 10);
      if (!isNaN(storeId)) {
        store = await this.storeRepository.findOne({
          where: { id: storeId },
        });
      }
    }

    if (!store) {
      throw new NotFoundException(
        `Store with ID or reference_id '${storeUpdate.store_id}' not found`,
      );
    }

    // Status is already boolean (true/false)
    const newStatus = storeUpdate.status;
    const previousStatus = store.status;

    // Check if status is already the same
    if (store.status === newStatus) {
      this.logger.warn(
        `Store ${store.reference_id} is already ${newStatus ? "enabled" : "disabled"}`,
      );
      return {
        success: true,
        message: `Store is already ${newStatus ? "enabled" : "disabled"}`,
        store_id: store.reference_id,
        store_name: store.name,
        status: newStatus,
        previous_status: previousStatus,
        new_status: newStatus,
        seller_message: storeUpdate.message || undefined,
      };
    }

    // Update store status
    store.status = newStatus;
    await this.storeRepository.save(store);

    this.logger.log(
      `✅ Store ${store.reference_id} (${store.name}) status updated: ${previousStatus} → ${newStatus}`,
    );

    return {
      success: true,
      message: "Store status updated successfully",
      store_id: store.reference_id,
      store_name: store.name,
      status: newStatus,
      previous_status: previousStatus,
      new_status: newStatus,
      seller_message: storeUpdate.message || undefined,
    };
  }

  /**
   * Update store status from seller webhook (supports multiple stores)
   */
  async updateStoreStatusFromSeller(
    storeStatusUpdateDto: StoreStatusUpdateDto,
  ) {
    try {
      this.logger.log(
        `🔄 Received store status update for ${storeStatusUpdateDto.stores.length} store(s)`,
      );

      const results: any[] = [];
      const errors: any[] = [];

      // Process each store update
      for (const storeUpdate of storeStatusUpdateDto.stores) {
        try {
          const result = await this.updateSingleStoreStatus(storeUpdate);
          results.push(result);
        } catch (error) {
          this.logger.error(
            `❌ Error updating store ${storeUpdate.store_id}: ${error.message}`,
          );
          errors.push({
            store_id: storeUpdate.store_id,
            error: error.message,
            status: error instanceof NotFoundException ? 404 : 400,
          });
        }
      }

      // Return response with results and errors
      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `All ${results.length} store(s) updated successfully`
            : `${results.length} store(s) updated, ${errors.length} failed`,
        updated: results,
        failed: errors.length > 0 ? errors : undefined,
        total: storeStatusUpdateDto.stores.length,
        successful: results.length,
        failed_count: errors.length,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error processing store status updates: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update store status: ${error.message}`,
      );
    }
  }

  /**
   * Update single store close timing
   */
  private async updateSingleStoreCloseTiming(
    timingUpdate: StoreCloseTimingItemDto,
  ) {
    // Find store by reference_id (ONDC provider ID) or by ID
    let store = await this.storeRepository.findOne({
      where: { reference_id: timingUpdate.store_id },
    });

    if (!store) {
      const storeId = parseInt(timingUpdate.store_id, 10);
      if (!isNaN(storeId)) {
        store = await this.storeRepository.findOne({
          where: { id: storeId },
        });
      }
    }

    if (!store) {
      throw new NotFoundException(
        `Store with ID or reference_id '${timingUpdate.store_id}' not found`,
      );
    }

    const now = new Date();

    if (timingUpdate.status === "closed") {
      // Validate required fields for closed status
      if (!timingUpdate.close_end_datetime) {
        throw new BadRequestException(
          "close_end_datetime is required when status is 'closed'",
        );
      }

      const closeStartDatetime = timingUpdate.close_start_datetime
        ? new Date(timingUpdate.close_start_datetime)
        : now;
      const closeEndDatetime = new Date(timingUpdate.close_end_datetime);

      // Validate datetime order
      if (closeEndDatetime <= closeStartDatetime) {
        throw new BadRequestException(
          "close_end_datetime must be after close_start_datetime",
        );
      }

      // Find location if provided
      let location: StoreLocation | null = null;
      if (timingUpdate.location_id) {
        location = await this.storeLocationRepository.findOne({
          where: { id: timingUpdate.location_id, store: { id: store.id } },
        });

        if (!location) {
          throw new NotFoundException(
            `Location with ID ${timingUpdate.location_id} not found for store ${store.reference_id}`,
          );
        }
      }

      // Check for existing active close timing (prevent duplicates)
      const whereCondition: any = {
        store: { id: store.id },
        close_end_datetime: MoreThanOrEqual(now),
      };
      if (location) {
        whereCondition.location = { id: location.id };
      } else {
        whereCondition.location = null;
      }

      let activeCloseTiming = await this.storeCloseTimingsRepository.findOne({
        where: whereCondition,
        relations: ["store", "location"],
      });

      if (activeCloseTiming) {
        // Update existing active close timing
        activeCloseTiming.close_start_datetime = closeStartDatetime;
        activeCloseTiming.close_end_datetime = closeEndDatetime;
        activeCloseTiming.reason = timingUpdate.message || activeCloseTiming.reason;

        if (location) {
          activeCloseTiming.location = location;
        }

        await this.storeCloseTimingsRepository.save(activeCloseTiming);

        this.logger.log(
          `✅ Updated existing close timing for store ${store.reference_id} (${store.name})`,
        );

        return {
          success: true,
          message: "Store close timing updated successfully",
          store_id: store.reference_id,
          store_name: store.name,
          status: timingUpdate.status,
          close_timing: {
            id: activeCloseTiming.id,
            close_start_datetime: activeCloseTiming.close_start_datetime.toISOString(),
            close_end_datetime: activeCloseTiming.close_end_datetime.toISOString(),
            reason: activeCloseTiming.reason,
            location_id: activeCloseTiming.location?.id || null,
          },
        };
      } else {
        // Create new close timing entry
        const closeTiming = new StoreCloseTimings();
        closeTiming.store = store;
        if (location) {
          closeTiming.location = location;
        }
        closeTiming.close_start_datetime = closeStartDatetime;
        closeTiming.close_end_datetime = closeEndDatetime;
        if (timingUpdate.message) {
          closeTiming.reason = timingUpdate.message;
        }

        const savedCloseTiming =
          await this.storeCloseTimingsRepository.save(closeTiming);

        this.logger.log(
          `✅ Created new close timing for store ${store.reference_id} (${store.name})`,
        );

        return {
          success: true,
          message: "Store close timing created successfully",
          store_id: store.reference_id,
          store_name: store.name,
          status: timingUpdate.status,
          close_timing: {
            id: savedCloseTiming.id,
            close_start_datetime: savedCloseTiming.close_start_datetime.toISOString(),
            close_end_datetime: savedCloseTiming.close_end_datetime.toISOString(),
            reason: savedCloseTiming.reason,
            location_id: savedCloseTiming.location?.id || null,
          },
        };
      }
    } else {
      // status === "open" - End active close timings
      const whereCondition: any = {
        store: { id: store.id },
        close_end_datetime: MoreThanOrEqual(now),
      };

      if (timingUpdate.location_id) {
        const location = await this.storeLocationRepository.findOne({
          where: { id: timingUpdate.location_id, store: { id: store.id } },
        });

        if (!location) {
          throw new NotFoundException(
            `Location with ID ${timingUpdate.location_id} not found for store ${store.reference_id}`,
          );
        }

        whereCondition.location = { id: location.id };
      }

      const activeCloseTimings =
        await this.storeCloseTimingsRepository.find({
          where: whereCondition,
          relations: ["store", "location"],
        });

      if (activeCloseTimings.length === 0) {
        // Store is already open (no active close timings)
        this.logger.log(
          `ℹ️ Store ${store.reference_id} is already open (no active close timings)`,
        );
        return {
          success: true,
          message: "Store is already open (no active close timings)",
          store_id: store.reference_id,
          store_name: store.name,
          status: timingUpdate.status,
          close_timing: null,
        };
      }

      // Update all active close timings to end now
      const updatedCloseTimings = activeCloseTimings.map((timing) => {
        timing.close_end_datetime = now;
        return timing;
      });

      await this.storeCloseTimingsRepository.save(updatedCloseTimings);

      this.logger.log(
        `✅ Ended ${activeCloseTimings.length} active close timing(s) for store ${store.reference_id} (${store.name})`,
      );

      return {
        success: true,
        message: "Store reopened successfully",
        store_id: store.reference_id,
        store_name: store.name,
        status: timingUpdate.status,
        close_timing: {
          ended_count: activeCloseTimings.length,
          ended_at: now.toISOString(),
        },
      };
    }
  }

  /**
   * Update store timing status from seller webhook (supports multiple stores)
   */
  async updateStoreTimingStatusFromSeller(
    storeCloseTimingDto: StoreCloseTimingDto,
  ) {
    try {
      this.logger.log(
        `🔄 Received store timing status update for ${storeCloseTimingDto.stores.length} store(s)`,
      );

      const results: any[] = [];
      const errors: any[] = [];

      // Process each store update
      for (const timingUpdate of storeCloseTimingDto.stores) {
        try {
          const result = await this.updateSingleStoreCloseTiming(timingUpdate);
          results.push(result);
        } catch (error) {
          this.logger.error(
            `❌ Error updating store timing status ${timingUpdate.store_id}: ${error.message}`,
          );
          errors.push({
            store_id: timingUpdate.store_id,
            error: error.message,
            status: error instanceof NotFoundException ? 404 : 400,
          });
        }
      }

      // Return response with results and errors
      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `All ${results.length} store timing status(es) updated successfully`
            : `${results.length} store(s) updated, ${errors.length} failed`,
        updated: results,
        failed: errors.length > 0 ? errors : undefined,
        total: storeCloseTimingDto.stores.length,
        successful: results.length,
        failed_count: errors.length,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error processing store timing status updates: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update store timing status: ${error.message}`,
      );
    }
  }
}
