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
import { OrderItem } from "./order-item.entity";
import { OrderTracking } from "./order-tracking.entity";

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  order_number: string; // ORD-20250102-001

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  store: Store;

  // Delivery Address Fields (denormalized for data integrity)
  @Column({ type: "text", nullable: false })
  delivery_address_line1: string;

  @Column({ type: "text", nullable: true })
  delivery_address_line2: string;

  @Column({ type: "text", nullable: true })
  delivery_address_line3: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  delivery_city: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  delivery_state: string;

  @Column({ type: "integer", nullable: false })
  delivery_pincode: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  delivery_latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  delivery_longitude: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  delivery_address_type: string;

  @Column({ type: "bigint", nullable: true })
  delivery_alternate_phone: number;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: string; // pending, confirmed, preparing, out_for_delivery, delivered, cancelled

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  delivery_fee: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  delivery_fee_tax: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  platform_fee_tax: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  tax_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  discount_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  tip_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: "varchar", length: 20, default: "cod" })
  payment_method: string; // cod, online, wallet

  @Column({ type: "varchar", length: 20, default: "pending" })
  payment_status: string; // pending, paid, failed, refunded

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "timestamp", nullable: true })
  estimated_delivery_time: Date;

  @Column({ type: "timestamp", nullable: true })
  delivered_at: Date;

  @Column({ type: "decimal", precision: 3, scale: 2, nullable: true })
  overall_rating: number; // 1.00 - 5.00 rating

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  order_items: OrderItem[];

  @OneToMany(() => OrderTracking, (tracking) => tracking.order)
  tracking: OrderTracking[];
}
