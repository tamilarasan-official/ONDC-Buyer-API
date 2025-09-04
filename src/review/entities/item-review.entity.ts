import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Item } from "../../item/entities/item.entity";
import { Order } from "../../order/entities/order.entity";

@Entity()
export class ItemReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Item, { onDelete: "CASCADE" })
  item: Item;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order: Order;

  @Column({ type: "int" })
  rating: number; // 1-5 stars

  @Column({ type: "varchar", length: 255, nullable: true })
  title: string; // Review title

  @Column({ type: "text", nullable: true })
  comment: string;

  @Column({ type: "int", nullable: true })
  taste: number; // 1-5 stars

  @Column({ type: "int", nullable: true })
  portion_size: number; // 1-5 stars

  @Column({ type: "int", nullable: true })
  value_for_money: number; // 1-5 stars

  @Column({ type: "json", nullable: true })
  images: string[]; // Review images

  @Column({ type: "boolean", default: false })
  is_verified: boolean; // Verified purchase

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
