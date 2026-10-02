import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';

/** Placeholder para módulos que aún no están implementados. */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [AvatarModule, TagModule],
  templateUrl: './coming-soon.component.html',
  host: { class: 'flex h-full align-items-center justify-content-center p-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  /** Nombre del módulo, p. ej. "FileManager". */
  readonly moduleName = input.required<string>();
  /** Clase de PrimeIcons, p. ej. "pi pi-folder". */
  readonly icon = input('pi pi-clock');
  readonly description = input('Estamos trabajando en este módulo. Muy pronto estará disponible.');
}
