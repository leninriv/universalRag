import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { filter, firstValueFrom, map } from 'rxjs';
import { WorkBook } from 'xlsx';

import { TopbarContentDirective } from '../../../../layout/topbar/topbar-content.directive';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileDropZoneComponent } from '../../../../shared/components/file-drop-zone/file-drop-zone.component';
import { MessageEditorComponent } from '../../components/message-editor/message-editor.component';
import { RecipientTableComponent } from '../../components/recipient-table/recipient-table.component';
import { OutgoingMessage, SendResult, SheetData } from '../../models/broadcast.model';
import { WhatsappService } from '../../services/whatsapp.service';
import { MAX_MESSAGE_LENGTH } from '../../utils/limits';
import { buildMessages, buildRecipients, renderMessage, unknownVariables } from '../../utils/recipients';
import {
  SPREADSHEET_ACCEPT,
  SPREADSHEET_HINT,
  SpreadsheetError,
  guessPhoneColumn,
  readSheet,
  readWorkbook,
} from '../../utils/spreadsheet';

const EXAMPLES_PER_COLUMN = 3;

/**
 * Wizard de envío masivo por WhatsApp: 1) cargar un Excel/CSV (se lee en el navegador), 2) elegir la columna de
 * teléfonos, 3) elegir destinatarios, 4) escribir el mensaje (con variables) y enviarlo al backend.
 */
/** Espera entre un mensaje y el siguiente. */
const SEND_INTERVAL_MS = 1000;

