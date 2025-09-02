import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Offers } from "./offers.entity";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class OfferBenefits {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Offers, (offer) => offer.benefits, {
    onDelete: "CASCADE",
  })
  offer: Offers;

  @Column({ type: "varchar", length: 50, nullable: false })
  benefit_type: string; // "percent", "amount", "item"

  @Column({ type: "varchar", length: 255, nullable: false })
  benefit_value: string; // "-60.00", "-150.00", "3"

  @Column({ type: "varchar", length: 255, nullable: true })
  benefit_cap: string; // "-120.00" for value cap

  @ManyToOne(() => Item, (item) => item.offer_benefits, {
    onDelete: "CASCADE",
    nullable: true,
  })
  benefit_item: Item; // For freebie/item benefits

  @Column({ type: "int", nullable: true })
  benefit_item_count: number; // Quantity of benefit item

  @CreateDateColumn()
  created_at: Date;
}
