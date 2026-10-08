import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

/** Avatar del usuario en sesión con su menú desplegable. */
@Component({
    selector: 'app-user-menu',
    imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, AvatarComponent],
    templateUrl: './user-menu.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthService);

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
}
