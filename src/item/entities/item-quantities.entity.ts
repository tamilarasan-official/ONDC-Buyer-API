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
export class ItemQuantities {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.quantities, {
    onDelete: "CASCADE",
  })
  item: Item;

  @Column({ type: "varchar", length: 20, nullable: false, default: "unit" })
  unit_type: string; // "unit", "kg", "liter", etc.

  @Column({
    type: "decimal",
    precision: 8,
    scale: 3,
    nullable: false,
    default: 1,
  })
  unit_value: number; // Quantity per unit

  @Column({ type: "int", nullable: false, default: 0 })
  available_count: number; // Current available quantity

  @Column({ type: "int", nullable: false, default: 99 })
  maximum_count: number; // Maximum allowed quantity

  @Column({ type: "varchar", length: 20, nullable: true })
  unitized_unit: string; // Unitized measure unit

  @Column({ type: "decimal", precision: 8, scale: 3, nullable: true })
  unitized_value: number; // Unitized measure value

  @Column({ type: "varchar", length: 20, nullable: true })
  measure_unit: string; // Measure unit

  @Column({ type: "decimal", precision: 8, scale: 3, nullable: true })
  measure_value: number; // Measure value

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
