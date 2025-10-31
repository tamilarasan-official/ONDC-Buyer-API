import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { StoreLocation } from "./store-location.entity";
import { StoreFulfillment } from "./store-fulfillment.entity";
import { StoreTimings } from "./store-timings.entity";
import { StoreConfigs } from "./store-configs.entity";
import { StoreCloseTimings } from "./store-close-timings.entity";
import { Category } from "../../category/entities/category.entity";
import { Item } from "../../item/entities/item.entity";
import { VariantGroups } from "../../variant/entities/variant-groups.entity";
import { Offers } from "../../offer/entities/offers.entity";

@Entity()
export class Store {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC provider ID like "P1"

  @Column({ type: "varchar", length: 255, nullable: false })
  bpp_id: string; // Seller Network Provider ID

  @Column({ type: "text", nullable: false })
  bpp_uri: string; // Seller Network URI

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  logo_url?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  fssai_license_no?: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  ttl?: string; // Time to live like "P1D"

  @Column({ type: "varchar", length: 15, nullable: true })
  gst_number?: string; // GST registration number like "22AAAAA0000A1Z5"

  @Column({ type: "varchar", length: 50, nullable: true })
  food_type?: string; // Food type like "Veg", "Non Veg", "Vegan"

  @Column({ type: "text", array: true, nullable: true })
  tags?: string[]; // Array of cuisine tags like ["South Indian", "North Indian", "Chinese"]

  @Column({ type: "varchar", length: 20, nullable: true })
  preparation_time?: string; // Order preparation time in ISO8601 format (e.g., PT10M, PT1H30M) from ONDC descriptor.order_preparation_time

  @Column({ type: "boolean", default: true })
  status: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => StoreLocation, (location) => location.store)
  locations: StoreLocation[];

  @OneToMany(() => StoreFulfillment, (fulfillment) => fulfillment.store)
  fulfillments: StoreFulfillment[];

  @OneToMany(() => StoreTimings, (timing) => timing.store)
  timings: StoreTimings[];

  @OneToMany(() => StoreConfigs, (config) => config.store)
  configs: StoreConfigs[];

  @OneToMany(() => StoreCloseTimings, (closeTiming) => closeTiming.store)
  closeTimings: StoreCloseTimings[];

  @OneToMany(() => Category, (category) => category.store)
  categories: Category[];

  @OneToMany(() => Item, (item) => item.store)
  items: Item[];

  @OneToMany(() => VariantGroups, (variantGroup) => variantGroup.store)
  variantGroups: VariantGroups[];

  @OneToMany(() => Offers, (offer) => offer.store)
  offers: Offers[];
}
