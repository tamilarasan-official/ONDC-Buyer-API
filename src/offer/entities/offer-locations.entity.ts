import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Offers } from "./offers.entity";
import { StoreLocation } from "../../store/entities/store-location.entity";

@Entity()
export class OfferLocations {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Offers, (offer) => offer.offer_locations, {
    onDelete: "CASCADE",
  })
  offer: Offers;

  @ManyToOne(() => StoreLocation, (location) => location.offer_locations, {
    onDelete: "CASCADE",
  })
  location: StoreLocation;

  @CreateDateColumn()
  created_at: Date;
}
