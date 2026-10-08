import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { map } from 'rxjs';

import { StoredDocument } from '../../models/document.model';
import { fileTypeOf } from '../../utils/file-rules';

const ALL_COLUMNS = ['name', 'type', 'uploadedAt', 'actions'];
/** En pantallas chicas solo el nombre (con la fecha debajo) y acciones. */
const COMPACT_COLUMNS = ['name', 'actions'];

/** Tabla de documentos con buscador, orden y paginación. */
@Component({
  selector: 'app-document-table',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './document-table.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTableComponent {
  readonly documents = input.required<StoredDocument[]>();
  /** Muestra el skeleton mientras no haya documentos. */
  readonly loading = input(false);

  readonly remove = output<StoredDocument>();

  protected readonly search = signal('');
  protected readonly dataSource = new MatTableDataSource<StoredDocument>([]);
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
        case 'uploadedAt':
          return doc.uploadedAt;
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
}
