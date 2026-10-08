import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemeService } from '../../core/services/theme.service';

/** Botón para alternar entre tema claro y oscuro. */
@Component({
    selector: 'app-theme-toggle',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    template: `
    <button matIconButton type="button" [attr.aria-label]="label()" [matTooltip]="label()" (click)="theme.toggle()">
      <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
    </button>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() => (this.theme.isDark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));
}
