import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';

/** Placeholder mientras el agente genera la respuesta. */
@Component({
    selector: 'app-chat-typing-indicator',
    imports: [AvatarComponent],
    template: `
    <div class="flex gap-3" role="status" aria-label="El agente está escribiendo">
      <app-avatar icon="auto_awesome" variant="accent" />
      <div class="flex flex-column flex-1 gap-2 pt-2">
        <div class="app-skeleton" style="width: 90%"></div>
        <div class="app-skeleton" style="width: 75%"></div>
        <div class="app-skeleton" style="width: 40%"></div>
      </div>
    </div>
  `,
    host: { class: 'block mb-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatTypingIndicatorComponent {}
