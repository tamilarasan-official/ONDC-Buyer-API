import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserOtp } from "./user-otp.entity";
import { UserAddress } from "./user-address.entity";
import { UserDeviceToken } from "./user-device-token.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  email?: string;

  @Column({ type: "bigint", nullable: false })
  phone_number: number;

  @Column({ type: "boolean", default: true })
  status?: boolean;

  @OneToOne(() => UserOtp, (userOtp) => userOtp.user, {
    cascade: true,
    nullable: true,
  })
  @JoinColumn({ name: "otp_id" })
  otp: UserOtp | null;

  @OneToMany(() => UserAddress, (userAddress) => userAddress.user, {
    cascade: true,
    nullable: true,
  })
  addresses: UserAddress[];

  @OneToMany(() => UserDeviceToken, (deviceToken) => deviceToken.user, {
    cascade: true,
    nullable: true,
  })
  device_tokens: UserDeviceToken[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
