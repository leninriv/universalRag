import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';

import { NAV_ITEMS } from '../navigation';

/** Menú de navegación entre módulos. Se usa en el panel lateral (desktop) y en el drawer (mobile). */
@Component({
    selector: 'app-side-nav',
    imports: [MenuModule],
    template: `
    <p-menu [model]="items()" [styleClass]="collapsed() ? 'app-nav-menu app-nav-menu-collapsed' : 'app-nav-menu'" />
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavComponent {
  /** Solo íconos; el nombre de cada módulo se muestra como tooltip. */
  readonly collapsed = input(false);

  protected readonly items = computed(() => withTooltips(NAV_ITEMS, this.collapsed()));
}

function withTooltips(items: MenuItem[], enabled: boolean): MenuItem[] {
  return items.map((item) => ({
    ...item,
    tooltipOptions: { tooltipLabel: item.label, tooltipPosition: 'right', disabled: !enabled || !!item.items },
    items: item.items && withTooltips(item.items, enabled),
  }));
}
