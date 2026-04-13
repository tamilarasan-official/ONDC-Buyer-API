import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Dish } from "./dish.entity";

@Entity()
@Index(["dish", "status"])
@Index(["day_from", "day_to", "status"])
export class DishSession {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Dish, (dish) => dish.sessions, { onDelete: "CASCADE" })
  dish: Dish;

  @Column({ type: "smallint", default: 1 })
  day_from: number;

  @Column({ type: "smallint", default: 7 })
  day_to: number;

  @Column({ type: "smallint" })
  start_hhmm: number;

  @Column({ type: "smallint" })
  end_hhmm: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  label?: string;

  @Column({ type: "boolean", default: true })
  status: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
