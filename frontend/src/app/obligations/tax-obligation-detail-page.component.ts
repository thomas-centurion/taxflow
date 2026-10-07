import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { DocumentsApiService } from '../core/services/documents-api.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { TaxObligationsApiService } from '../core/services/tax-obligations-api.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog.component';
import { TaxDocument } from '../shared/models/document.model';
import { TaxObligation, TaxObligationStatus, TaxObligationType } from '../shared/models/tax-obligation.model';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Component({
  selector: 'app-tax-obligation-detail-page', standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule],
  template: `
    <header class="detail-head"><div><a class="back-link" routerLink="/app/tax-obligations"><mat-icon>arrow_back</mat-icon> Obligaciones fiscales</a>
      <p class="eyebrow">DETALLE DE OBLIGACIÓN</p><h1>{{ obligation?.name || 'Obligación' }}</h1></div>
      <button mat-stroked-button type="button" (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon> Actualizar</button></header>
    <mat-progress-bar *ngIf="loading" mode="indeterminate" aria-label="Cargando obligación" />
    <section *ngIf="errorMessage" class="error-panel" role="alert"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span><button mat-button (click)="load()">Reintentar</button></section>
    <ng-container *ngIf="obligation as item">
      <mat-card class="info-card"><mat-card-header><mat-card-title>Información general</mat-card-title></mat-card-header><mat-card-content>
        <dl class="info-grid"><div><dt>Empresa</dt><dd>{{ item.company.name }}</dd></div><div><dt>País</dt><dd>{{ item.country.name }}</dd></div>
          <div><dt>Tipo</dt><dd>{{ typeLabel(item.type) }}</dd></div><div><dt>Estado</dt><dd><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span></dd></div>
          <div><dt>Vencimiento</dt><dd>{{ item.dueDate | date:'dd/MM/yyyy':'UTC' }}</dd></div><div><dt>Responsable</dt><dd>{{ item.responsibleUser ? item.responsibleUser.firstName + ' ' + item.responsibleUser.lastName : 'Sin asignar' }}</dd></div>
          <div class="description"><dt>Descripción</dt><dd>{{ item.description || 'Sin descripción' }}</dd></div>
        </dl>
      </mat-card-content></mat-card>

      <mat-card class="documents-card"><mat-card-header><mat-card-title>Documentos</mat-card-title>
        <button *ngIf="canManage" mat-flat-button color="primary" type="button" (click)="fileInput.click()" [disabled]="uploading"><mat-icon>upload_file</mat-icon> Subir documento</button>
      </mat-card-header><mat-card-content>
        <input #fileInput class="file-input" type="file" [accept]="acceptTypes" (change)="selectFile($event)" aria-label="Seleccionar documento" />
        <div *ngIf="canManage && selectedFile" class="selected-file"><mat-icon>description</mat-icon><span>{{ selectedFile.name }}</span><small>{{ formatSize(selectedFile.size) }}</small>
          <button mat-button type="button" (click)="upload()" [disabled]="uploading">{{ uploading ? 'Subiendo…' : 'Confirmar carga' }}</button><button mat-icon-button type="button" aria-label="Quitar archivo seleccionado" (click)="clearSelection()"><mat-icon>close</mat-icon></button>
        </div>
        <mat-progress-bar *ngIf="uploading" mode="determinate" [value]="uploadProgress" aria-label="Progreso de carga" />
        <div *ngIf="loadingDocuments" class="loading-state"><mat-spinner diameter="28"></mat-spinner><span>Cargando documentos…</span></div>
        <div *ngIf="!loadingDocuments && documentsError" class="list-error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ documentsError }}</span><button mat-button (click)="loadDocuments()">Reintentar</button></div>
        <div *ngIf="!loadingDocuments && !documentsError && documents.length === 0" class="empty-state"><mat-icon>folder_open</mat-icon><strong>No hay documentos asociados.</strong><span>Los archivos cargados para esta obligación aparecerán acá.</span></div>
        <div *ngIf="!loadingDocuments && !documentsError && documents.length" class="table-scroll"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Subido por</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody><tr *ngFor="let document of documents"><td><strong>{{ document.originalFilename }}</strong></td><td>{{ document.mimeType }}</td><td>{{ formatSize(document.size) }}</td>
            <td>{{ document.uploadedBy.firstName }} {{ document.uploadedBy.lastName }}</td><td>{{ document.createdAt | date:'dd/MM/yyyy HH:mm' }}</td><td class="actions">
              <button mat-icon-button type="button" aria-label="Descargar documento" (click)="download(document)"><mat-icon>download</mat-icon></button>
              <button *ngIf="canManage" mat-icon-button color="warn" type="button" aria-label="Eliminar documento" (click)="confirmDelete(document)"><mat-icon>delete_outline</mat-icon></button>
            </td></tr></tbody></table></div>
      </mat-card-content></mat-card>
    </ng-container>
  `,
  styles: [`
    :host{display:block;color:#243448}.detail-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:20px}.back-link{display:inline-flex;align-items:center;gap:6px;color:#356ca9;text-decoration:none;font-size:12px;margin-bottom:14px}.back-link mat-icon{font-size:18px;width:18px;height:18px}.eyebrow{color:#718197;font-size:10px;font-weight:700;letter-spacing:.13em;margin:0 0 6px}.detail-head h1{font-size:27px;letter-spacing:-.025em;margin:0;color:#203249}.detail-head button mat-icon{font-size:18px;width:18px;height:18px;margin-right:4px}.info-card,.documents-card{border:1px solid #e2e8ef;box-shadow:none!important;border-radius:10px!important;margin-bottom:16px}.info-card mat-card-header,.documents-card mat-card-header{align-items:center;min-height:58px;padding:4px 18px 0}.info-card mat-card-title,.documents-card mat-card-title{font-size:15px!important;font-weight:650!important}.documents-card mat-card-header button{margin-left:auto}.documents-card mat-card-header button mat-icon{margin-right:4px}.info-card mat-card-content,.documents-card mat-card-content{padding:8px 18px 20px}.info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 24px;margin:4px 0}.info-grid div{min-width:0}.info-grid dt{font-size:11px;color:#8592a1;margin-bottom:5px}.info-grid dd{font-size:13px;color:#34475d;font-weight:550;margin:0;overflow-wrap:anywhere}.description{grid-column:1/-1}.status{display:inline-flex;border-radius:18px;padding:4px 9px;background:#eef2f5;color:#687687;font-size:10px}.status[data-status="PENDING"]{background:#fff5df;color:#96690d}.status[data-status="IN_PROGRESS"]{background:#e8f2fc;color:#28669e}.status[data-status="SUBMITTED"]{background:#f1ecfb;color:#6949a3}.status[data-status="APPROVED"]{background:#e8f5ee;color:#287452}.status[data-status="OVERDUE"]{background:#fceaea;color:#ad3f3f}.status[data-status="CANCELLED"]{background:#eef0f2;color:#697583}.file-input{display:none}.selected-file{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 14px;background:#f5f8fb;border:1px solid #e3eaf1;border-radius:8px;font-size:12px}.selected-file mat-icon{color:#4f7197}.selected-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected-file small{color:#8290a0;white-space:nowrap}.selected-file button:first-of-type{margin-left:auto}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}th{text-align:left;font-size:10px;color:#8491a1;font-weight:650;padding:10px;border-bottom:1px solid #e8edf2}td{padding:11px 10px;border-bottom:1px solid #edf0f4;color:#536276}td strong{font-weight:600;color:#30445a}tbody tr:last-child td{border-bottom:0}.actions{white-space:nowrap}.actions button{width:36px;height:36px}.actions mat-icon{font-size:19px}.empty-state,.loading-state{min-height:135px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8491a1;font-size:12px;text-align:center}.empty-state mat-icon{color:#8ca0b5}.empty-state strong{color:#586a7f}.loading-state{flex-direction:row}.error-panel,.list-error{display:flex;align-items:center;gap:10px;padding:15px;margin-bottom:16px;border:1px solid #edcccc;border-radius:8px;background:#fffafa;color:#873f3f;font-size:13px}.error-panel button,.list-error button{margin-left:auto}.list-error mat-icon{color:#b94949}
    @media(max-width:700px){.detail-head{align-items:flex-start}.detail-head h1{font-size:23px}.info-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.info-card mat-card-content,.documents-card mat-card-content{padding-left:10px;padding-right:10px}.info-card mat-card-header,.documents-card mat-card-header{padding-left:12px;padding-right:8px}.selected-file{flex-wrap:wrap}.selected-file button:first-of-type{margin-left:0}}
  `],
})
export class TaxObligationDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly obligationsApi = inject(TaxObligationsApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly acceptTypes = Object.entries(ALLOWED_FILE_TYPES).map(([extension, type]) => `${extension},${type}`).join(',');
  obligation: TaxObligation | null = null;
  documents: TaxDocument[] = [];
  selectedFile: File | null = null;
  loading = false;
  loadingDocuments = false;
  documentsError = '';
  uploading = false;
  uploadProgress = 0;
  errorMessage = '';
  private obligationId = '';
  private fileInput: HTMLInputElement | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.obligationId = params.get('id') ?? '';
      this.load();
    });
  }

  get canManage(): boolean { return this.auth.hasRole('ADMIN', 'TAX_MANAGER'); }
  load(): void {
    if (!this.obligationId) return;
    this.loading = true; this.loadingDocuments = true; this.errorMessage = '';
    this.obligationsApi.get(this.obligationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (obligation) => { this.obligation = obligation; this.loading = false; this.loadDocuments(); },
      error: (error: unknown) => { this.loading = false; this.loadingDocuments = false; this.errorMessage = apiErrorMessage(error, 'No se pudo cargar la obligación.'); },
    });
  }

  loadDocuments(): void {
    this.loadingDocuments = true; this.documentsError = '';
    this.documentsApi.listForObligation(this.obligationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (documents) => { this.documents = documents; this.loadingDocuments = false; },
      error: (error: unknown) => { this.loadingDocuments = false; this.documentsError = apiErrorMessage(error, 'No se pudieron cargar los documentos.'); },
    });
  }

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileInput = input;
    const file = input.files?.[0];
    if (!file) { this.selectedFile = null; return; }
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (file.size > MAX_FILE_SIZE) { this.selectedFile = null; this.snack.open('El archivo supera el tamaño máximo permitido de 10 MB.', 'Cerrar', { duration: 5000 }); input.value = ''; return; }
    if (!ALLOWED_FILE_TYPES[extension] || ALLOWED_FILE_TYPES[extension] !== file.type) { this.selectedFile = null; this.snack.open('Tipo de archivo no permitido.', 'Cerrar', { duration: 5000 }); input.value = ''; return; }
    this.selectedFile = file;
  }

  clearSelection(): void { this.selectedFile = null; if (this.fileInput) this.fileInput.value = ''; }

  upload(): void {
    if (!this.selectedFile || !this.canManage || this.uploading) return;
    this.uploading = true; this.uploadProgress = 0;
    this.documentsApi.upload(this.obligationId, this.selectedFile).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) this.uploadProgress = Math.round(event.loaded * 100 / event.total);
        if (event.type === HttpEventType.Response) {
          this.uploading = false; this.selectedFile = null; if (this.fileInput) this.fileInput.value = '';
          this.notificationsApi.refreshUnreadCount();
          this.snack.open('Documento subido correctamente.', 'Cerrar', { duration: 3500 }); this.loadDocuments();
        }
      },
      error: (error: unknown) => { this.uploading = false; this.snack.open(apiErrorMessage(error, 'No se pudo subir el documento.'), 'Cerrar', { duration: 5000 }); },
    });
  }

  download(document: TaxDocument): void {
    this.documentsApi.download(document.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = url; anchor.download = document.originalFilename; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.snack.open('No se pudo descargar el documento.', 'Cerrar', { duration: 5000 }),
    });
  }

  confirmDelete(document: TaxDocument): void {
    this.dialog.open(ConfirmDialogComponent, { data: `¿Eliminar el documento ${document.originalFilename}?`, width: '420px' }).afterClosed().pipe(
      switchMap((confirmed) => confirmed && this.canManage ? this.documentsApi.delete(document.id) : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.documents = this.documents.filter((item) => item.id !== document.id); this.snack.open('Documento eliminado correctamente.', 'Cerrar', { duration: 3500 }); },
      error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo eliminar el documento.'), 'Cerrar', { duration: 5000 }),
    });
  }

  formatSize(size: number): string { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }
  typeLabel(type: TaxObligationType): string { return ({ VAT: 'IVA', INCOME_TAX: 'Impuesto a las ganancias', WITHHOLDING: 'Retenciones', PAYROLL_TAX: 'Impuesto a la nómina', OTHER: 'Otro' } as Record<TaxObligationType, string>)[type]; }
  statusLabel(status: TaxObligationStatus): string { return ({ PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', SUBMITTED: 'Presentada', APPROVED: 'Aprobada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada' } as Record<TaxObligationStatus, string>)[status]; }
}
