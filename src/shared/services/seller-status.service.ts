import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import {
  SellerStatus,
  SELLER_STATUS_FLOW,
  SELLER_STATUS_TERMINAL,
  SELLER_STATUS_PARALLEL_GROUP,
} from "../enums/seller-status.enum";

@Injectable()
export class SellerStatusService {
  private readonly logger = new Logger(SellerStatusService.name);

  /**
   * Validate if a status transition is valid
   */
  validateStatusTransition(currentStatus: string, newStatus: string): boolean {
    // If order is already in terminal state, no further transitions allowed
    if (SELLER_STATUS_TERMINAL.includes(currentStatus as SellerStatus)) {
      this.logger.warn(
        `Cannot transition from terminal status ${currentStatus} to ${newStatus}`,
      );
      return false;
    }

    // If new status is cancelled, it's always allowed (except from terminal states)
    if (newStatus === SellerStatus.CANCELLED) {
      return true;
    }

    // Check if both statuses are in the parallel group
    // These can transition to each other in any order
    const isCurrentParallel = SELLER_STATUS_PARALLEL_GROUP.includes(
      currentStatus as SellerStatus,
    );
    const isNewParallel = SELLER_STATUS_PARALLEL_GROUP.includes(
      newStatus as SellerStatus,
    );

    if (isCurrentParallel && isNewParallel) {
      this.logger.log(
        `✅ Allowing parallel status transition: ${currentStatus} → ${newStatus}`,
      );
      return true;
    }

    // Check if new status follows the proper flow
    const currentIndex = SELLER_STATUS_FLOW.indexOf(
      currentStatus as SellerStatus,
    );
    const newIndex = SELLER_STATUS_FLOW.indexOf(newStatus as SellerStatus);

    // If current status is not in flow (e.g., 'pending'), allow any valid status
    if (currentIndex === -1) {
      return (
        SELLER_STATUS_FLOW.includes(newStatus as SellerStatus) ||
        newStatus === SellerStatus.CANCELLED
      );
    }

    // Allow forward transitions (normal flow)
    if (newIndex > currentIndex) {
      return true;
    }

    // Allow backward transitions for skipped statuses
    // This handles cases where seller reports statuses out of order
    const isReasonableBackwardTransition = 
      newIndex >= 0 && 
      newIndex < currentIndex && 
      (currentIndex - newIndex) <= 3; // Allow up to 3 steps backward (increased for parallel group)
    
    if (isReasonableBackwardTransition) {
      this.logger.warn(
        `⚠️ Allowing backward status transition: ${currentStatus} → ${newStatus} (seller reported out of order)`,
      );
      return true;
    }

    return false;
  }

  /**
   * Get the next valid statuses for a given current status
   */
  getNextValidStatuses(currentStatus: string): string[] {
    if (SELLER_STATUS_TERMINAL.includes(currentStatus as SellerStatus)) {
      return []; // No further transitions from terminal states
    }

    const currentIndex = SELLER_STATUS_FLOW.indexOf(
      currentStatus as SellerStatus,
    );

    if (currentIndex === -1) {
      // If current status is not in flow, return all valid statuses
      return [...SELLER_STATUS_FLOW, SellerStatus.CANCELLED];
    }

    // If current status is in parallel group, include all parallel statuses
    const isCurrentParallel = SELLER_STATUS_PARALLEL_GROUP.includes(
      currentStatus as SellerStatus,
    );
    
    const parallelStatuses: string[] = [];
    if (isCurrentParallel) {
      // Include other parallel statuses (excluding current)
      parallelStatuses.push(
        ...SELLER_STATUS_PARALLEL_GROUP.filter((s) => s !== currentStatus),
      );
    }

    // Get forward statuses (normal flow)
    const forwardStatuses = SELLER_STATUS_FLOW.slice(currentIndex + 1);
    
    // Get reasonable backward statuses (for out-of-order reporting)
    const backwardStatuses: string[] = [];
    for (let i = Math.max(0, currentIndex - 3); i < currentIndex; i++) {
      const status = SELLER_STATUS_FLOW[i];
      // Avoid duplicates with parallel statuses
      if (!parallelStatuses.includes(status)) {
        backwardStatuses.push(status);
      }
    }
    
    // Combine: backward + parallel + forward + cancelled
    // Remove duplicates and current status
    const allStatuses = [
      ...backwardStatuses,
      ...parallelStatuses,
      ...forwardStatuses,
      SellerStatus.CANCELLED,
    ].filter((s, i, arr) => arr.indexOf(s) === i && s !== currentStatus);
    
    return allStatuses;
  }

  /**
   * Check if status is terminal (final state)
   */
  isTerminalStatus(status: string): boolean {
    return SELLER_STATUS_TERMINAL.includes(status as SellerStatus);
  }

  /**
   * Get human-readable status message
   */
  getStatusMessage(status: string): string {
    const statusMessages = {
      [SellerStatus.BILLED]: "Order confirmed and billed by seller",
      [SellerStatus.PACKED]: "Order packed and ready for pickup",
      [SellerStatus.AGENT_ASSIGNED]: "Delivery agent assigned",
      [SellerStatus.AGENT_ARRIVED_RESTAURANT]: "Delivery agent arrived at restaurant",
      [SellerStatus.PICKED]: "Order picked up by delivery agent",
      [SellerStatus.OUT_FOR_DELIVERY]: "Order out for delivery",
      [SellerStatus.DELIVERED]: "Order delivered successfully",
      [SellerStatus.CANCELLED]: "Order cancelled",
    };

    return statusMessages[status as SellerStatus] || `Order status: ${status}`;
  }

  /**
   * Validate seller status update
   */
  validateSellerStatusUpdate(
    orderNumber: string,
    currentStatus: string,
    newStatus: string,
  ): void {
    if (!Object.values(SellerStatus).includes(newStatus as SellerStatus)) {
      throw new BadRequestException(
        `Invalid seller status: ${newStatus}. Valid statuses are: ${Object.values(SellerStatus).join(", ")}`,
      );
    }

    if (!this.validateStatusTransition(currentStatus, newStatus)) {
      const validStatuses = this.getNextValidStatuses(currentStatus);
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
          `Valid next statuses are: ${validStatuses.join(", ")}`,
      );
    }

    this.logger.log(
      `✅ Valid status transition for order ${orderNumber}: ${currentStatus} → ${newStatus}`,
    );
  }
}
