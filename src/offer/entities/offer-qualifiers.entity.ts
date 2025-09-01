import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Offers } from "./offers.entity";

@Entity()
export class OfferQualifiers {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Offers, (offer) => offer.qualifiers, {
    onDelete: "CASCADE",
  })
  offer: Offers;

  @Column({ type: "varchar", length: 50, nullable: false })
  qualifier_type: string; // "min_value", "item_count", etc.

  @Column({ type: "varchar", length: 255, nullable: false })
  qualifier_value: string; // "159", "2", etc.

  @CreateDateColumn()
  created_at: Date;
}
