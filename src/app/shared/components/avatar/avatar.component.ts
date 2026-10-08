import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type AvatarSize = 'small' | 'normal' | 'xlarge';
export type AvatarVariant = 'primary' | 'accent';

/**
 * Círculo con un ícono o unas iniciales (Material no tiene avatar).
 * `primary` = fondo del color primario; `accent` = fondo suave con el acento del tema.
 */
@Component({
  selector: 'app-avatar',
  imports: [MatIconModule],
  template: `
    @if (icon(); as icon) {
      <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
    } @else {
      {{ label() }}
    }
  `,
  styleUrl: './avatar.component.scss',
  host: {
    class: 'app-avatar',
    '[class]': "'app-avatar-' + size() + ' app-avatar-' + variant()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  /** Nombre de un ícono de Material Symbols, p. ej. "auto_awesome". Tiene prioridad sobre `label`. */
  readonly icon = input<string>();
  /** Texto corto, p. ej. las iniciales del usuario. */
  readonly label = input<string>();
  readonly size = input<AvatarSize>('normal');
  readonly variant = input<AvatarVariant>('primary');
}
