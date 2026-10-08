import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

import { AvatarComponent } from '../avatar/avatar.component';

/** Placeholder para módulos que aún no están implementados. */
@Component({
    selector: 'app-coming-soon',
    imports: [MatChipsModule, AvatarComponent],
    templateUrl: './coming-soon.component.html',
    host: { class: 'flex h-full align-items-center justify-content-center p-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComingSoonComponent {
  /** Nombre del módulo, p. ej. "FileManager". */
  readonly moduleName = input.required<string>();
  /** Nombre de un ícono de Material Symbols, p. ej. "folder_open". */
  readonly icon = input('schedule');
  readonly description = input('Estamos trabajando en este módulo. Muy pronto estará disponible.');
}
