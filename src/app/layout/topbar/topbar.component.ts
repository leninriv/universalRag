import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LayoutService } from '../layout.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/** Barra superior: botón del menú lateral, contenido de la página activa, tema y avatar. */
@Component({
    selector: 'app-topbar',
    imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, ThemeToggleComponent, UserMenuComponent],
    template: `
    <header class="flex align-items-center gap-2 h-4rem px-3 surface-section border-bottom-1 surface-border">
      <button matIconButton type="button" aria-label="Mostrar u ocultar menú lateral" (click)="layout.toggleSidebar()">
        <mat-icon>menu</mat-icon>
      </button>
      <div class="flex flex-1 align-items-center gap-2 min-w-0">
        <ng-container [ngTemplateOutlet]="layout.topbarContent()" />
      </div>
      <app-theme-toggle />
      <app-user-menu />
    </header>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
}
