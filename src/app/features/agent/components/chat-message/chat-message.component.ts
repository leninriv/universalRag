import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { ChatMessage } from '../../models/chat.model';

const COPIED_FEEDBACK_MS = 1500;

/** Un mensaje del chat: burbuja a la derecha (usuario) o respuesta con avatar (agente). */
@Component({
    selector: 'app-chat-message',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule, AvatarComponent],
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
