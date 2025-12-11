import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Store } from "./store.entity";
import { StoreLocation } from "./store-location.entity";

@Entity()
export class StoreTimings {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.timings, {
    onDelete: "CASCADE",
  })
  store: Store;

  @ManyToOne(() => StoreLocation, (location) => location.timings, {
    onDelete: "CASCADE",
    nullable: true,
  })
  location: StoreLocation;

  @Column({ type: "varchar", length: 50, nullable: false })
  type: string; // "Order", "Delivery", "Self-Pickup"

  @Column({ type: "int", nullable: false })
  day_from: number; // 1-7 (Database format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)

  @Column({ type: "int", nullable: false })
  day_to: number; // 1-7 (Database format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)

  @Column({ type: "varchar", length: 4, nullable: false })
  time_from: string; // "HHMM" format like "0900"

  @Column({ type: "varchar", length: 4, nullable: false })
  time_to: string; // "HHMM" format like "2200"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
