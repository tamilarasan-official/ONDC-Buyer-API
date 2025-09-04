import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./order.entity";

@Entity()
export class OrderTracking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order: Order;

  @Column({ type: "varchar", length: 50 })
  status: string; // pending, confirmed, preparing, out_for_delivery, delivered, cancelled

  @Column({ type: "text", nullable: true })
  message: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date;

  @CreateDateColumn()
  created_at: Date;
}
