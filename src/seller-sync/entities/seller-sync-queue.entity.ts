import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type SellerSyncQueueStatus = "pending" | "queued" | "sent" | "failed";

@Entity("seller_sync_queue")
export class SellerSyncQueue {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ type: "varchar", length: 255 })
  reference_id: string;

  @Column({ type: "varchar", length: 50 })
  type: string;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: SellerSyncQueueStatus;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "text", nullable: true })
  last_error: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  bullmq_job_id: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sent_at: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
