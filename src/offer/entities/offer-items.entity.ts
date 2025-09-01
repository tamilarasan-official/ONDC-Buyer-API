import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Offers } from "./offers.entity";
import { Item } from "../../item/entities/item.entity";

@Entity()
export class OfferItems {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Offers, (offer) => offer.offer_items, {
    onDelete: "CASCADE",
  })
  offer: Offers;

  @ManyToOne(() => Item, (item) => item.offer_items, {
    onDelete: "CASCADE",
  })
  item: Item;

  @CreateDateColumn()
  created_at: Date;
}
