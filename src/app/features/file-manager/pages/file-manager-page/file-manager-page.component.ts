import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, switchMap } from 'rxjs';

import { TopbarContentDirective } from '../../../../layout/topbar/topbar-content.directive';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DocumentTableComponent } from '../../components/document-table/document-table.component';
import { FileDropZoneComponent } from '../../components/file-drop-zone/file-drop-zone.component';
import { UploadQueueComponent } from '../../components/upload-queue/upload-queue.component';
import { StoredDocument } from '../../models/document.model';
import { DocumentService } from '../../services/document.service';
import { ACCEPT_ATTR, UPLOAD_HINT } from '../../utils/file-rules';

const SNACKBAR_MS = 4000;

/** Página del módulo FileManager: carga de documentos y listado de la base de conocimiento. */
@Component({
  selector: 'app-file-manager-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TopbarContentDirective,
    DocumentTableComponent,
    FileDropZoneComponent,
    UploadQueueComponent,
  ],
  templateUrl: './file-manager-page.component.html',
  host: { class: 'block h-full overflow-y-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileManagerPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly documentService = inject(DocumentService);

  protected readonly accept = ACCEPT_ATTR;
  protected readonly uploadHint = UPLOAD_HINT;

  constructor() {
    this.documentService.load();
  }

  protected onRemove(doc: StoredDocument): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: '¿Eliminar documento?',
          message: `«${doc.name}» se eliminará junto con todo su contenido indexado. El agente ya no podrá usarlo para responder.`,
          confirmLabel: 'Eliminar',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.documentService.remove(doc)),
      )
      .subscribe({
        next: () => this.notify('Documento eliminado.'),
        error: () => this.notify(`No se pudo eliminar «${doc.name}».`),
      });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: SNACKBAR_MS });
  }
}
