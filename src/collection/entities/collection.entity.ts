import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("collections")
export class Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 120 })
  title: string;

  @Column({ type: "jsonb", nullable: true })
  filters?: Record<string, any>;

  @Column({ type: "boolean", default: true })
  status: boolean;

  @Column({ type: "int", default: 1 })
  sequence: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

