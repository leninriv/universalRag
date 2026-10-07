import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';

/** Logo + nombre de la aplicación. En modo `compact` solo muestra el logo. */
@Component({
    selector: 'app-brand',
    imports: [RouterLink, AvatarModule],
    template: `
    <a routerLink="/" class="flex align-items-center gap-2 no-underline text-color" aria-label="Universal RAG">
      <p-avatar icon="pi pi-bolt" shape="circle" styleClass="bg-primary flex-shrink-0" />
      @if (!compact()) {
        <span class="font-bold text-lg white-space-nowrap">Universal RAG</span>
      }
    </a>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {
  readonly compact = input(false);
}
