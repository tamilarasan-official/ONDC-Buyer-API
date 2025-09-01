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
export class ItemPrices {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.prices, {
    onDelete: "CASCADE",
  })
  item: Item;

  @Column({ type: "varchar", length: 3, nullable: false, default: "INR" })
  currency: string; // Currency code

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  base_price: number; // Base price of the item

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  maximum_price: number; // Maximum price (with all premium options)

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  minimum_price_range: number; // Minimum possible price with customizations

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  maximum_price_range: number; // Maximum possible price with customizations

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  default_selection_price: number; // Price with default customizations

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  default_selection_max_price: number; // Max price with default customizations

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
