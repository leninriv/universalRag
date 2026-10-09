import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { Recipient } from '../../models/broadcast.model';

/**
 * Destinatarios con checkbox, buscador y paginación. Muestra el teléfono y el resto de las columnas del archivo.
 * "Seleccionar todos" afecta solo a las filas que coinciden con la búsqueda.
 */
@Component({
  selector: 'app-recipient-table',
  imports: [FormsModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatTableModule],
  templateUrl: './recipient-table.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipientTableComponent {
  readonly recipients = input.required<Recipient[]>();
  readonly phoneColumn = input.required<string>();
  /** Columnas del archivo además del teléfono. */
  readonly columns = input<string[]>([]);
  /** Ids de los destinatarios seleccionados. */
  readonly selected = model.required<ReadonlySet<string>>();

  protected readonly search = signal('');
  protected readonly dataSource = new MatTableDataSource<Recipient>([]);
  private readonly paginator = viewChild(MatPaginator);

  /** Ids de columna estables aunque las cabeceras tengan espacios o símbolos. */
  protected readonly extraColumns = computed(() => this.columns().map((name, index) => ({ id: `col${index}`, name })));
  protected readonly displayedColumns = computed(() => ['select', 'phone', ...this.extraColumns().map((column) => column.id)]);

  private readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.recipients();
    }
    return this.recipients().filter(
      (recipient) =>
        recipient.phone.toLowerCase().includes(term) ||
        Object.values(recipient.data).some((value) => value.toLowerCase().includes(term)),
    );
  });

  protected readonly allFilteredSelected = computed(() => {
    const selected = this.selected();
    const filtered = this.filtered();
    return filtered.length > 0 && filtered.every((recipient) => selected.has(recipient.id));
  });
  protected readonly someFilteredSelected = computed(() => {
    const selected = this.selected();
    return !this.allFilteredSelected() && this.filtered().some((recipient) => selected.has(recipient.id));
  });

  constructor() {
    effect(() => {
      this.dataSource.data = this.filtered();
      untracked(() => this.paginator()?.firstPage());
    });
    effect(() => {
      this.dataSource.paginator = this.paginator() ?? null;
    });
  }

  protected toggle(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleAllFiltered(): void {
    const select = !this.allFilteredSelected();
    this.selected.update((current) => {
      const next = new Set(current);
      for (const recipient of this.filtered()) {
        if (select) {
          next.add(recipient.id);
        } else {
          next.delete(recipient.id);
        }
      }
      return next;
    });
  }
}
