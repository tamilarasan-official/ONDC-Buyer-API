import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Item } from "../../item/entities/item.entity";
import { VariantGroups } from "./variant-groups.entity";

@Entity()
export class ItemVariants {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Item, (item) => item.itemVariants, {
    onDelete: "CASCADE",
  })
  item: Item;

  @ManyToOne(
    () => VariantGroups,
    (variantGroup) => variantGroup.item_variants,
    {
      onDelete: "CASCADE",
    },
  )
  variant_group: VariantGroups;

  @Column({ type: "boolean", default: false })
  is_default: boolean; // Whether this is the default variant

  @CreateDateColumn()
  created_at: Date;
}
