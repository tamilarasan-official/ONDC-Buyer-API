import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('cancel_reasons')
export class CancelReason {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 10 })
    code: string;
    // e.g. "004", "999"

    @Column({ type: 'text' })
    reason: string;

    @Column({ type: 'boolean', default: false })
    is_rto: boolean;

    @Column({ type: 'boolean', default: false })
    is_part_cancel: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cancelled_by: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
