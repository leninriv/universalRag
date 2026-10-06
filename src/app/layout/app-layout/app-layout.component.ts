import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { filter } from 'rxjs';

import { BrandComponent } from '../brand/brand.component';
import { LayoutService } from '../layout.service';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { TopbarComponent } from '../topbar/topbar.component';

/** Shell de la aplicación: menú lateral colapsable en desktop y drawer en pantallas pequeñas. */
@Component({
    selector: 'app-layout',
    imports: [RouterOutlet, SidebarModule, BrandComponent, SideNavComponent, TopbarComponent],
    templateUrl: './app-layout.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppLayoutComponent {
  private readonly layout = inject(LayoutService);

  protected readonly sidebarCollapsed = this.layout.sidebarCollapsed;
  protected readonly mobileNavVisible = this.layout.mobileNavVisible;

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mobileNavVisible.set(false));
  }
}
