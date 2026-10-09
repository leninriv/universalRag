import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Zona para soltar archivos (drag & drop) con botón para elegirlos desde el equipo. */
@Component({
  selector: 'app-file-drop-zone',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './file-drop-zone.component.html',
  styleUrl: './file-drop-zone.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropZoneComponent {
  /** Valor del atributo `accept` del input, p. ej. `.pdf,.docx`. */
  readonly accept = input('');
  /** Texto de ayuda bajo el botón (tipos y tamaño permitidos). */
  readonly hint = input('');
  readonly multiple = input(true);
  readonly filesSelected = output<File[]>();

  protected readonly dragging = signal(false);
  // dragenter/dragleave también se disparan al pasar sobre los hijos: se cuentan para saber cuándo se sale de la zona.
  private dragDepth = 0;

  protected onDragEnter(event: DragEvent): void {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  protected onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragging.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    this.emit(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onInputChange(fileInput: HTMLInputElement): void {
    this.emit(Array.from(fileInput.files ?? []));
    // Permite volver a elegir el mismo archivo.
    fileInput.value = '';
  }

  private emit(files: File[]): void {
    const selected = this.multiple() ? files : files.slice(0, 1);
    if (selected.length) {
      this.filesSelected.emit(selected);
    }
  }
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}
