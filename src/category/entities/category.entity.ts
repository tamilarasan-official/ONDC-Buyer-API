import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubCategory } from "./sub-category.entity";
import { CategoryTimings } from "./category-timings.entity";
import { CategoryConfigs } from "./category-configs.entity";
import { Store } from "../../store/entities/store.entity";
import { Item } from "../../item/entities/item.entity";
import { ItemCategories } from "../../item/entities/item-categories.entity";
import { ItemCustomizationGroups } from "../../item/entities/item-customization-groups.entity";
import { CustomizationRelationships } from "../../item/entities/customization-relationships.entity";

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.categories, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: false })
  icon: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC category ID like "5", "CG1"

  @Column({ type: "int", nullable: true })
  parent_category_id: number | null; // For hierarchical categories

  @Column({ type: "varchar", length: 50, nullable: false })
  type: string; // "custom_menu" or "custom_group"

  @Column({ type: "int", nullable: true })
  display_rank: number | null; // Display order

  @Column({ type: "boolean", default: true })
  status: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => SubCategory, (SubCategory) => SubCategory.category, {
    eager: true,
    onDelete: "CASCADE",
  })
  sub_categories: SubCategory[];

  @OneToMany(() => CategoryTimings, (timing) => timing.category)
  timings: CategoryTimings[];

  @OneToMany(() => CategoryConfigs, (config) => config.category)
  configs: CategoryConfigs[];

  @OneToMany(() => Item, (item) => item.category)
  items: Item[];

  @OneToMany(() => ItemCategories, (itemCategory) => itemCategory.category)
  item_categories: ItemCategories[];

  @OneToMany(
    () => ItemCustomizationGroups,
    (itemCustomizationGroup) => itemCustomizationGroup.customization_group,
  )
  itemCustomizationGroups: ItemCustomizationGroups[];

  @OneToMany(
    () => CustomizationRelationships,
    (relationship) => relationship.child_customization_group,
  )
  customizationRelationships: CustomizationRelationships[];
}
