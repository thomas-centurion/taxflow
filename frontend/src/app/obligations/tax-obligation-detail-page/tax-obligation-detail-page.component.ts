import { HttpEventType } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, EMPTY, catchError, combineLatest, finalize, map, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { DocumentsApiService } from '../../core/services/documents-api.service';
import { NotificationsApiService } from '../../core/services/notifications-api.service';
import { TaxObligationsApiService } from '../../core/services/tax-obligations-api.service';
import { TaxDocument } from '../../shared/models/document.model';
import { TaxObligation } from '../../shared/models/tax-obligation.model';
import { fileSize, mimeLabel, personName } from '../../shared/presentation/format';
import { typeLabel } from '../../shared/presentation/labels';
import { confirmAction } from '../../shared/ui/confirm-dialog.component';
import { DueDateComponent } from '../../shared/ui/due-date.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ObligationEditorService } from '../obligation-editor.service';

/** Client-side pre-check mirroring the API's accepted files; the API still validates content. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Component({
  selector: 'app-tax-obligation-detail-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, DueDateComponent, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, StatusBadgeComponent],
  templateUrl: './tax-obligation-detail-page.component.html',
  styleUrl: './tax-obligation-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxObligationDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly obligationsApi = inject(TaxObligationsApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly editor = inject(ObligationEditorService);
  private readonly feedback = inject(FeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = inject(AuthService).hasRole('ADMIN', 'TAX_MANAGER');
  readonly acceptTypes = Object.entries(ALLOWED_FILE_TYPES).map(([extension, type]) => `${extension},${type}`).join(',');
  readonly typeLabel = typeLabel;
  readonly personName = personName;
  readonly fileSize = fileSize;
  readonly mimeLabel = mimeLabel;

  readonly obligation = signal<TaxObligation | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly documents = signal<TaxDocument[]>([]);
  readonly documentsLoading = signal(true);
  readonly documentsError = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly dragging = signal(false);

  private obligationId = '';
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  constructor() {
    combineLatest([this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), this.reload$]).pipe(
      tap(([id]) => { this.obligationId = id; this.loading.set(true); this.error.set(''); }),
      switchMap(([id]) => this.obligationsApi.get(id).pipe(
        catchError((error: unknown) => { this.error.set(apiErrorMessage(error, 'No se pudo cargar la obligación.')); return EMPTY; }),
        finalize(() => this.loading.set(false)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((obligation) => {
      this.obligation.set(obligation);
      this.loadDocuments();
    });
  }

  reload(): void { this.reload$.next(); }

  edit(): void {
    const current = this.obligation();
    if (!current) return;
    this.editor.open(current).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.reload(),
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudieron cargar los datos del formulario.'),
    });
  }

  loadDocuments(): void {
    this.documentsLoading.set(true);
    this.documentsError.set('');
    this.documentsApi.listForObligation(this.obligationId).pipe(
      finalize(() => this.documentsLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (documents) => this.documents.set(documents),
      error: (error: unknown) => this.documentsError.set(apiErrorMessage(error, 'No se pudieron cargar los documentos.')),
    });
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pickFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    if (!this.canManage || this.uploading()) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.canManage || this.uploading()) return;
    this.pickFile(event.dataTransfer?.files?.[0] ?? null);
  }

  clearSelection(): void { this.selectedFile.set(null); }

  upload(): void {
    const file = this.selectedFile();
    if (!file || !this.canManage || this.uploading()) return;
    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.documentsApi.upload(this.obligationId, file).pipe(
      finalize(() => this.uploading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) this.uploadProgress.set(Math.round((event.loaded * 100) / event.total));
        if (event.type === HttpEventType.Response) {
          this.selectedFile.set(null);
          this.notificationsApi.refreshUnreadCount();
          this.feedback.success(`Se cargó "${file.name}".`);
          this.loadDocuments();
        }
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo subir el documento.'),
    });
  }

  download(document: TaxDocument): void {
    this.documentsApi.download(document.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = document.originalFilename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo descargar el documento.'),
    });
  }

  confirmDelete(document: TaxDocument): void {
    confirmAction(this.dialog, {
      title: 'Eliminar documento',
      message: 'Se eliminará el archivo y dejará de estar disponible para descargar.',
      subject: document.originalFilename,
      confirmLabel: 'Eliminar documento',
      destructive: true,
    }).pipe(
      switchMap(() => this.documentsApi.delete(document.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.documents.update((items) => items.filter((item) => item.id !== document.id));
        this.feedback.success(`Se eliminó "${document.originalFilename}".`);
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo eliminar el documento.'),
    });
  }

  private pickFile(file: File | null): void {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (file.size > MAX_FILE_SIZE) { this.feedback.error(`"${file.name}" supera el máximo de 10 MB.`); return; }
    if (!ALLOWED_FILE_TYPES[extension] || ALLOWED_FILE_TYPES[extension] !== file.type) {
      this.feedback.error(`"${file.name}" no es un tipo permitido. Usá PDF, PNG, JPG, DOCX o XLSX.`);
      return;
    }
    this.selectedFile.set(file);
  }
}
