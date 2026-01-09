import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Store } from "../../store/entities/store.entity";
import { CartItem } from "./cart-item.entity";

@Entity()
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  store: Store;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  delivery_fee: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  delivery_percent: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  delivery_fee_tax: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  platform_percent: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  platform_fee_tax: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  tip_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  final_amount: number;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Column({ type: "varchar", length: 64, nullable: true })
  coupon_code?: string;

  @Column({ type: "uuid", nullable: true })
  coupon_reservation_token?: string;

  @Column({ type: "bigint", nullable: true })
  coupon_id?: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart)
  cart_items: CartItem[];
}
