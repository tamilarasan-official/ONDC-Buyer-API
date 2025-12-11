import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("user_device_tokens")
export class UserDeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "userId" })
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "varchar", length: 500 })
  token: string;

  @Column({ type: "varchar", length: 20 })
  platform: string; // 'android', 'ios', 'web'

  @Column({ type: "varchar", length: 100, nullable: true })
  device_id: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  app_version: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
