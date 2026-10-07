import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuditLog } from '../shared/models/audit-log.model';

interface ChangeRow { field: string; before: unknown; after: unknown }

@Component({
  selector: 'app-audit-log-detail-dialog', standalone: true,
  imports: [CommonModule, DatePipe, JsonPipe, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Detalle de auditoría</h2>
    <mat-dialog-content>
      <dl class="identity"><div><dt>Actor</dt><dd>{{ data.actorType === 'SYSTEM' ? 'SYSTEM' : data.actorEmail || 'Usuario eliminado' }}</dd></div>
        <div><dt>Fecha</dt><dd>{{ data.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div><div><dt>Acción</dt><dd>{{ data.action }}</dd></div>
        <div><dt>Recurso</dt><dd>{{ data.entity }}</dd></div><div class="wide"><dt>ID del recurso</dt><dd>{{ data.entityId || '—' }}</dd></div></dl>
      <section *ngIf="changes.length"><h3>Cambios</h3><div class="change" *ngFor="let item of changes"><strong>{{ item.field }}</strong><div><span>Antes</span><code>{{ format(item.before) }}</code></div><div><span>Después</span><code>{{ format(item.after) }}</code></div></div></section>
      <section *ngIf="values"><h3>Datos del evento</h3><pre>{{ values | json }}</pre></section>
      <p *ngIf="!changes.length && !values" class="empty">Este evento no incluye valores anteriores o nuevos.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cerrar</button></mat-dialog-actions>
  `,
  styles: [`
    :host{display:block;min-width:min(600px,80vw)}h2{color:#293b50}.identity{display:grid;grid-template-columns:1fr 1fr;gap:13px 22px;margin:0 0 22px}.identity div{min-width:0}.identity dt{font-size:10px;color:#8793a1;margin-bottom:5px}.identity dd{font-size:12px;color:#34475d;font-weight:550;margin:0;overflow-wrap:anywhere}.identity .wide{grid-column:1/-1}h3{font-size:13px;color:#34475d;margin:20px 0 10px}.change{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px 0;border-top:1px solid #edf0f4}.change>strong{font-size:12px;align-self:center;color:#33475e}.change>div{display:flex;flex-direction:column;gap:5px;min-width:0}.change span{font-size:9px;color:#8a96a3}.change code{font-family:inherit;font-size:11px;color:#44566b;overflow-wrap:anywhere}.change>div:last-child code{color:#287452}.empty{color:#8793a1;font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8fa;padding:12px;border-radius:6px;font:11px/1.5 Consolas,monospace;color:#47576a;max-height:240px;overflow:auto}
    @media(max-width:600px){:host{min-width:0}.identity{grid-template-columns:1fr}.identity .wide{grid-column:auto}.change{grid-template-columns:1fr}}
  `],
})
export class AuditLogDetailDialogComponent {
  readonly changes: ChangeRow[];
  readonly values: unknown;

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: AuditLog) {
    const metadata = data.metadata ?? {};
    const rawChanges = metadata['changes'];
    this.changes = rawChanges && typeof rawChanges === 'object'
      ? Object.entries(rawChanges as Record<string, { before?: unknown; after?: unknown }>).map(([field, change]) => ({ field, before: change.before, after: change.after }))
      : [];
    this.values = metadata['values'] ?? Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== 'changes'));
  }

  format(value: unknown): string { return value === null || value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value); }
}
