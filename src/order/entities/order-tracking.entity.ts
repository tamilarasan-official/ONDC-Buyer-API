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

  // Agent details fields
  @Column({ type: "varchar", length: 255, nullable: true })
  agent_name: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  agent_phone: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  agent_vehicle_number: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  agent_eta: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  agent_photo_url: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date;

  @CreateDateColumn()
  created_at: Date;
}
