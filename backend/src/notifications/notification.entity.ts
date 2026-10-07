import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { User } from '../users/user.entity';
import { NotificationType } from './notification-type.enum';

@Entity({ name: 'notifications' })
@Index('IDX_notifications_user_read_created', ['userId', 'isRead', 'createdAt'])
@Index('UQ_notifications_dedupe_key', ['dedupeKey'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @ManyToOne(() => User, (user) => user.notifications, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ name: 'tax_obligation_id', type: 'uuid', nullable: true }) taxObligationId!: string | null;
  @ManyToOne(() => TaxObligation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_obligation_id' }) taxObligation!: TaxObligation | null;
  @Column({ name: 'dedupe_key', type: 'varchar', length: 250, nullable: true }) dedupeKey!: string | null;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'text' }) message!: string;
  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type_enum' }) type!: NotificationType;
  @Column({ name: 'is_read', type: 'boolean', default: false }) isRead!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
