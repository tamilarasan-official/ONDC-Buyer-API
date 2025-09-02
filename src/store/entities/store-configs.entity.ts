import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Store } from "./store.entity";

@Entity()
export class StoreConfigs {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.configs, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  min_order_value: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  serviceability_type: string; // "10" for radius-based

  @Column({ type: "varchar", length: 50, nullable: true })
  serviceability_value: string; // "3" for 3km

  @Column({ type: "varchar", length: 10, nullable: true })
  serviceability_unit: string; // "km"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
