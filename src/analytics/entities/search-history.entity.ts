import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

@Entity()
export class SearchHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "varchar", length: 255 })
  search_term: string;

  @Column({ type: "varchar", length: 50 })
  search_type: string; // restaurant, dish, category

  @Column({ type: "int", nullable: true })
  result_count: number;

  @CreateDateColumn()
  created_at: Date;
}
