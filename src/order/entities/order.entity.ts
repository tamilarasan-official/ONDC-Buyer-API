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
import { UserAddress } from "../../user/entities/user-address.entity";
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

  @ManyToOne(() => UserAddress, { onDelete: "CASCADE" })
  delivery_address: UserAddress;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: string; // pending, confirmed, preparing, out_for_delivery, delivered, cancelled

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  delivery_fee: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  tax_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  discount_amount: number;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  order_items: OrderItem[];

  @OneToMany(() => OrderTracking, (tracking) => tracking.order)
  tracking: OrderTracking[];
}
