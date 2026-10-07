import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-confirm-dialog', standalone: true, imports: [MatButtonModule, MatDialogModule],
  template: `<h2 mat-dialog-title>Confirmar eliminación</h2><mat-dialog-content>{{ data }}</mat-dialog-content><mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancelar</button><button mat-flat-button color="warn" (click)="confirm()">Eliminar</button></mat-dialog-actions>`,
})
export class ConfirmDialogComponent {
  readonly data = inject<string>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>);
  confirm(): void { this.ref.close(true); }
}