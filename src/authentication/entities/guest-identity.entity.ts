import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("guest_identities")
@Index(["identity_token_hash"])
export class GuestIdentity {
  // Stable analytics identity across days.
  @PrimaryColumn({ type: "uuid" })
  identity_id: string;

  // Opaque token stored as SHA-256 hash (client stores the raw token).
  @Column({ type: "varchar", length: 64, unique: true })
  identity_token_hash: string;

  @Column({ type: "varchar", length: 20, default: "ios" })
  platform: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  device_id_hash?: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  app_version?: string | null;

  @Column({ type: "timestamp with time zone", nullable: true })
  last_seen_at?: Date | null;

  // Marks whether this guest identity was converted to a registered user.
  @Column({ type: "boolean", default: false })
  converted_to_user: boolean;

  // When converted, links the guest analytics identity to the final user.
  // Used only for analytics attribution.
  @Column({ type: "integer", nullable: true })
  linked_user_id?: number | null;

  @Column({ type: "timestamp with time zone", nullable: true })
  converted_at?: Date | null;

  @CreateDateColumn({ type: "timestamp with time zone" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updated_at: Date;
}

