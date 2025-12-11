import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum OtpPurpose {
  REGISTRATION = "registration",
  LOGIN = "login",
  PASSWORD_RESET = "password_reset",
}

@Entity("otp_verifications")
@Index(["purpose"])
export class OtpVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 15, nullable: true })
  phone_number: string;

  @Column({ type: "varchar", length: 4 })
  otp: string;

  @Column({
    type: "enum",
    enum: OtpPurpose,
    default: OtpPurpose.REGISTRATION,
  })
  purpose: OtpPurpose;

  @Column({ type: "boolean", default: false })
  is_verified: boolean;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "int", default: 3 })
  max_attempts: number;

  @Column({ type: "timestamp" })
  expires_at: Date;

  @Column({ type: "timestamp", nullable: true })
  verified_at: Date;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}
