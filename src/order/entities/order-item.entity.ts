import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./order.entity";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order: Order;

  @ManyToOne(() => Item, { onDelete: "CASCADE" })
  item: Item;

  @Column({ type: "int" })
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
}
