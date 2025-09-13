import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Item } from "./item.entity";
import { Category } from "../../category/entities/category.entity";

@Entity()
export class ItemCustomizationGroups {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.customizationGroups, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => Category, (category) => category.itemCustomizationGroups, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: 'customizationGroupId' })
  customization_group: Category; // Category with type='custom_group'

  @Column({ type: "int", nullable: true })
  min_selections: number; // Override from group config

  @Column({ type: "int", nullable: true })
  max_selections: number; // Override from group config

  @Column({ type: "int", nullable: true })
  sequence: number; // Override from group config

  @Column({ type: "boolean", default: false })
  is_mandatory: boolean; // Whether this customization group is mandatory

  @CreateDateColumn()
  created_at: Date;
}