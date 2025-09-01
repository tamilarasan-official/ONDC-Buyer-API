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
import { ItemVariants } from "./item-variants.entity";

@Entity()
export class VariantGroups {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, (store) => store.variantGroups, {
    onDelete: "CASCADE",
  })
  store: Store;

  @Column({ type: "varchar", length: 255, nullable: false })
  reference_id: string; // ONDC variant group reference

  @Column({ type: "varchar", length: 255, nullable: false })
  name: string; // e.g., "Size Variants", "Color Variants"

  @Column({ type: "text", nullable: true })
  description: string; // Description of the variant group

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ItemVariants, (itemVariant) => itemVariant.variant_group)
  item_variants: ItemVariants[];
}