@Component({
  selector: 'app-open-wa-page',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatStepperModule,
    TopbarContentDirective,
    AvatarComponent,
    FileDropZoneComponent,
    MessageEditorComponent,
    RecipientTableComponent,
  ],
  templateUrl: './open-wa-page.component.html',
  host: { class: 'block h-full overflow-y-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenWaPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly whatsapp = inject(WhatsappService);

  protected readonly accept = SPREADSHEET_ACCEPT;
  protected readonly hint = SPREADSHEET_HINT;

  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  // Paso 1: archivo
  private readonly workbook = signal<WorkBook | null>(null);
  protected readonly fileName = signal('');
  protected readonly reading = signal(false);
  protected readonly fileError = signal<string | null>(null);
  protected readonly sheetNames = computed(() => this.workbook()?.SheetNames ?? []);
  protected readonly sheetName = linkedSignal(() => this.sheetNames()[0] ?? '');
  private readonly sheetResult = computed((): { sheet: SheetData | null; error: string | null } => {
    const workbook = this.workbook();
    if (!workbook) {
      return { sheet: null, error: null };
    }
    try {
      return { sheet: readSheet(workbook, this.sheetName()), error: null };
    } catch (error) {
      return { sheet: null, error: errorText(error) };
    }
  });
  protected readonly sheet = computed(() => this.sheetResult().sheet);
  protected readonly sheetError = computed(() => this.sheetResult().error);
  protected readonly headers = computed(() => this.sheet()?.headers ?? []);

  // Paso 2: columna de teléfono (se preselecciona si el nombre lo sugiere)
  protected readonly phoneColumn = linkedSignal<string | null>(() => guessPhoneColumn(this.headers()));
  protected readonly columnExamples = computed(() => {
    const rows = this.sheet()?.rows ?? [];
    return Object.fromEntries(
      this.headers().map((header) => [
        header,
        rows
          .map((row) => row[header])
          .filter(Boolean)
          .slice(0, EXAMPLES_PER_COLUMN)
          .join(' · '),
      ]),
    );
  });

  // Paso 3: destinatarios (todos seleccionados al cambiar de archivo, hoja o columna)
  protected readonly recipientList = computed(() => {
    const sheet = this.sheet();
    const column = this.phoneColumn();
    return sheet && column ? buildRecipients(sheet, column) : { recipients: [], emptyCount: 0, duplicateCount: 0 };
  });
  protected readonly selectedIds = linkedSignal<ReadonlySet<string>>(
    () => new Set(this.recipientList().recipients.map((recipient) => recipient.id)),
  );
  protected readonly selectedRecipients = computed(() => {
    const ids = this.selectedIds();
    return this.recipientList().recipients.filter((recipient) => ids.has(recipient.id));
  });
  /** "Se omitieron 2 filas sin teléfono y 1 teléfono repetido." (vacío si no se omitió nada). */
  protected readonly omittedSummary = computed(() => {
    const { emptyCount, duplicateCount } = this.recipientList();
    const parts = [
      emptyCount ? `${emptyCount} ${emptyCount === 1 ? 'fila sin teléfono' : 'filas sin teléfono'}` : '',
      duplicateCount ? `${duplicateCount} ${duplicateCount === 1 ? 'teléfono repetido' : 'teléfonos repetidos'}` : '',
    ].filter(Boolean);
    return parts.length ? `Se omitieron ${parts.join(' y ')}.` : '';
  });
  protected readonly otherColumns = computed(() => this.headers().filter((header) => header !== this.phoneColumn()));

  // Paso 4: mensaje
  protected readonly message = signal('');
  protected readonly longestMessage = computed(() => {
    const template = this.message();
    return this.selectedRecipients().reduce((max, recipient) => Math.max(max, renderMessage(template, recipient.data).length), 0);
  });
  protected readonly messageValid = computed(
    () =>
      this.message().trim().length > 0 &&
      unknownVariables(this.message(), this.headers()).length === 0 &&
      this.longestMessage() <= MAX_MESSAGE_LENGTH,
  );

  // Envío
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  /** Mensajes ya procesados durante el envío (para el indicador de progreso). */
  protected readonly progress = signal(0);
  protected readonly result = signal<SendResult | null>(null);

  protected async onFiles(files: File[]): Promise<void> {
    const file = files[0];
    this.reading.set(true);
    this.fileError.set(null);
    try {
      const workbook = await readWorkbook(file);
      this.workbook.set(workbook);
      this.fileName.set(file.name);
    } catch (error) {
      this.workbook.set(null);
      this.fileName.set('');
      this.fileError.set(errorText(error));
    } finally {
      this.reading.set(false);
    }
  }

  protected send(): void {
    const recipients = this.selectedRecipients();
    const count = recipients.length;
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: '¿Enviar mensajes?',
          message: `Se ${count === 1 ? 'enviará 1 mensaje' : `enviarán ${count.toLocaleString('es')} mensajes`} por WhatsApp. Esta acción no se puede deshacer.`,
          confirmLabel: 'Enviar',
        },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => void this.sendAll(buildMessages(this.message(), recipients)));
  }

  /**
   * TODO: mover el envío a una cola en el backend. Por ahora el front llama a `send-whatsapp` con un
   * mensaje a la vez y espera 1 segundo entre uno y otro.
   */
  private async sendAll(messages: OutgoingMessage[]): Promise<void> {
    this.sending.set(true);
    this.sendError.set(null);
    this.progress.set(0);
    let sent = 0;
    let failed = 0;
    for (const [index, message] of messages.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
      }
      try {
        await firstValueFrom(this.whatsapp.sendText(message.phone, message.text));
        sent++;
      } catch {
        failed++;
      }
      this.progress.set(index + 1);
    }
    this.sending.set(false);
    if (sent === 0) {
      this.sendError.set('No se pudo enviar ningún mensaje. Intenta de nuevo.');
    } else {
      this.result.set({ sent, failed });
    }
  }

  /** Vuelve al paso 1 con el wizard vacío. */
  protected restart(): void {
    this.workbook.set(null);
    this.fileName.set('');
    this.fileError.set(null);
    this.message.set('');
    this.sendError.set(null);
    this.result.set(null);
  }
}

function errorText(error: unknown): string {
  if (error instanceof SpreadsheetError) {
    return error.message;
  }
  return 'No se pudo leer el archivo.';
}
