import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Coupon } from "./coupon.entity";
import { CouponCampaign } from "./coupon-campaign.entity";

export enum RedemptionStatus {
  RESERVED = "reserved",
  REDEEMED = "redeemed",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back",
}

@Entity("coupon_redemptions")
export class CouponRedemption {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  @Index()
  coupon_id: number;

  @ManyToOne(() => Coupon, (coupon) => coupon.redemptions)
  @JoinColumn({ name: "coupon_id" })
  coupon: Coupon;

  @Column({ type: "bigint" })
  campaign_id: number;

  @ManyToOne(() => CouponCampaign)
  @JoinColumn({ name: "campaign_id" })
  campaign: CouponCampaign;

  @Column({ type: "bigint", nullable: true })
  @Index()
  user_id?: number;

  @Column({ type: "bigint", nullable: true })
  @Index()
  order_id?: number;

  @Column({ type: "numeric", nullable: true })
  amount_applied?: number;

  @Column({ type: "boolean", default: false })
  delivery_waived: boolean;

  @Column({
    type: "varchar",
    length: 20,
  })
  @Index()
  status: RedemptionStatus;

  @Column({ type: "uuid", nullable: true })
  @Index()
  reserved_token?: string;

  @Column({ type: "varchar", length: 128, unique: true, nullable: true })
  @Index()
  idempotency_key?: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}

