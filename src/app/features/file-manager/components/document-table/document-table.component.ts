import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map } from 'rxjs';

import { DocumentStatus, StoredDocument } from '../../models/document.model';
import { FileSizePipe } from '../../pipes/file-size.pipe';
import { fileTypeOf } from '../../utils/file-rules';

const STATUS_LABELS: Record<DocumentStatus, string> = {
  indexed: 'Indexado',
  processing: 'Procesando',
  error: 'Error',
};

const ALL_COLUMNS = ['name', 'type', 'size', 'uploadedAt', 'status', 'actions'];
/** En pantallas chicas solo nombre (con estado y tamaño debajo) y acciones. */
const COMPACT_COLUMNS = ['name', 'actions'];

/** Tabla de documentos con buscador, orden, paginación, estado de indexación y acciones por fila. */
@Component({
  selector: 'app-document-table',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    FileSizePipe,
  ],
  templateUrl: './document-table.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTableComponent {
  readonly documents = input.required<StoredDocument[]>();
  /** Muestra el skeleton mientras no haya documentos. */
  readonly loading = input(false);
  readonly download = output<StoredDocument>();
  readonly reprocess = output<StoredDocument>();
  readonly remove = output<StoredDocument>();

  protected readonly search = signal('');
  protected readonly dataSource = new MatTableDataSource<StoredDocument>([]);
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly fileTypeOf = fileTypeOf;
  protected readonly skeletonRows = [35, 28, 40, 30];

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly displayedColumns = computed(() => (this.compact() ? COMPACT_COLUMNS : ALL_COLUMNS));
  protected readonly showSkeleton = computed(() => this.loading() && this.documents().length === 0);

  constructor() {
    this.dataSource.filterPredicate = (doc, filter) => doc.name.toLowerCase().includes(filter);
    this.dataSource.sortingDataAccessor = (doc, column) => {
      switch (column) {
        case 'name':
          return doc.name.toLowerCase();
        case 'size':
          return doc.size;
        case 'uploadedAt':
          return doc.uploadedAt;
        case 'status':
          return STATUS_LABELS[doc.status];
        default:
          return '';
      }
    };

    effect(() => {
      this.dataSource.data = this.documents();
    });
    effect(() => {
      this.dataSource.filter = this.search().trim().toLowerCase();
      untracked(() => this.paginator()?.firstPage());
    });
    // La tabla está dentro de un @if: sort y paginator aparecen cuando se renderiza.
    effect(() => {
      this.dataSource.sort = this.sort() ?? null;
      this.dataSource.paginator = this.paginator() ?? null;
    });
  }

  protected statusLabel(doc: StoredDocument): string {
    return STATUS_LABELS[doc.status];
  }

  protected chunkLabel(count: number | null): string {
    return count === 1 ? '1 fragmento indexado' : `${count ?? 0} fragmentos indexados`;
  }
}
