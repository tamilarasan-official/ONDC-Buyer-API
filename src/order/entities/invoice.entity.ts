import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Order } from "./order.entity";

@Entity("invoices")
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: Order;

  @Column({ type: "integer", name: "order_id", unique: true })
  order_id: number;

  @Column({ type: "varchar", length: 30, unique: true, name: "invoice_no" })
  invoice_no: string;

  @Column({ type: "text", nullable: true, name: "invoice_url" })
  invoice_url: string | null;

  @CreateDateColumn({ name: "created_at" })
  created_at: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updated_at: Date;
}
