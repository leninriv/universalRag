import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';

import { AuthService } from '../../core/services/auth.service';

/** Avatar del usuario en sesión con su menú desplegable. */
@Component({
    selector: 'app-user-menu',
    imports: [AvatarModule, MenuModule],
    templateUrl: './user-menu.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);

  protected readonly user = computed(() => {
    const user = this.auth.user();
    return {
      name: user?.name ?? '',
      email: user?.email ?? '',
      initials: (user?.name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join(''),
    };
  });

  protected readonly items: MenuItem[] = [
    { label: 'Perfil', icon: 'pi pi-user' },
    { label: 'Configuración', icon: 'pi pi-cog' },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];
}
