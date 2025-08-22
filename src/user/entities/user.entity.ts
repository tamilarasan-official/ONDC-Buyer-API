import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { UserOtp } from "./user-otp.entity";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name?: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email?: string;

    @Column({ type: 'int', nullable: false })
    phone_number: number;

    @Column({ type: 'boolean', default: true })
    status?: boolean;

    @OneToOne(() => UserOtp, (userOtp) => userOtp.user, { cascade: true, nullable: true })
    @JoinColumn({ name: "user_otp_id" })
    userOtp: UserOtp;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
