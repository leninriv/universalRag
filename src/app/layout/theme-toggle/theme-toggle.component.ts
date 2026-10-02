import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { ThemeService } from '../../core/services/theme.service';

/** Botón para alternar entre tema claro y oscuro. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [ButtonModule, TooltipModule],
  template: `
    <p-button
      [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
      [text]="true"
      [rounded]="true"
      severity="secondary"
      [ariaLabel]="label()"
      [pTooltip]="label()"
      tooltipPosition="bottom"
      (onClick)="theme.toggle()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() => (this.theme.isDark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));
}
