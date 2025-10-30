export enum SellerStatus {
  BILLED = "billed",
  PACKED = "packed",
  AGENT_ASSIGNED = "agent-assigned",
  PICKED = "picked",
  OUT_OF_DELIVERY = "out-of-delivery",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

export const SELLER_STATUS_FLOW = [
  SellerStatus.BILLED,
  SellerStatus.PACKED,
  SellerStatus.AGENT_ASSIGNED,
  SellerStatus.PICKED,
  SellerStatus.OUT_OF_DELIVERY,
  SellerStatus.DELIVERED,
];

export const SELLER_STATUS_TERMINAL = [
  SellerStatus.DELIVERED,
  SellerStatus.CANCELLED,
];
