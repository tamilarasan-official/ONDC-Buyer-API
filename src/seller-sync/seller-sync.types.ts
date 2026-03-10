export type SellerSyncJobType = "order.push" | "order.cancel" | "review.push";

export interface SellerSyncJobData {
  type: SellerSyncJobType;
  /**
   * Relative endpoint under SELLER_API_URL, e.g. "/orders" or "/reviews"
   */
  endpoint: string;
  /**
   * JSON payload to send to seller API
   */
  payload: any;
}

