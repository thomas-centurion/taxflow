import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity({ name: 'audit_logs' })
@Index('IDX_audit_logs_created_at', ['createdAt'])
@Index('IDX_audit_logs_entity', ['entity', 'entityId'])
@Index('IDX_audit_logs_user_id', ['userId'])
@Index('IDX_audit_logs_action_created_at', ['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!: string | null;
  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' }) user!: User | null;
  @Column({ name: 'actor_type', type: 'varchar', length: 12, default: 'USER' }) actorType!: 'USER' | 'SYSTEM';
  @Column({ name: 'actor_email', type: 'varchar', length: 254, nullable: true }) actorEmail!: string | null;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ type: 'varchar', length: 100 }) entity!: string;
  @Column({ name: 'entity_id', type: 'uuid', nullable: true }) entityId!: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
