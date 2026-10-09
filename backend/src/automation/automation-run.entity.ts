import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligations/tax-obligation-status.enum';
import { User } from '../users/user.entity';

export enum AutomationRunStatus { PENDING = 'PENDING', RUNNING = 'RUNNING', SUCCEEDED = 'SUCCEEDED', FAILED = 'FAILED' }

export enum AutomationRunTrigger { MANUAL = 'MANUAL', SCHEDULED = 'SCHEDULED' }

export interface AutomationRunResult {
  previousStatus?: TaxObligationStatus;
  status?: TaxObligationStatus;
  dueDate?: string;
  daysUntilDue?: number;
  overdueMarked?: boolean;
  notificationsCreated?: number;
  withoutResponsible?: boolean;
  durationMs?: number;
}

@Entity({ name: 'automation_runs' })
@Index('IDX_automation_runs_obligation_created', ['taxObligationId', 'createdAt'])
export class AutomationRun {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'tax_obligation_id', type: 'uuid' }) taxObligationId!: string;
  @ManyToOne(() => TaxObligation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_obligation_id' }) taxObligation!: TaxObligation;

  @Column({ name: 'requested_by_id', type: 'uuid', nullable: true }) requestedById!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by_id' }) requestedBy!: User | null;

  @Column({ type: 'enum', enum: AutomationRunTrigger, enumName: 'automation_run_trigger_enum' }) trigger!: AutomationRunTrigger;
  @Column({ type: 'enum', enum: AutomationRunStatus, enumName: 'automation_run_status_enum', default: AutomationRunStatus.PENDING }) status!: AutomationRunStatus;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt!: Date | null;
  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true }) errorCode!: string | null;
  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true }) errorMessage!: string | null;
  @Column({ type: 'jsonb', nullable: true }) result!: AutomationRunResult | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
