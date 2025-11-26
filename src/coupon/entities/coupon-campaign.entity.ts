import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Coupon } from "./coupon.entity";

export enum CampaignStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
  EXPIRED = "expired",
  REVOKED = "revoked",
}

@Entity("coupon_campaigns")
export class CouponCampaign {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ type: "varchar", length: 80, unique: true })
  @Index()
  campaign_key: string;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  created_by?: string;

  @Column({
    type: "varchar",
    length: 16,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @OneToMany(() => Coupon, (coupon) => coupon.campaign)
  coupons: Coupon[];
}

