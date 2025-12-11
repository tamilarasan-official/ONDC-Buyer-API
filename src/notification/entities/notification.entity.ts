import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "varchar", length: 50 })
  type: string; // order, promotion, system

  @Column({ type: "varchar", length: 50 })
  status: string; // unread, read

  @Column({ type: "json", nullable: true })
  data: any; // Additional data (order_id, etc.)

  @Column({ type: "boolean", default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
