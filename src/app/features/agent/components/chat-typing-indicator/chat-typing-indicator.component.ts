import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';

/** Placeholder mientras el agente genera la respuesta. */
@Component({
    selector: 'app-chat-typing-indicator',
    imports: [AvatarModule, SkeletonModule],
    template: `
    <div class="flex gap-3" role="status" aria-label="El agente está escribiendo">
      <p-avatar icon="pi pi-sparkles" shape="circle" styleClass="app-avatar-accent flex-shrink-0" />
      <div class="flex flex-column flex-1 gap-2 pt-2">
        <p-skeleton width="90%" />
        <p-skeleton width="75%" />
        <p-skeleton width="40%" />
      </div>
    </div>
  `,
    host: { class: 'block mb-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatTypingIndicatorComponent {}
