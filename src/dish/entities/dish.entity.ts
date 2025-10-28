import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Dish {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 255, nullable: false })
    @Index({ unique: true })
    name: string;

    @Column({ type: "text", nullable: true })
    description?: string;

    @Column({ type: "text", nullable: false })
    icon: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  food_type: string;

  @Column({ type: "integer", default: 0 })
  @Index()
  sequence: number;

  @Column({ type: "boolean", default: true })
  status: boolean;

    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;

    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    updated_at: Date;

}
