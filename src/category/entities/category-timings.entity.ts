import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "./category.entity";

@Entity()
export class CategoryTimings {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Category, (category) => category.timings, {
    onDelete: "CASCADE",
  })
  category: Category;

  @Column({ type: "int", nullable: false })
  day_from: number; // 1-7 (Database format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)

  @Column({ type: "int", nullable: false })
  day_to: number; // 1-7 (Database format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)

  @Column({ type: "varchar", length: 4, nullable: false })
  time_from: string; // "HHMM" format like "1800"

  @Column({ type: "varchar", length: 4, nullable: false })
  time_to: string; // "HHMM" format like "2200"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
