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
export class CustomizationRelationships {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.customizationRelationships, {
    onDelete: "CASCADE",
  })
  parent_customization: Item; // Parent customization item (type='customization')

  @ManyToOne(() => Category, (category) => category.customizationRelationships, {
    onDelete: "CASCADE",
  })
  child_customization_group: Category; // Child customization group (type='custom_group')

  @Column({ type: "boolean", default: false })
  is_default: boolean; // Whether this is the default selection

  @CreateDateColumn()
  created_at: Date;
}
