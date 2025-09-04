import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class PopularItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, { onDelete: "CASCADE" })
  item: Item;

  @Column({ type: "int", default: 0 })
  view_count: number;

  @Column({ type: "int", default: 0 })
  order_count: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  rating: number;

  @Column({ type: "int", default: 0 })
  review_count: number;

  @UpdateDateColumn()
  updated_at: Date;
}
