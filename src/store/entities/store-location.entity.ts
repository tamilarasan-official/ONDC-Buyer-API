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
import { StoreTimings } from "./store-timings.entity";
import { StoreCloseTimings } from "./store-close-timings.entity";
import { Item } from "../../item/entities/item.entity";
import { OfferLocations } from "../../offer/entities/offer-locations.entity";

@Entity()
export class StoreLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.locations, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC location ID like "L1"

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  gps_lat: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: false })
  gps_lng: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  address_locality: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  address_street: string;

  @Column({ type: "varchar", length: 100, nullable: false })
  address_city: string;

  @Column({ type: "varchar", length: 10, nullable: false })
  address_area_code: string;

  @Column({ type: "varchar", length: 5, nullable: false })
  address_state: string;

  @Column({ type: "decimal", precision: 8, scale: 2, nullable: true })
  delivery_radius_km: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  delivery_radius_unit: string; // "km"

  @Column({ type: "varchar", length: 50, nullable: true })
  days_of_week: string; // "1,2,3,4,5,6,7"

  @Column({ type: "json", nullable: true })
  schedule_holidays: string[]; // JSON array of holiday dates

  @Column({ type: "boolean", default: true })
  status: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => StoreTimings, (timing) => timing.location)
  timings: StoreTimings[];

  @OneToMany(() => StoreCloseTimings, (closeTiming) => closeTiming.location)
  closeTimings: StoreCloseTimings[];

  @OneToMany(() => Item, (item) => item.location)
  items: Item[];

  @OneToMany(() => OfferLocations, (offerLocation) => offerLocation.location)
  offer_locations: OfferLocations[];
}
