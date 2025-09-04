import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Store } from "../../store/entities/store.entity";
import { Order } from "../../order/entities/order.entity";

@Entity()
export class RestaurantReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  store: Store;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order: Order;

  @Column({ type: "int" })
  rating: number; // 1-5 stars

  @Column({ type: "text", nullable: true })
  comment: string;

  @Column({ type: "json", nullable: true })
  images: string[]; // Review images

  @Column({ type: "boolean", default: false })
  is_verified: boolean; // Verified purchase

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
