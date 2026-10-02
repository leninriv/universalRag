import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';

// Solo UI: usuario de ejemplo hasta que exista autenticación.
const CURRENT_USER = { name: 'Usuario Demo', email: 'demo@universalrag.local', initials: 'UD' };

/** Avatar del usuario con su menú desplegable. */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [AvatarModule, MenuModule],
  templateUrl: './user-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  protected readonly user = CURRENT_USER;

  protected readonly items: MenuItem[] = [
    { label: 'Perfil', icon: 'pi pi-user' },
    { label: 'Configuración', icon: 'pi pi-cog' },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out' },
  ];
}
