import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { ChatMessage } from '../../models/chat.model';

const COPIED_FEEDBACK_MS = 1500;

/** Un mensaje del chat: burbuja a la derecha (usuario) o respuesta con avatar (agente). */
@Component({
    selector: 'app-chat-message',
    imports: [AvatarModule, ButtonModule, TooltipModule],
    templateUrl: './chat-message.component.html',
    styleUrl: './chat-message.component.scss',
    host: { class: 'block mb-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatMessageComponent {
  readonly message = input.required<ChatMessage>();

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.message().content);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
  }
}
