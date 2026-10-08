import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_SECTIONS } from '../navigation';

/** Menú de navegación entre módulos. Se usa en el panel lateral (desktop) y en el drawer (mobile). */
@Component({
    selector: 'app-side-nav',
    imports: [MatIconModule, MatListModule, MatTooltipModule, RouterLink, RouterLinkActive],
    template: `
    <mat-nav-list class="app-nav-list" [class.app-nav-list-collapsed]="collapsed()">
      @for (section of sections; track section.label) {
        <h3 matSubheader>{{ section.label }}</h3>
        @for (item of section.items; track item.route) {
          <a
            mat-list-item
            [routerLink]="item.route"
            routerLinkActive
            #rla="routerLinkActive"
            [activated]="rla.isActive"
            [attr.aria-current]="rla.isActive ? 'page' : null"
            [attr.aria-label]="item.label"
            [matTooltip]="item.label"
            matTooltipPosition="right"
            [matTooltipDisabled]="!collapsed()"
          >
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        }
      }
    </mat-nav-list>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavComponent {
  /** Solo íconos; el nombre de cada módulo se muestra como tooltip. */
  readonly collapsed = input(false);

  protected readonly sections = NAV_SECTIONS;
}
