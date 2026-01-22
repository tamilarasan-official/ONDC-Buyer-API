import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admin_access_logs')
export class AdminAccessLog {
    @PrimaryGeneratedColumn({
        type: 'bigint'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 50,
    })
    role: string;

    @Column({
        type: 'jsonb',
        nullable: true,
    })
    history?: Array<{
        key: string;
        is_active: boolean;
    }>;
    /**
     * Example:
     * [
     *   { key: 'platform_fee', is_active: true },
     *   { key: 'free_delivery', is_active: false }
     * ]
     */

    @CreateDateColumn()
    created_at: Date;
}
