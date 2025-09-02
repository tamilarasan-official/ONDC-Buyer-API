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
export class ItemBarcodes {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.barcodes, {
    onDelete: "CASCADE",
  })
  item: Item;

  @Column({ type: "int", nullable: false })
  barcode_type: number; // 1-EAN, 2-ISBN, 3-GTIN, 4-HSN, 5-others

  @Column({ type: "varchar", length: 50, nullable: false })
  barcode_type_name: string; // "EAN", "ISBN", "GTIN", "HSN", "Others"

  @Column({ type: "varchar", length: 255, nullable: false })
  barcode_value: string; // Actual code without type prefix

  @Column({ type: "varchar", length: 255, nullable: false })
  full_code: string; // Complete "type:code" format

  @Column({ type: "boolean", default: false })
  is_primary: boolean; // Main barcode for the item

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
