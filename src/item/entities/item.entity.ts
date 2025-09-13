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
import { StoreLocation } from "../../store/entities/store-location.entity";
import { StoreFulfillment } from "../../store/entities/store-fulfillment.entity";
import { Category } from "../../category/entities/category.entity";
import { ItemCategories } from "./item-categories.entity";
import { ItemTimings } from "./item-timings.entity";
import { ItemAttributes } from "./item-attributes.entity";
import { ItemBarcodes } from "./item-barcodes.entity";
import { ItemVariants } from "../../variant/entities/item-variants.entity";
import { ItemPrices } from "./item-prices.entity";
import { ItemQuantities } from "./item-quantities.entity";
import { ItemCustomizationGroups } from "./item-customization-groups.entity";
import { CustomizationRelationships } from "./customization-relationships.entity";
import { OfferItems } from "../../offer/entities/offer-items.entity";
import { OfferBenefits } from "../../offer/entities/offer-benefits.entity";

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.items, {
    onDelete: "CASCADE",
  })
  store: Store;

  @ManyToOne(() => StoreLocation, (location) => location.items, {
    onDelete: "CASCADE",
    nullable: true,
  })
  location: StoreLocation;

  @ManyToOne(() => StoreFulfillment, (fulfillment) => fulfillment.items, {
    onDelete: "CASCADE",
    nullable: true,
  })
  fulfillment: StoreFulfillment;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC item ID like "I1", "C1"

  @Column({ type: "varchar", length: 255, nullable: true })
  code: string; // ONDC item code like "1:XXXXXXXXXXXXX"

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  short_desc: string; // Brief description

  @Column({ type: "text", nullable: true })
  long_desc: string; // Detailed description

  @Column({ type: "text", nullable: true })
  symbol_url: string;

  @Column({ type: "json", nullable: true })
  images: string[]; // JSON array of image URLs

  @Column({ type: "varchar", length: 50, nullable: false })
  type: string; // "item" or "customization"

  @ManyToOne(() => Category, (category) => category.items, {
    onDelete: "CASCADE",
  })
  category: Category;

  @ManyToOne(() => Item, (item) => item.children, {
    onDelete: "CASCADE",
    nullable: true,
  })
  parent_item: Item; // For customizations - TypeORM will create parent_item_id column automatically

  @OneToMany(() => Item, (item) => item.parent_item)
  children: Item[]; // Child customizations

  @Column({ type: "boolean", default: false })
  is_related: boolean;

  @Column({ type: "boolean", default: false })
  is_recommended: boolean;

  @Column({ type: "boolean", default: false })
  is_returnable: boolean;

  @Column({ type: "boolean", default: false })
  is_cancellable: boolean;

  @Column({ type: "varchar", length: 50, nullable: true })
  return_window: string; // Like "PT1H"

  @Column({ type: "boolean", default: false })
  seller_pickup_return: boolean;

  @Column({ type: "varchar", length: 50, nullable: true })
  time_to_ship: string; // Like "PT45M"

  @Column({ type: "boolean", default: false })
  available_on_cod: boolean;

  @Column({ type: "text", nullable: true })
  consumer_care_details: string;

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  tax_rate?: number; // Tax rate percentage like 5.00, 12.00, 18.00, 28.00

  @Column({ type: "varchar", length: 20, nullable: true })
  tax_type?: string; // "GST", "CGST+SGST", "IGST", "VAT"

  @Column({ type: "varchar", length: 20, nullable: true })
  hsn_code?: string; // HSN/SAC code for tax classification

  @Column({ type: "boolean", default: true })
  status: boolean;

  @Column({ type: "timestamp", nullable: true })
  enable_timestamp: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ItemCategories, (itemCategory) => itemCategory.item)
  item_categories: ItemCategories[];

  @OneToMany(() => ItemTimings, (timing) => timing.item)
  timings: ItemTimings[];

  @OneToMany(() => ItemAttributes, (attribute) => attribute.item)
  attributes: ItemAttributes[];

  @OneToMany(() => ItemBarcodes, (barcode) => barcode.item)
  barcodes: ItemBarcodes[];

  @OneToMany(() => ItemVariants, (itemVariant) => itemVariant.item)
  itemVariants: ItemVariants[];

  @OneToMany(() => ItemPrices, (price) => price.item)
  prices: ItemPrices[];

  @OneToMany(() => ItemQuantities, (quantity) => quantity.item)
  quantities: ItemQuantities[];

  @OneToMany(() => ItemCustomizationGroups, (customizationGroup) => customizationGroup.item)
  customizationGroups: ItemCustomizationGroups[];

  @OneToMany(() => CustomizationRelationships, (relationship) => relationship.parent_customization)
  customizationRelationships: CustomizationRelationships[];

  @OneToMany(() => OfferItems, (offerItem) => offerItem.item)
  offer_items: OfferItems[];

  @OneToMany(() => OfferBenefits, (offerBenefit) => offerBenefit.benefit_item)
  offer_benefits: OfferBenefits[];
}
