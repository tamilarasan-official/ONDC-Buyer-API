import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CollectionEntry } from "./collection-entry.entity";

export enum CollectionType {
  STORE = "store",
  ITEM = "item",
}

export enum CollectionPage {
  HOME = "home",
  BANNER = "banner",
}

@Entity("collections")
export class Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 120 })
  title: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  image_url?: string;

  @Column({
    type: "enum",
    enum: CollectionType,
    default: CollectionType.ITEM,
  })
  type: CollectionType;

  @Column({
    type: "enum",
    enum: CollectionPage,
    default: CollectionPage.HOME,
  })
  page: CollectionPage;

  @Column({ type: "boolean", default: true })
  status: boolean;

  @Column({ type: "int", default: 1 })
  sequence: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CollectionEntry, (entry) => entry.collection)
  entries: CollectionEntry[];
}

