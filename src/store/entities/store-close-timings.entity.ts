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
export class StoreCloseTimings {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.closeTimings, {
    onDelete: "CASCADE",
  })
  store: Store;

  @ManyToOne(() => StoreLocation, (location) => location.closeTimings, {
    onDelete: "CASCADE",
    nullable: true,
  })
  location: StoreLocation;

  @Column({ type: "timestamp", nullable: false })
  close_start_datetime: Date;

  @Column({ type: "timestamp", nullable: false })
  close_end_datetime: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  reason: string; // "holiday", "maintenance"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
