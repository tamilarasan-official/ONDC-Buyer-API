import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Store } from "./entities/store.entity";
import {
  StoreStatusUpdateDto,
  StoreStatusUpdateItemDto,
} from "./dto/store-status-update.dto";

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
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

    // Convert status string to boolean
    const newStatus = storeUpdate.status === "open";
    const previousStatus = store.status ? "open" : "closed";

    // Check if status is already the same
    if (store.status === newStatus) {
      this.logger.warn(
        `Store ${store.reference_id} is already ${storeUpdate.status}`,
      );
      return {
        success: true,
        message: `Store is already ${storeUpdate.status}`,
        store_id: store.reference_id,
        store_name: store.name,
        status: storeUpdate.status,
        previous_status: previousStatus,
        new_status: storeUpdate.status,
        seller_message: storeUpdate.message || undefined,
      };
    }

    // Update store status
    store.status = newStatus;
    await this.storeRepository.save(store);

    this.logger.log(
      `✅ Store ${store.reference_id} (${store.name}) status updated: ${previousStatus} → ${storeUpdate.status}`,
    );

    return {
      success: true,
      message: "Store status updated successfully",
      store_id: store.reference_id,
      store_name: store.name,
      status: storeUpdate.status,
      previous_status: previousStatus,
      new_status: storeUpdate.status,
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
}
