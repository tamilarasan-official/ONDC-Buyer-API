import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { CouponCampaign } from "./coupon-campaign.entity";
import { CouponRedemption } from "./coupon-redemption.entity";
import { CouponCounter } from "./coupon-counter.entity";

export enum CouponType {
  FLAT = "flat",
  PERCENT = "percent",
  FREE_DELIVERY = "free_delivery",
  FIRST_ORDER = "first_order",
  NTH_ORDER = "nth_order",
  REFERRAL = "referral",
}

export enum CouponStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
  REVOKED = "revoked",
}

export enum ValueType {
  RUPEES = "rupees",
  PERCENT = "percent",
}

@Entity("coupons")
export class Coupon {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  @Index()
  campaign_id: number;

  @ManyToOne(() => CouponCampaign, (campaign) => campaign.coupons)
  @JoinColumn({ name: "campaign_id" })
  campaign: CouponCampaign;

  @Column({ type: "varchar", length: 64, unique: true })
  @Index()
  code: string;

  @Column({
    type: "enum",
    enum: CouponType,
  })
  @Index()
  type: CouponType;

  @Column({ type: "jsonb", default: {} })
  type_meta: Record<string, any>;

  @Column({ type: "numeric", nullable: true })
  value?: number;

  @Column({ type: "varchar", length: 10 })
  value_type: ValueType;

  @Column({ type: "numeric", nullable: true })
  max_discount_amount?: number;

  @Column({ type: "numeric", default: 0 })
  min_cart_value: number;

  @Column({ type: "text", array: true, nullable: true })
  valid_pincodes?: string[];

  @Column({ type: "geometry", nullable: true, spatialFeatureType: "Point" })
  @Index({ spatial: true })
  valid_radius_center?: string; // PostGIS Point as WKT

  @Column({ type: "numeric", nullable: true })
  valid_radius_km?: number;

  @Column({ type: "bigint", array: true, nullable: true })
  applicable_store_ids?: number[];

  @Column({ type: "int", default: 1 })
  user_usage_limit: number;

  @Column({ type: "bigint", nullable: true })
  global_usage_limit?: number;

  @Column({ type: "bigint", nullable: true })
  per_store_limit?: number;

  @Column({ type: "boolean", default: false })
  stackable: boolean;

  @Column({ type: "int", nullable: true })
  priority?: number;

  @Column({ type: "boolean", default: false })
  exported: boolean;

  @Column({ type: "varchar", length: 64, nullable: true })
  exported_by?: string;

  @Column({ type: "timestamptz", nullable: true })
  exported_at?: Date;

  @Column({
    type: "varchar",
    length: 16,
    default: CouponStatus.ACTIVE,
  })
  @Index()
  status: CouponStatus;

  @Column({ type: "timestamptz", nullable: true })
  @Index()
  start_at?: Date;

  @Column({ type: "timestamptz", nullable: true })
  @Index()
  end_at?: Date;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @OneToMany(() => CouponRedemption, (redemption) => redemption.coupon)
  redemptions: CouponRedemption[];

  @OneToMany(() => CouponCounter, (counter) => counter.coupon)
  counter: CouponCounter;
}

