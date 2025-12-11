import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
export class UserAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "text", nullable: false })
  address1: string;

  @Column({ type: "text", nullable: true })
  address2?: string;

  @Column({ type: "text", nullable: true })
  address3?: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  city: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  state: string;

  @Column({ type: "integer", nullable: false })
  pincode: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  longitude: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  type: string;

  @Column({ type: "bigint", nullable: true })
  alternate_phone_number?: number;

  @Column({ type: "boolean", default: false })
  is_default: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
