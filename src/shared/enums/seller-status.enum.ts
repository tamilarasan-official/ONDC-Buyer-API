export enum SellerStatus {
  BILLED = "billed",
  PACKED = "packed",
  AGENT_ASSIGNED = "agent-assigned",
  AGENT_ARRIVED_RESTAURANT = "agent-arrived-restaurant",
  PICKED = "picked",
  OUT_FOR_DELIVERY = "out-for-delivery",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

// Parallel status groups that can happen in any order
export const SELLER_STATUS_PARALLEL_GROUP = [
  SellerStatus.PACKED,
  SellerStatus.AGENT_ASSIGNED,
  SellerStatus.AGENT_ARRIVED_RESTAURANT,
];

// Sequential flow after parallel group
export const SELLER_STATUS_FLOW = [
  SellerStatus.BILLED,
  ...SELLER_STATUS_PARALLEL_GROUP,
  SellerStatus.PICKED,
  SellerStatus.OUT_FOR_DELIVERY,
  SellerStatus.DELIVERED,
];

export const SELLER_STATUS_TERMINAL = [
  SellerStatus.DELIVERED,
  SellerStatus.CANCELLED,
];
