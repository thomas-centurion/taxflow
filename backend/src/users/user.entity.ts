import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Document } from '../documents/document.entity';
import { Notification } from '../notifications/notification.entity';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { UserRole } from './user-role.enum';

@Entity({ name: 'users' })
@Index('UQ_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'first_name', type: 'varchar', length: 80 }) firstName!: string;
  @Column({ name: 'last_name', type: 'varchar', length: 80 }) lastName!: string;
  @Column({ type: 'varchar', length: 254 }) email!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) passwordHash!: string;
  @Column({ type: 'enum', enum: UserRole, enumName: 'users_role_enum' }) role!: UserRole;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @OneToMany(() => TaxObligation, (obligation) => obligation.responsibleUser) assignedObligations!: TaxObligation[];
  @OneToMany(() => Document, (document) => document.uploadedBy) uploadedDocuments!: Document[];
  @OneToMany(() => Notification, (notification) => notification.user) notifications!: Notification[];
  @OneToMany(() => AuditLog, (auditLog) => auditLog.user) auditLogs!: AuditLog[];
}