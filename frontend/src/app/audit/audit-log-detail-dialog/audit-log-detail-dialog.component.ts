import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AuditLog } from '../../shared/models/audit-log.model';
import { AUDIT_ACTION, entityLabel } from '../../shared/presentation/labels';
import { auditActor, auditChanges, auditDetails } from '../audit-format';

@Component({
  selector: 'app-audit-log-detail-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule],
  templateUrl: './audit-log-detail-dialog.component.html',
  styleUrl: './audit-log-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogDetailDialogComponent {
  readonly log = inject<AuditLog>(MAT_DIALOG_DATA);
  readonly action = AUDIT_ACTION[this.log.action] ?? { label: this.log.action, tone: 'neutral' };
  readonly entity = entityLabel(this.log.entity);
  readonly actor = auditActor(this.log);
  readonly changes = auditChanges(this.log);
  readonly details = auditDetails(this.log);
}
