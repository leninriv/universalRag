import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Cabecera de un `mat-sidenav` usado como drawer: contenido proyectado (título, logo…) + botón de cerrar. */
@Component({
  selector: 'app-drawer-header',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-1 align-items-center min-w-0"><ng-content /></div>
    <button matIconButton type="button" aria-label="Cerrar" (click)="closed.emit()">
      <mat-icon>close</mat-icon>
    </button>
  `,
  host: { class: 'flex align-items-center gap-2 h-4rem pl-3 pr-2 border-bottom-1 surface-border' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerHeaderComponent {
  readonly closed = output<void>();
}
