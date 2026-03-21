export type CouponMetricsJobType =
  | "paid-order-event"
  | "coupon-redeem-retry";

export interface PaidOrderEventJobPayload {
  orderId: number;
  userId: number;
  correlationId: string;
}

export interface CouponRedeemRetryJobPayload {
  orderId: number;
  userId: number;
  reservationToken: string;
  correlationId: string;
}

export type CouponMetricsJobPayload =
  | PaidOrderEventJobPayload
  | CouponRedeemRetryJobPayload;

export interface CouponMetricsJobData {
  type: CouponMetricsJobType;
  payload: CouponMetricsJobPayload;
}
