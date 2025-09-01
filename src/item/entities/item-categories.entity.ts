import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Item } from "./item.entity";
import { Category } from "../../category/entities/category.entity";

@Entity()
export class ItemCategories {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.item_categories, {
    onDelete: "CASCADE",
  })
  item: Item;

  @ManyToOne(() => Category, (category) => category.item_categories, {
    onDelete: "CASCADE",
  })
  category: Category;

  @Column({ type: "boolean", default: false })
  is_default: boolean;

  @CreateDateColumn()
  created_at: Date;
}
