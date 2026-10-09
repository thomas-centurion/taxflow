import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonSummaryDto } from '../../common/swagger/person-summary.dto';
import { TaxObligationStatus } from '../../tax-obligations/tax-obligation-status.enum';
import { AutomationRunResult, AutomationRunStatus, AutomationRunTrigger } from '../automation-run.entity';
import { AutomationErrorCode, AutomationRunView } from '../automation-runs.service';
import { DeadlineCheckResult } from '../deadline-automation.service';

export class AutomationRunResultDto implements AutomationRunResult {
  @ApiPropertyOptional({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus' }) previousStatus?: TaxObligationStatus;
  @ApiPropertyOptional({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus' }) status?: TaxObligationStatus;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-05' }) dueDate?: string;
  @ApiPropertyOptional({ example: -3, description: 'Negative when the obligation is past due.' }) daysUntilDue?: number;
  @ApiPropertyOptional() overdueMarked?: boolean;
  @ApiPropertyOptional({ example: 1, description: 'Deadline alerts created by this run (deduplicated).' }) notificationsCreated?: number;
  @ApiPropertyOptional() withoutResponsible?: boolean;
  @ApiPropertyOptional({ example: 18 }) durationMs?: number;
}

export class AutomationRunResponseDto implements AutomationRunView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) taxObligationId!: string;
  @ApiProperty({ enum: AutomationRunTrigger, enumName: 'AutomationRunTrigger' }) trigger!: AutomationRunTrigger;
  @ApiProperty({ enum: AutomationRunStatus, enumName: 'AutomationRunStatus' }) status!: AutomationRunStatus;
  @ApiProperty({ type: PersonSummaryDto, nullable: true, description: 'Requester of a MANUAL run; null for SCHEDULED runs or deleted users.' })
  requestedBy!: PersonSummaryDto | null;
  @ApiProperty({ type: Date, nullable: true }) startedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) finishedAt!: Date | null;
  @ApiProperty({ enum: AutomationErrorCode, enumName: 'AutomationErrorCode', nullable: true }) errorCode!: AutomationErrorCode | null;
  @ApiProperty({ type: String, nullable: true }) errorMessage!: string | null;
  @ApiProperty({ type: AutomationRunResultDto, nullable: true }) result!: AutomationRunResultDto | null;
  @ApiProperty() createdAt!: Date;
}

export class DeadlineCheckResultDto implements DeadlineCheckResult {
  @ApiProperty({ example: 12, description: 'Obligations selected: open or overdue and due within 7 days.' }) checked!: number;
  @ApiProperty({ example: 3 }) notificationsCreated!: number;
  @ApiProperty({ example: 1 }) overdueMarked!: number;
  @ApiProperty({ example: 0 }) skippedWithoutResponsible!: number;
  @ApiProperty({ example: 0, description: 'Skipped because another run was already processing the obligation.' }) skippedActiveRun!: number;
  @ApiProperty({ example: 0 }) failed!: number;
}
