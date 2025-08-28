import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubCategory } from "./sub-category.entity";

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: false })
  icon: string;

  @Column({ type: "int", nullable: false })
  reference_id: number;

  @OneToMany(() => SubCategory, (SubCategory) => SubCategory.category, {
    eager: true,
    onDelete: "CASCADE",
  })
  sub_categories: SubCategory[];
}
