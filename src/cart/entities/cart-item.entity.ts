import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Cart } from "./cart.entity";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Cart, { onDelete: "CASCADE" })
  cart: Cart;

  @ManyToOne(() => Item, { onDelete: "CASCADE" })
  item: Item;

  @Column({ type: "int", default: 1 })
  quantity: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total_price: number;

  @Column({ type: "json", nullable: true })
  customizations: any; // Store selected customizations

  @Column({ type: "json", nullable: true })
  variants: any; // Store selected variants

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
