import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("guest_sessions")
@Index(["session_token_id", "expires_at"])
@Index(["id", "session_token_id"])
export class GuestSession {
  // guest_id
  @Column({ type: "uuid" })
  id: string;

  // jti claim from JWT
  @PrimaryColumn({ type: "uuid" })
  session_token_id: string;

  @Column({ type: "varchar", length: 20, default: "ios" })
  platform: string;

  // Hash only; never store raw device_id.
  @Column({ type: "varchar", length: 128, nullable: true })
  device_id_hash?: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  app_version?: string | null;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Column({ type: "timestamp with time zone" })
  expires_at: Date;

  @Column({ type: "timestamp with time zone", nullable: true })
  last_seen_at?: Date | null;

  @CreateDateColumn({ type: "timestamp with time zone" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updated_at: Date;
}

