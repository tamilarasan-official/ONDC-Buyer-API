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
export class CategoryConfigs {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Category, (category) => category.configs, {
    onDelete: "CASCADE",
  })
  category: Category;

  @Column({ type: "int", nullable: false })
  min_selections: number; // Minimum selections required

  @Column({ type: "int", nullable: false })
  max_selections: number; // Maximum selections allowed

  @Column({ type: "varchar", length: 50, nullable: false })
  input_type: string; // "select", "radio", "checkbox"

  @Column({ type: "int", nullable: false })
  sequence: number; // Display sequence

  @Column({ type: "boolean", default: false })
  is_mandatory: boolean; // Whether this customization group is mandatory

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
