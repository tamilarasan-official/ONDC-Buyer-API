import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Store } from "../../store/entities/store.entity";
import { OfferLocations } from "./offer-locations.entity";
import { OfferItems } from "./offer-items.entity";
import { OfferQualifiers } from "./offer-qualifiers.entity";
import { OfferBenefits } from "./offer-benefits.entity";

@Entity()
export class Offers {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.offers, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC offer ID like "DISCP60", "FLAT150"

  @Column({ type: "varchar", length: 255, nullable: true })
  name: string; // Offer name

  @Column({ type: "text", nullable: true })
  description: string; // Offer description

  @Column({ type: "varchar", length: 50, nullable: false })
  offer_code: string; // "discount", "buyXgetY", "freebie"

  @Column({ type: "text", nullable: true })
  banner_image_url: string; // Offer banner image

  @Column({ type: "timestamp", nullable: false })
  valid_from: Date; // Offer start time

  @Column({ type: "timestamp", nullable: false })
  valid_to: Date; // Offer end time

  @Column({ type: "boolean", default: false })
  is_auto_apply: boolean; // Auto-apply offer

  @Column({ type: "boolean", default: false })
  is_additive: boolean; // Can be combined with other offers

  @Column({ type: "boolean", default: true })
  status: boolean; // Active/inactive

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => OfferLocations, (offerLocation) => offerLocation.offer)
  offer_locations: OfferLocations[];

  @OneToMany(() => OfferItems, (offerItem) => offerItem.offer)
  offer_items: OfferItems[];

  @OneToMany(() => OfferQualifiers, (qualifier) => qualifier.offer)
  qualifiers: OfferQualifiers[];

  @OneToMany(() => OfferBenefits, (benefit) => benefit.offer)
  benefits: OfferBenefits[];
}
