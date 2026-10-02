import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { LayoutService } from '../layout.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/** Barra superior: botón del menú lateral, contenido de la página activa, tema y avatar. */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [NgTemplateOutlet, ButtonModule, ThemeToggleComponent, UserMenuComponent],
  template: `
    <header class="flex align-items-center gap-2 h-4rem px-3 surface-section border-bottom-1 surface-border">
      <p-button
        icon="pi pi-bars"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Mostrar u ocultar menú lateral"
        (onClick)="layout.toggleSidebar()"
      />
      <div class="flex flex-1 align-items-center gap-2 min-w-0">
        <ng-container [ngTemplateOutlet]="layout.topbarContent()" />
      </div>
      <app-theme-toggle />
      <app-user-menu />
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
}
