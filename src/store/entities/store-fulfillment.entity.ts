import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Store } from "./store.entity";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class StoreFulfillment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.fulfillments, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC fulfillment ID like "F1"

  @Column({ type: "varchar", length: 50, nullable: false })
  type: string; // "Delivery", "Self-Pickup", "Buyer-Delivery"

  @Column({ type: "varchar", length: 20, nullable: true })
  contact_phone: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  contact_email: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Item, (item) => item.fulfillment)
  items: Item[];
}
