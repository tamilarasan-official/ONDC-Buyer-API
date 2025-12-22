import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from "typeorm";

@Entity()
@Index(["event_id", "event_type"], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  event_id: string; // Razorpay webhook event ID

  @Column({ type: "varchar", length: 100 })
  event_type: string; // payment.captured, payment.failed, order.paid

  @Column({ type: "varchar", length: 100, nullable: true })
  payment_id: string | null; // Razorpay payment ID (if applicable)

  @Column({ type: "varchar", length: 100, nullable: true })
  order_id: string | null; // Razorpay order ID (if applicable)

  @Column({ type: "int", nullable: true })
  internal_order_id: number | null; // Internal order ID from our database

  @Column({ type: "varchar", length: 50, default: "pending" })
  processing_status: string; // pending, processed, failed

  @Column({ type: "text", nullable: true })
  error_message: string | null; // Error message if processing failed

  @Column({ type: "json", nullable: true })
  event_payload: any; // Store full event payload for debugging

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

