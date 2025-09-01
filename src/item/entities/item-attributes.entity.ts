import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Item } from "./item.entity";

@Entity()
export class ItemAttributes {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.attributes, {
    onDelete: "CASCADE",
  })
  item: Item;

  @Column({ type: "varchar", length: 100, nullable: false })
  attribute_code: string; // "brand", "color", "material", "veg_nonveg", "organic_certified", etc.

  @Column({ type: "varchar", length: 255, nullable: false })
  attribute_name: string; // "Brand", "Color", "Material", "Veg Non-Veg", etc.

  @Column({ type: "text", nullable: false })
  attribute_value: string; // "Nike", "Red", "Cotton", "yes", "certified", etc.

  @Column({ type: "varchar", length: 50, nullable: false })
  attribute_group: string; // "product_info", "dietary", "regulatory", "customization"

  @Column({ type: "int", nullable: true })
  display_order: number; // For ordering attributes in display

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
