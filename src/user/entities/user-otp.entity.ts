import { Column, Entity, OneToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity()
export class UserOtp {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => User, (user) => user.userOtp, { onDelete: 'CASCADE' })
    user: User;

    @Column({ type: 'int', nullable: false })
    otp: number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

}