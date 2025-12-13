import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("app_settings")
export class AppSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, unique: true })
  key: string;

  @Column({ type: "text" })
  value: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  category: string; // e.g., 'payment', 'app_config', 'support', etc.

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
