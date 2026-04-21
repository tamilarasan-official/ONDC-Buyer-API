import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Collection } from "./collection.entity";

@Entity("collection_entries")
@Unique("UQ_collection_entries_collection_entity", ["collection_id", "entity_id"])
export class CollectionEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Collection, (collection) => collection.entries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "collection_id" })
  collection: Collection;

  @Column({ type: "int" })
  collection_id: number;

  @Column({ type: "int" })
  entity_id: number;

  @Column({ type: "int", default: 1 })
  sequence: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
