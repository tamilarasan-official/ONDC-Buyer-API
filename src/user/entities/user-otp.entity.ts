import { Column, Entity, OneToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity()
export class UserOtp {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => User, (user) => user.otp, { onDelete: 'CASCADE' })
    user: User;

    @Column({ type: 'int', nullable: false })
    otp: number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;

}