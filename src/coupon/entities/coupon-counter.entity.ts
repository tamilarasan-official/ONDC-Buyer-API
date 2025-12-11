import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Coupon } from "./coupon.entity";

@Entity("coupon_counters")
export class CouponCounter {
  @PrimaryColumn({ type: "bigint" })
  coupon_id: number;

  @ManyToOne(() => Coupon, (coupon) => coupon.counter)
  @JoinColumn({ name: "coupon_id" })
  coupon: Coupon;

  @Column({ type: "bigint", default: 0 })
  redeemed_count: number;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}


