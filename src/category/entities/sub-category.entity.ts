import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Category } from "./category.entity";

@Entity()
export class SubCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Category, (category) => category.sub_categories, {
    onDelete: "CASCADE",
  })
  category: Category;

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: false })
  icon: string;

  @Column({ type: "boolean", default: true })
  status: boolean;

  @Column({ type: "int", nullable: false })
  reference_id: number;

  @ManyToOne(() => SubCategory, (subCategory) => subCategory.childrens, {
    onDelete: "CASCADE",
  })
  parent: SubCategory;

  @OneToMany(() => SubCategory, (subCategory) => subCategory.parent, {
    onDelete: "CASCADE",
  })
  childrens: SubCategory[];
}
