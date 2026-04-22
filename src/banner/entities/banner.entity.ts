import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Banner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  title: string;

  @Column({ type: "text", nullable: true })
  subtitle?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  cta_button?: string;

  @Column({ type: "text", nullable: false })
  image_url: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  background_color?: string;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    enum: ["restaurant_id", "category_id", "collection_id", "url", "organization"],
  })
  promotion_type?: string;

  @Column({ type: "text", nullable: true })
  promotion_link?: string;

  @Column({ type: "boolean", default: false })
  schedule_enabled: boolean;

  @Column({ type: "jsonb", nullable: true })
  sessions?: Array<{
    day_from: number;
    day_to: number;
    start_hhmm: number;
    end_hhmm: number;
    label?: string;
    status?: boolean;
  }>;

  @Column({ type: "integer", default: 0 })
  @Index()
  sequence: number;

  @Column({ type: "boolean", default: true })
  status: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
