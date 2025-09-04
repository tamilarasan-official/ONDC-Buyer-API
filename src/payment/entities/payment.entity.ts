import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Order } from "../../order/entities/order.entity";
import { User } from "../../user/entities/user.entity";

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order: Order;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "varchar", length: 100, unique: true })
  payment_id: string; // Payment gateway transaction ID

  @Column({ type: "varchar", length: 20 })
  payment_method: string; // cod, online, wallet, upi

  @Column({ type: "varchar", length: 20 })
  payment_status: string; // pending, success, failed, refunded

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  gateway: string; // razorpay, payu, etc.

  @Column({ type: "json", nullable: true })
  gateway_response: any; // Store gateway response

  @Column({ type: "timestamp", nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
